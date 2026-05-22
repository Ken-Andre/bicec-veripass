"""Device API schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DeviceRegisterRequest(BaseModel):
    fingerprint_hash: str = Field(..., min_length=16, max_length=128)
    metadata: dict[str, Any] | None = None


class DeviceRegisterResponse(BaseModel):
    id: UUID
    device_tag: str
    created_at: datetime
    last_seen_at: datetime
