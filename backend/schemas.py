"""Pydantic request/response models."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class EnrollRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    image: str = Field(..., min_length=1, description="Base64-encoded face crop (data URL or raw base64)")

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name must not be empty")
        return cleaned

    @field_validator("image")
    @classmethod
    def image_not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Image must not be empty")
        return value.strip()


class RecognizeRequest(BaseModel):
    image: str = Field(..., min_length=1, description="Base64-encoded face crop (data URL or raw base64)")

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
    is_new_personnel: Optional[bool] = None


class RecognizeResponse(BaseModel):
    recognized: bool
    name: Optional[str] = None
    confidence: float = 0.0
    personnel_id: Optional[int] = None
    message: str


class PersonnelItem(BaseModel):
    id: int
    name: str
    created_at: str
    embedding_count: int


class PersonnelListResponse(BaseModel):
    personnel: list[PersonnelItem]
    count: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    match_threshold: float
