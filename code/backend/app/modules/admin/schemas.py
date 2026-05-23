"""Admin Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class UserSchema(BaseModel):
    """Minimal user info for admin listing."""

    id: UUID
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    language: str
    created_at: datetime

    model_config = {"from_attributes": True}
