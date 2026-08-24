"""Gestiona la lista de correos autorizados a registrarse en /register.

Uso:
    python manage_allowed_emails.py add <correo> ["nota"]
    python manage_allowed_emails.py remove <correo>
    python manage_allowed_emails.py list
"""
import sys

from auth import normalize_email
from database import Base, SessionLocal, engine
from models import AllowedEmail


def add(email: str, note: str = "") -> None:
    email = normalize_email(email)
    db = SessionLocal()
    try:
        existing = db.query(AllowedEmail).filter(AllowedEmail.email == email).first()
        if existing:
            print(f"'{email}' ya estaba en la lista.")
            return
        db.add(AllowedEmail(email=email, note=note))
        db.commit()
        print(f"'{email}' añadido a la lista de correos autorizados.")
    finally:
        db.close()


def remove(email: str) -> None:
    email = normalize_email(email)
    db = SessionLocal()
    try:
        existing = db.query(AllowedEmail).filter(AllowedEmail.email == email).first()
        if not existing:
            print(f"'{email}' no estaba en la lista.")
            return
        db.delete(existing)
        db.commit()
        print(f"'{email}' eliminado de la lista de correos autorizados.")
    finally:
        db.close()


def list_emails() -> None:
    db = SessionLocal()
    try:
        emails = db.query(AllowedEmail).order_by(AllowedEmail.email).all()
        if not emails:
            print("No hay correos autorizados todavía.")
            return
        for e in emails:
            note = f"  ({e.note})" if e.note else ""
            print(f"- {e.email}{note}")
    finally:
        db.close()


def main() -> None:
    Base.metadata.create_all(bind=engine)

    if len(sys.argv) < 2 or sys.argv[1] not in ("add", "remove", "list"):
        print(__doc__)
        sys.exit(1)

    action = sys.argv[1]
    if action == "list":
        list_emails()
    elif action == "add":
        if len(sys.argv) < 3:
            print("Uso: python manage_allowed_emails.py add <correo> [\"nota\"]")
            sys.exit(1)
        note = sys.argv[3] if len(sys.argv) > 3 else ""
        add(sys.argv[2], note)
    elif action == "remove":
        if len(sys.argv) < 3:
            print("Uso: python manage_allowed_emails.py remove <correo>")
            sys.exit(1)
        remove(sys.argv[2])


if __name__ == "__main__":
    main()
