"""Convierte a una persona ya registrada en administrador (o le quita el rol).

Uso:
    python make_admin.py <correo>            # lo hace administrador
    python make_admin.py <correo> --quitar   # le quita el rol de administrador
"""
import sys

from auth import normalize_email
from database import Base, SessionLocal, engine, run_migrations
from models import User


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    email = normalize_email(sys.argv[1])
    quitar = "--quitar" in sys.argv[2:]

    Base.metadata.create_all(bind=engine)
    run_migrations()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"No existe ningún usuario registrado con el correo '{email}'.")
            print("Primero tiene que entrar en /register y crear su cuenta.")
            sys.exit(1)
        user.is_admin = not quitar
        db.commit()
        if quitar:
            print(f"'{email}' ya no es administrador.")
        else:
            print(f"'{email}' es ahora administrador.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
