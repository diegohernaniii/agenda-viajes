from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False, default="")
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AllowedEmail(Base):
    """Correos autorizados a registrarse por su cuenta en /register."""

    __tablename__ = "allowed_emails"

    id = Column(Integer, primary_key=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    note = Column(String(150), nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(150), nullable=False, default="")
    contact_phone = Column(String(50), nullable=False, default="")
    contact_email = Column(String(150), nullable=False, default="")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    notes = Column(String(1000), nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String(80), nullable=False, default="")

    travelers = relationship(
        "Traveler", back_populates="trip", cascade="all, delete-orphan", order_by="Traveler.id"
    )


class Traveler(Base):
    __tablename__ = "travelers"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    full_name = Column(String(150), nullable=False)

    trip = relationship("Trip", back_populates="travelers")
