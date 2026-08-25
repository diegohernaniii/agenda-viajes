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


class AttachmentOut(BaseModel):
    id: int
    kind: str
    title: str
    original_name: str
    content_type: str
    url: str
    uploaded_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class LinkIn(BaseModel):
    title: str = ""
    url: str

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, v: str) -> str:
        v = v.strip()
        if v and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("El enlace debe empezar por http:// o https://")
        return v


class LinkOut(BaseModel):
    id: int
    title: str
    url: str

    class Config:
        from_attributes = True


class TripHistoryEntryOut(BaseModel):
    id: int
    field_label: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: str
    changed_at: datetime

    class Config:
        from_attributes = True


class TripIn(BaseModel):
    name: str
    purpose: str = ""
    contact_person: str = ""
    contact_role: str = ""
    phones: List[str] = []
    contact_email: Optional[str] = ""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: str = ""
    travelers: List[TravelerIn] = []
    links: List[LinkIn] = []

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
    purpose: str
    contact_person: str
    contact_role: str
    contact_email: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: str
    created_at: datetime
    updated_at: datetime
    updated_by: str
    travelers: List[TravelerOut] = []
    phones: List[str] = []
    attachments: List[AttachmentOut] = []
    links: List[LinkOut] = []

    @field_validator("phones", mode="before")
    @classmethod
    def extract_phones(cls, v):
        if v and hasattr(v[0], "phone"):
            return [p.phone for p in v]
        return v

    class Config:
        from_attributes = True
