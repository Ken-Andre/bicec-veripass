"""Notification API schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    message: str | None = None
    read: bool
    created_at: datetime | None = None
    metadata: dict[str, Any] | None = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int = Field(..., ge=0)


class NotificationReadRequest(BaseModel):
    notification_ids: list[UUID] | None = None
    mark_all: bool = False


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., min_length=1)
    auth: str = Field(..., min_length=1)


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(..., min_length=1)
    keys: PushSubscriptionKeys
    user_agent: str | None = None
    device_tag: str | None = Field(None, max_length=128)
    metadata: dict[str, Any] | None = None


class PushSubscriptionResponse(BaseModel):
    id: UUID
    endpoint: str
    device_tag: str | None = None
    is_active: bool
    created_at: datetime
