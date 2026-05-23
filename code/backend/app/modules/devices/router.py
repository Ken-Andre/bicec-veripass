"""Device registration API."""

import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.devices.models import DeviceRegistration
from app.modules.devices.schemas import DeviceRegisterRequest, DeviceRegisterResponse

router = APIRouter()


def _make_device_tag(user_id: uuid.UUID, fingerprint_hash: str) -> str:
    digest = hashlib.sha256(f"{user_id}:{fingerprint_hash}".encode("utf-8")).hexdigest()
    return f"vp_dev_{digest[:48]}"


@router.post("/register", response_model=DeviceRegisterResponse)
async def register_device(
    request: Request,
    body: DeviceRegisterRequest,
    x_device_fingerprint: str | None = Header(None, alias="X-Device-Fingerprint"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register or refresh the current device.

    X-Device-Fingerprint is accepted during registration/rotation only.
    Authenticated application calls should use the returned X-Device-Tag value.
    """
    fingerprint_hash = x_device_fingerprint or body.fingerprint_hash
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(DeviceRegistration).where(
            DeviceRegistration.user_id == current_user.id,
            DeviceRegistration.fingerprint_hash == fingerprint_hash,
        )
    )
    device = result.scalar_one_or_none()
    if device is None:
        device = DeviceRegistration(
            user_id=current_user.id,
            device_tag=_make_device_tag(current_user.id, fingerprint_hash),
            fingerprint_hash=fingerprint_hash,
            metadata_json=body.metadata,
            user_agent=request.headers.get("user-agent"),
            created_at=now,
            last_seen_at=now,
        )
        db.add(device)
    else:
        device.metadata_json = body.metadata
        device.user_agent = request.headers.get("user-agent")
        device.last_seen_at = now
        device.is_active = True

    await db.commit()
    await db.refresh(device)
    return DeviceRegisterResponse(
        id=device.id,
        device_tag=device.device_tag,
        created_at=device.created_at,
        last_seen_at=device.last_seen_at,
    )
