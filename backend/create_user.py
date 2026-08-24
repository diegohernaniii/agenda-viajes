"""Crea o actualiza directamente un usuario de la agenda de viajes (uso admin).

Para el flujo normal, en cambio, añade el correo con manage_allowed_emails.py
y deja que la persona se registre ella misma en /register.

Uso:
    python create_user.py <correo> <contraseña> ["Nombre completo"]
"""
import sys

from auth import hash_password, normalize_email
from database import Base, SessionLocal, engine
from models import User


def main() -> None:
    if len(sys.argv) < 3:
        print("Uso: python create_user.py <correo> <contraseña> [\"Nombre completo\"]")
        sys.exit(1)

    email = normalize_email(sys.argv[1])
    password = sys.argv[2]
    full_name = sys.argv[3] if len(sys.argv) > 3 else email

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.hashed_password = hash_password(password)
            user.full_name = full_name
            print(f"Usuario '{email}' actualizado.")
        else:
            user = User(email=email, full_name=full_name, hashed_password=hash_password(password))
            db.add(user)
            print(f"Usuario '{email}' creado.")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
