from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator


class TravelerIn(BaseModel):
    full_name: str


class TravelerOut(BaseModel):
    id: int
    full_name: str

    class Config:
        from_attributes = True


class TripIn(BaseModel):
    name: str
    contact_person: str = ""
    contact_phone: str = ""
    contact_email: Optional[str] = ""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: str = ""
    travelers: List[TravelerIn] = []

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El nombre del viaje es obligatorio")
        return v.strip()

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v, info):
        start = info.data.get("start_date")
        if v and start and v < start:
            raise ValueError("La fecha de vuelta no puede ser anterior a la de ida")
        return v


class TripOut(BaseModel):
    id: int
    name: str
    contact_person: str
    contact_phone: str
    contact_email: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: str
    created_at: datetime
    updated_at: datetime
    updated_by: str
    travelers: List[TravelerOut] = []

    class Config:
        from_attributes = True
