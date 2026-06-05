"""Pydantic schemas for versioned legal documents."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


LEGAL_DOCUMENT_KEYS = {"cgu", "privacy", "data_processing", "biometric"}
LEGAL_LOCALES = {"fr", "en"}
LEGAL_STATUSES = {"DRAFT", "PUBLISHED", "ARCHIVED"}


def normalize_legal_key(value: str) -> str:
    normalized = value.strip().lower().replace("-", "_")
    if normalized == "terms":
        normalized = "cgu"
    if normalized not in LEGAL_DOCUMENT_KEYS:
        raise ValueError(f"unsupported legal document key: {value}")
    return normalized


def normalize_locale(value: str | None) -> str:
    normalized = (value or "fr").strip().lower()
    if normalized.startswith("fr"):
        return "fr"
    if normalized.startswith("en"):
        return "en"
    return "fr"


class LegalDocumentCreate(BaseModel):
    document_key: str = Field(..., max_length=64)
    locale: str = Field(default="fr", max_length=10)
    version: str = Field(..., min_length=1, max_length=32)
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    content_format: str = Field(default="markdown", max_length=16)
    status: str = Field(default="DRAFT", max_length=16)
    effective_at: datetime | None = None

    @field_validator("document_key")
    @classmethod
    def validate_key(cls, value: str) -> str:
        return normalize_legal_key(value)

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, value: str) -> str:
        return normalize_locale(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in LEGAL_STATUSES:
            raise ValueError(f"unsupported legal status: {value}")
        return normalized


class LegalDocumentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    content: str | None = Field(None, min_length=1)
    content_format: str | None = Field(None, max_length=16)
    status: str | None = Field(None, max_length=16)
    effective_at: datetime | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip().upper()
        if normalized not in LEGAL_STATUSES:
            raise ValueError(f"unsupported legal status: {value}")
        return normalized


class LegalDocumentResponse(BaseModel):
    id: UUID
    document_key: str
    locale: str
    version: str
    title: str
    content: str
    content_format: str
    content_hash: str
    status: str
    effective_at: datetime | None = None
    published_at: datetime | None = None
    published_by: UUID | None = None
    created_by: UUID | None = None
    updated_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AcceptedLegalDocument(BaseModel):
    document_key: str = Field(..., max_length=64)
    document_id: UUID | None = None
    locale: str | None = Field(None, max_length=10)
    version: str | None = Field(None, max_length=32)
    content_hash: str | None = Field(None, min_length=64, max_length=64)
    accepted_at: datetime | None = None

    @field_validator("document_key")
    @classmethod
    def validate_key(cls, value: str) -> str:
        return normalize_legal_key(value)

    @field_validator("locale")
    @classmethod
    def validate_optional_locale(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return normalize_locale(value)
