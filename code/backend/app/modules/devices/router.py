"""Device registration API."""

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.devices.models import DeviceRegistration
from app.modules.devices.schemas import DeviceRegisterRequest, DeviceRegisterResponse
from app.modules.kyc.models import Notification

router = APIRouter()


def _make_device_tag(user_id: uuid.UUID, fingerprint_hash: str) -> str:
    digest = hashlib.sha256(f"{user_id}:{fingerprint_hash}".encode("utf-8")).hexdigest()
    return f"vp_dev_{digest[:48]}"


def _refresh_device(
    device: DeviceRegistration,
    *,
    metadata: dict[str, Any] | None,
    user_agent: str | None,
    now: datetime,
) -> DeviceRegistration:
    device.metadata_json = metadata
    device.user_agent = user_agent
    device.last_seen_at = now
    device.is_active = True
    return device


@router.post("/register", response_model=DeviceRegisterResponse)
async def register_device(
    request: Request,
    body: DeviceRegisterRequest,
    x_device_fingerprint: str | None = Header(None, alias="X-Device-Fingerprint"),
    x_device_tag: str | None = Header(None, alias="X-Device-Tag"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register or refresh the current device.

    X-Device-Fingerprint is accepted during registration/rotation only.
    Authenticated application calls should use the returned X-Device-Tag value.
    """
    fingerprint_hash = x_device_fingerprint or body.fingerprint_hash
    now = datetime.now(timezone.utc)
    device_tag = _make_device_tag(current_user.id, fingerprint_hash)
    user_agent = request.headers.get("user-agent")

    active_result = await db.execute(
        select(DeviceRegistration).where(
            DeviceRegistration.user_id == current_user.id,
            DeviceRegistration.is_active == True,  # noqa: E712
        )
    )
    active_devices = list(active_result.scalars().all())
    had_active_devices = len(active_devices) > 0

    # Assouplissement pour la démo : accepter un nouveau device même sans
    # X-Device-Tag si le user vient de se connecter (OTP/PIN). Le token JWT
    # suffit comme preuve d'authentification. On garde le 403 si le tag
    # fourni ne correspond à aucun device actif (tentative d'usurpation).
    if active_devices and x_device_tag:
        if x_device_tag not in {device.device_tag for device in active_devices}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device tag is not registered for this user.",
            )

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
            device_tag=device_tag,
            fingerprint_hash=fingerprint_hash,
            metadata_json=body.metadata,
            user_agent=user_agent,
            created_at=now,
            last_seen_at=now,
        )
        db.add(device)
    else:
        _refresh_device(
            device,
            metadata=body.metadata,
            user_agent=user_agent,
            now=now,
        )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(DeviceRegistration).where(
                DeviceRegistration.user_id == current_user.id,
                DeviceRegistration.device_tag == device_tag,
            )
        )
        device = result.scalar_one_or_none()
        if device is None:
            raise
        _refresh_device(
            device,
            metadata=body.metadata,
            user_agent=user_agent,
            now=now,
        )
        await db.commit()

    await db.refresh(device)

    # Notification "Nouvelle connexion détectée" si un autre device était déjà actif
    if had_active_devices:
        try:
            _ua = user_agent or "Appareil inconnu"
            _platform = "mobile" if "Mobile" in (_ua or "") else "desktop"
            notif = Notification(
                user_id=current_user.id,
                type="GENERAL",
                message=f"Nouvelle connexion détectée depuis {_platform} ({_ua[:60]}). Si ce n'est pas vous, changez votre PIN.",
            )
            db.add(notif)
            await db.commit()

            # Push notification de sécurité
            try:
                from app.modules.notifications.tasks import send_push_task
                send_push_task.delay(
                    str(current_user.id),
                    {
                        "title": "Nouvelle connexion détectée",
                        "body": f"Connexion depuis {_platform}. Si ce n'est pas vous, changez votre PIN.",
                        "tag": "security_new_device",
                    },
                )
            except Exception as exc:
                logger.warning("Failed to enqueue security push for new device: %s", exc)
        except Exception as exc:
            logger.warning("Failed to create security notification for new device: %s", exc)

    return DeviceRegisterResponse(
        id=device.id,
        device_tag=device.device_tag,
        created_at=device.created_at,
        last_seen_at=device.last_seen_at,
    )
