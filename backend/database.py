from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = Path(__file__).resolve().parent / "data" / "agenda.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def run_migrations():
    """Añade columnas nuevas a bases de datos ya existentes (sin Alembic)."""
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("users")]
        if "is_admin" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"))

    if "trips" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("trips")]
        if "contact_role" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE trips ADD COLUMN contact_role VARCHAR(150) NOT NULL DEFAULT ''"))
        if "purpose" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE trips ADD COLUMN purpose VARCHAR(150) NOT NULL DEFAULT ''"))

    if "attachments" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("attachments")]
        if "title" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE attachments ADD COLUMN title VARCHAR(200) NOT NULL DEFAULT ''"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
