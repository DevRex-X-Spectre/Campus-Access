"""Pydantic request/response models."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Role = Literal["student", "staff"]


class EnrollRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    role: Role
    image: str = Field(..., min_length=1)
    # Required for students; optional/ignored for staff
    matric_number: Optional[str] = Field(default=None, max_length=64)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name must not be empty")
        return cleaned

    @field_validator("matric_number")
    @classmethod
    def clean_matric(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("image")
    @classmethod
    def image_not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Image must not be empty")
        return value.strip()


class EnrollResponse(BaseModel):
    success: bool
    message: str
    personnel_id: Optional[int] = None
    name: Optional[str] = None
    role: Optional[str] = None
    matric_number: Optional[str] = None
    is_new_personnel: Optional[bool] = None


class RecognizeRequest(BaseModel):
    image: str = Field(..., min_length=1)
    area_id: int = Field(..., ge=1)

    @field_validator("image")
    @classmethod
    def image_not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Image must not be empty")
        return value.strip()


class RecognizeResponse(BaseModel):
    granted: bool
    recognized: bool
    name: Optional[str] = None
    role: Optional[str] = None
    matric_number: Optional[str] = None
    confidence: float = 0.0
    personnel_id: Optional[int] = None
    area_id: Optional[int] = None
    area_name: Optional[str] = None
    reason: str
    message: str


class BlacklistRequest(BaseModel):
    blacklisted: bool


class PersonnelItem(BaseModel):
    id: int
    name: str
    role: str
    matric_number: Optional[str] = None
    blacklisted: bool
    created_at: str
    embedding_count: int


class PersonnelListResponse(BaseModel):
    personnel: list[PersonnelItem]
    count: int


class AreaItem(BaseModel):
    id: int
    name: str
    staff_only: bool
    created_at: str


class AreaListResponse(BaseModel):
    areas: list[AreaItem]
    count: int


class AreaCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    staff_only: bool = False

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Area name must not be empty")
        return cleaned


class AreaUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    staff_only: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Area name must not be empty")
        return cleaned


class AccessLogItem(BaseModel):
    id: int
    personnel_id: Optional[int] = None
    area_id: Optional[int] = None
    granted: bool
    recognized: bool
    reason: str
    timestamp: str
    person_name: Optional[str] = None
    person_role: Optional[str] = None
    area_name: Optional[str] = None


class AccessLogListResponse(BaseModel):
    logs: list[AccessLogItem]
    count: int


class AdminPinRequest(BaseModel):
    pin: str = Field(..., min_length=1, max_length=32)


class AdminPinResponse(BaseModel):
    success: bool
    message: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    match_threshold: float
