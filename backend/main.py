import os
import secrets
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from auth import authenticate_user, get_current_user, hash_password, is_email_allowed, normalize_email
from database import Base, SessionLocal, engine, get_db, run_migrations
from models import AllowedEmail, Traveler, Trip, User
from schemas import TripIn, TripOut

BASE_DIR = Path(__file__).resolve().parent

Base.metadata.create_all(bind=engine)
run_migrations()

SECRET_KEY = os.environ.get("AGENDA_SECRET_KEY")
if not SECRET_KEY:
    print("[AVISO] AGENDA_SECRET_KEY no definida: usando una clave aleatoria temporal "
          "(las sesiones se cerrarán en cada reinicio). Define esta variable de entorno en producción.")
    SECRET_KEY = secrets.token_hex(32)

app = FastAPI(title="Agenda de Viajes")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY, same_site="lax")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


def require_login(request: Request, db: Session = Depends(get_db)) -> User:
    try:
        return get_current_user(request, db)
    except HTTPException:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")


def require_admin(user: User = Depends(require_login)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    return user


# ---------- Páginas ----------

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if request.session.get("user_id"):
        return RedirectResponse("/dashboard", status_code=302)
    return templates.TemplateResponse("login.html", {"request": request, "error": None})


@app.post("/login")
def login_submit(request: Request, email: str = Form(""), password: str = Form("")):
    db = SessionLocal()
    try:
        user = authenticate_user(db, email, password)
    finally:
        db.close()
    if not user:
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Correo o contraseña incorrectos"},
            status_code=401,
        )
    request.session["user_id"] = user.id
    request.session["full_name"] = user.full_name
    request.session["is_admin"] = user.is_admin
    return RedirectResponse("/dashboard", status_code=302)


@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/login", status_code=302)


@app.get("/register", response_class=HTMLResponse)
def register_page(request: Request):
    if request.session.get("user_id"):
        return RedirectResponse("/dashboard", status_code=302)
    return templates.TemplateResponse("register.html", {"request": request, "error": None})


@app.post("/register")
def register_submit(
    request: Request,
    email: str = Form(""),
    full_name: str = Form(""),
    password: str = Form(""),
    password_confirm: str = Form(""),
):
    def error(message: str):
        return templates.TemplateResponse(
            "register.html",
            {"request": request, "error": message, "email": email, "full_name": full_name},
            status_code=400,
        )

    email_norm = normalize_email(email)
    full_name = full_name.strip()

    if not email_norm or not full_name:
        return error("El correo y el nombre son obligatorios")
    if len(password) < 6:
        return error("La contraseña debe tener al menos 6 caracteres")
    if password != password_confirm:
        return error("Las contraseñas no coinciden")

    db = SessionLocal()
    try:
        if not is_email_allowed(db, email_norm):
            return error(
                "Este correo no está autorizado a registrarse. "
                "Pide a un administrador que lo añada a la lista de correos permitidos."
            )
        if db.query(User).filter(User.email == email_norm).first():
            return error("Ya existe una cuenta con este correo. Inicia sesión.")

        user = User(email=email_norm, full_name=full_name, hashed_password=hash_password(password))
        db.add(user)
        db.commit()
        db.refresh(user)

        request.session["user_id"] = user.id
        request.session["full_name"] = user.full_name
        request.session["is_admin"] = user.is_admin
        return RedirectResponse("/dashboard", status_code=302)
    finally:
        db.close()


@app.get("/", response_class=HTMLResponse)
def landing(request: Request):
    if request.session.get("user_id"):
        return RedirectResponse("/dashboard", status_code=302)
    return templates.TemplateResponse("landing.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse("/login", status_code=302)
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "full_name": request.session.get("full_name", ""),
            "is_admin": request.session.get("is_admin", False),
        },
    )


# ---------- API ----------

@app.get("/api/trips", response_model=List[TripOut])
def list_trips(db: Session = Depends(get_db), user: User = Depends(require_login)):
    trips = db.query(Trip).order_by(Trip.start_date.is_(None), Trip.start_date).all()
    return trips


