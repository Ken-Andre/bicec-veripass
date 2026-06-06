"""Device-tag enforcement dependencies."""

from datetime import datetime, timezone
from enum import Enum

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.devices.models import DeviceRegistration


class DeviceTagDecision(str, Enum):
    ALLOWED = "allowed"
    REGISTRATION_REQUIRED = "registration_required"
    INVALID = "invalid"
    NO_REGISTERED_DEVICE = "no_registered_device"


def evaluate_device_tag(
    active_device_tags: list[str],
    supplied_device_tag: str | None,
) -> DeviceTagDecision:
    """Evaluate whether a supplied device tag is acceptable.

    Users with no active device registration are allowed so freshly upgraded
    clients can register their first device immediately after login. Once at
    least one active device exists, sensitive routes require a matching tag.
    """
    if not active_device_tags:
        return DeviceTagDecision.ALLOWED
    if not supplied_device_tag:
        return DeviceTagDecision.REGISTRATION_REQUIRED
    if supplied_device_tag not in active_device_tags:
        return DeviceTagDecision.INVALID
    return DeviceTagDecision.ALLOWED


async def require_registered_device(
    x_device_tag: str | None = Header(None, alias="X-Device-Tag"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Require a known active device tag after the user has registered devices."""
    result = await db.execute(
        select(DeviceRegistration).where(
            DeviceRegistration.user_id == current_user.id,
            DeviceRegistration.is_active == True,  # noqa: E712
        )
    )
    devices = list(result.scalars().all())
    decision = evaluate_device_tag([device.device_tag for device in devices], x_device_tag)

    if decision == DeviceTagDecision.REGISTRATION_REQUIRED:
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail="Device tag required. Register this device before continuing.",
        )
    if decision == DeviceTagDecision.INVALID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device tag is not registered for this user.",
        )

    for device in devices:
        if device.device_tag == x_device_tag:
            device.last_seen_at = datetime.now(timezone.utc)
            await db.commit()
            break

    return current_user


async def require_existing_registered_device(
    x_device_tag: str | None = Header(None, alias="X-Device-Tag"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Require a known active device tag, with no bearer-only bootstrap window."""
    result = await db.execute(
        select(DeviceRegistration).where(
            DeviceRegistration.user_id == current_user.id,
            DeviceRegistration.is_active == True,  # noqa: E712
        )
    )
    devices = list(result.scalars().all())
    if not devices:
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail="Register this device before continuing.",
        )

    decision = evaluate_device_tag([device.device_tag for device in devices], x_device_tag)
    if decision == DeviceTagDecision.REGISTRATION_REQUIRED:
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail="Device tag required.",
        )
    if decision == DeviceTagDecision.INVALID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device tag is not registered for this user.",
        )

    for device in devices:
        if device.device_tag == x_device_tag:
            device.last_seen_at = datetime.now(timezone.utc)
            await db.commit()
            break

    return current_user
