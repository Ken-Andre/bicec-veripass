"""Client support API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SupportThreadResponse(BaseModel):
    id: UUID
    session_id: UUID
    status: str
    created_at: datetime


class SupportMessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    sender: str
    content: str
    attachment_path: str | None = None
    attachment_sha256: str | None = None
    attachment_filename: str | None = None
    attachment_document_id: UUID | None = None
    created_at: datetime


class SupportMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    attachment_id: str | None = Field(None, max_length=128)


class SupportAttachmentResponse(BaseModel):
    attachment_id: str
    filename: str
    size: int = Field(..., ge=0)
    sha256: str
    content_type: str
    path: str


class SupportAttachmentLimitsResponse(BaseModel):
    max_size_mb: int
    hard_max_size_mb: int
    image_max_size_mb: int
    pdf_max_size_mb: int
    pdf_max_pages: int
    max_message_chars: int
    allowed_content_types: list[str]
    allowed_extensions: list[str]
