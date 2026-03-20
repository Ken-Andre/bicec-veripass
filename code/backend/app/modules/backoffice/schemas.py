"""Backoffice Pydantic schemas."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class KYCQueueItemSchema(BaseModel):
    """Minimal KYC session info for the backoffice queue view."""
    id: UUID
    status: str
    access_level: str
    priority_flag: bool
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AuditLogSchema(BaseModel):
    """Minimal audit log entry for the backoffice view."""
    id: UUID
    action: str
    table_name: Optional[str] = None
    record_id: Optional[str] = None
    performed_by: Optional[UUID] = None
    performed_at: datetime
    client_ip: Optional[str] = None

    model_config = {"from_attributes": True}