@app.post("/api/trips", response_model=TripOut, status_code=201)
def create_trip(payload: TripIn, db: Session = Depends(get_db), user: User = Depends(require_login)):
    trip = Trip(
        name=payload.name,
        contact_person=payload.contact_person,
        contact_phone=payload.contact_phone,
        contact_email=payload.contact_email or "",
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
        updated_by=user.full_name or user.email,
    )
    trip.travelers = [Traveler(full_name=t.full_name) for t in payload.travelers if t.full_name.strip()]
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@app.get("/api/trips/{trip_id}", response_model=TripOut)
def get_trip(trip_id: int, db: Session = Depends(get_db), user: User = Depends(require_login)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return trip


@app.put("/api/trips/{trip_id}", response_model=TripOut)
def update_trip(
    trip_id: int, payload: TripIn, db: Session = Depends(get_db), user: User = Depends(require_login)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    trip.name = payload.name
    trip.contact_person = payload.contact_person
    trip.contact_phone = payload.contact_phone
    trip.contact_email = payload.contact_email or ""
    trip.start_date = payload.start_date
    trip.end_date = payload.end_date
    trip.notes = payload.notes
    trip.updated_by = user.full_name or user.email

    trip.travelers = [Traveler(full_name=t.full_name) for t in payload.travelers if t.full_name.strip()]

    db.commit()
    db.refresh(trip)
    return trip


@app.delete("/api/trips/{trip_id}", status_code=204)
def delete_trip(trip_id: int, db: Session = Depends(get_db), user: User = Depends(require_login)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    db.delete(trip)
    db.commit()
    return JSONResponse(content=None, status_code=204)


# ---------- Administración ----------

@app.get("/admin", response_class=HTMLResponse)
def admin_page(
    request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    allowed_emails = db.query(AllowedEmail).order_by(AllowedEmail.email).all()
    users = db.query(User).order_by(User.email).all()
    return templates.TemplateResponse(
        "admin.html",
        {
            "request": request,
            "full_name": request.session.get("full_name", ""),
            "allowed_emails": allowed_emails,
            "users": users,
            "current_user_id": admin.id,
            "error": request.query_params.get("error"),
            "ok": request.query_params.get("ok"),
        },
    )


@app.post("/admin/allowed-emails/add")
def admin_add_allowed_email(
    email: str = Form(""),
    note: str = Form(""),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    email_norm = normalize_email(email)
    if not email_norm:
        return RedirectResponse("/admin?error=Correo+vacío", status_code=302)
    if db.query(AllowedEmail).filter(AllowedEmail.email == email_norm).first():
        return RedirectResponse("/admin?error=Ese+correo+ya+estaba+en+la+lista", status_code=302)
    db.add(AllowedEmail(email=email_norm, note=note.strip()))
    db.commit()
    return RedirectResponse("/admin?ok=Correo+añadido", status_code=302)


@app.post("/admin/allowed-emails/{allowed_id}/delete")
def admin_delete_allowed_email(
    allowed_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    allowed = db.query(AllowedEmail).filter(AllowedEmail.id == allowed_id).first()
    if allowed:
        db.delete(allowed)
        db.commit()
    return RedirectResponse("/admin?ok=Correo+eliminado", status_code=302)


@app.post("/admin/users/{user_id}/delete")
def admin_delete_user(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    if user_id == admin.id:
        return RedirectResponse("/admin?error=No+puedes+eliminar+tu+propia+cuenta", status_code=302)
    target = db.query(User).filter(User.id == user_id).first()
    if target:
        db.delete(target)
        db.commit()
    return RedirectResponse("/admin?ok=Usuario+eliminado", status_code=302)


@app.post("/admin/users/{user_id}/toggle-admin")
def admin_toggle_admin(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        return RedirectResponse("/admin?error=Usuario+no+encontrado", status_code=302)
    if target.id == admin.id and target.is_admin:
        remaining_admins = db.query(User).filter(User.is_admin.is_(True), User.id != admin.id).count()
        if remaining_admins == 0:
            return RedirectResponse(
                "/admin?error=No+puedes+quitarte+el+rol+de+administrador+siendo+el+único",
                status_code=302,
            )
    target.is_admin = not target.is_admin
    db.commit()
    return RedirectResponse("/admin?ok=Actualizado", status_code=302)


@app.exception_handler(HTTPException)
async def auth_redirect_handler(request: Request, exc: HTTPException):
    if not request.url.path.startswith("/api/"):
        if exc.status_code == 401:
            return RedirectResponse("/login", status_code=302)
        if exc.status_code == 403:
            return RedirectResponse("/dashboard", status_code=302)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
