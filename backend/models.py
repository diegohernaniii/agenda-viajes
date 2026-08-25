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
    purpose = Column(String(150), nullable=False, default="")
    contact_person = Column(String(150), nullable=False, default="")
    contact_role = Column(String(150), nullable=False, default="")
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
    phones = relationship(
        "TripPhone", back_populates="trip", cascade="all, delete-orphan", order_by="TripPhone.id"
    )
    attachments = relationship(
        "Attachment", back_populates="trip", cascade="all, delete-orphan", order_by="Attachment.id"
    )
    links = relationship(
        "TripLink", back_populates="trip", cascade="all, delete-orphan", order_by="TripLink.id"
    )
    history = relationship(
        "TripHistoryEntry",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="TripHistoryEntry.id.desc()",
    )


class Traveler(Base):
    __tablename__ = "travelers"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    full_name = Column(String(150), nullable=False)

    trip = relationship("Trip", back_populates="travelers")


class TripPhone(Base):
    __tablename__ = "trip_phones"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    phone = Column(String(50), nullable=False)

    trip = relationship("Trip", back_populates="phones")


class TripLink(Base):
    """Enlace a un documento externo (Word, Excel, carpeta de SharePoint...)."""

    __tablename__ = "trip_links"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    title = Column(String(200), nullable=False, default="")
    url = Column(String(1000), nullable=False)

    trip = relationship("Trip", back_populates="links")


class TripHistoryEntry(Base):
    """Un cambio concreto en un campo del viaje (para el historial detallado)."""

    __tablename__ = "trip_history"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    field_label = Column(String(100), nullable=False)
    old_value = Column(String(500), nullable=True)
    new_value = Column(String(500), nullable=True)
    changed_by = Column(String(80), nullable=False, default="")
    changed_at = Column(DateTime, default=datetime.utcnow)

    trip = relationship("Trip", back_populates="history")


class Attachment(Base):
    """Foto o nota de voz adjunta a un viaje, guardada en disco."""

    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    kind = Column(String(10), nullable=False)  # "image" o "audio"
    stored_name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False, default="")
    title = Column(String(200), nullable=False, default="")
    content_type = Column(String(100), nullable=False, default="")
    uploaded_by = Column(String(80), nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    trip = relationship("Trip", back_populates="attachments")

    @property
    def url(self) -> str:
        return f"/uploads/{self.trip_id}/{self.stored_name}"
