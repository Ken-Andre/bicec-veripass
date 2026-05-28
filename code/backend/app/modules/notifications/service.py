"""Notification service helpers."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import email_client
from app.core.orange_sms import orange_sms
from app.core.logging import logger
from app.modules.auth.models import User
from app.modules.kyc.models import Notification
from app.modules.notifications.models import NotificationPreference


async def send_sms_notification(phone_number: str, message: str) -> Dict[str, Any]:
    """
    Send an SMS notification. Respects OTP_MODE for local development.
    """
    from app.core.config import settings

    otp_mode = os.environ.get("OTP_MODE", settings.OTP_MODE)
    if otp_mode == "dev_local":
        print("\n" + "=" * 50)
        print("DEBUG SMS [dev_local mode]")
        print(f"TO:      {phone_number}")
        print(f"MESSAGE: {message}")
        print("=" * 50 + "\n")

        logger.info(f"SIMULATED SMS to {phone_number}: {message[:20]}...")
        return {
            "status": "simulated",
            "mode": "dev_local",
            "phone_number": phone_number,
            "message_preview": message[:20] + "...",
        }

    try:
        result = await orange_sms.send_sms(phone_number, message)
        logger.info(
            f"SMS sent to {phone_number}: {result.get('outboundSMSMessageRequest', {}).get('resourceURL')}"
        )
        return result
    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_number}: {str(e)}")
        raise


def _payload_event_key(payload: dict[str, Any] | None) -> str | None:
    if not payload:
        return None
    event_key = payload.get("event_key")
    return str(event_key) if event_key else None


async def _find_existing_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    notification_type: str,
    event_key: str,
) -> Notification | None:
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.type == notification_type,
        )
        .order_by(Notification.sent_at.desc())
        .limit(25)
    )
    for notification in result.scalars().all():
        payload = notification.payload or {}
        if str(payload.get("event_key")) == event_key:
            return notification
    return None


async def _get_preference(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> NotificationPreference | None:
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _send_official_channel(
    *,
    user: User,
    preference: NotificationPreference | None,
    message: str,
    subject: str,
) -> str | None:
    official_channel = (
        preference.official_channel
        if preference is not None
        else ("email" if user.email else "sms")
    )
    if official_channel == "email" and user.email:
        try:
            sent = await email_client.send_email(
                to_email=user.email,
                subject=subject,
                content=message,
            )
            return "email" if sent else None
        except Exception as exc:
            logger.warning(
                "Official email notification failed",
                extra={"user_id": str(user.id), "error": str(exc)},
            )
            return None
    if official_channel == "sms" and user.phone:
        try:
            await send_sms_notification(user.phone, message)
            return "sms"
        except Exception as exc:
            logger.warning(
                "Official SMS notification failed",
                extra={"user_id": str(user.id), "error": str(exc)},
            )
            return None
    return None


async def create_user_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    notification_type: str,
    message: str,
    payload: dict[str, Any] | None = None,
    official: bool = False,
    subject: str = "Notification BICEC VeriPass",
) -> Notification | None:
    """Create an in-app notification and optionally send the official channel.

    `payload.event_key` is treated as an idempotency key per user/type.
    The caller owns the transaction and should commit after this function.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or getattr(user, "is_deleted", False):
        return None

    event_key = _payload_event_key(payload)
    if event_key:
        existing = await _find_existing_notification(
            db,
            user_id=user.id,
            notification_type=notification_type,
            event_key=event_key,
        )
        if existing is not None:
            return None

    preference = await _get_preference(db, user.id)
    in_app_enabled = True if preference is None else bool(preference.in_app_enabled)

    notification: Notification | None = None
    if in_app_enabled:
        notification = Notification(
            id=uuid.uuid4(),
            user_id=user.id,
            type=notification_type,
            message=message,
            payload=payload or {},
            sent_at=datetime.now(timezone.utc),
        )
        db.add(notification)

    if official:
        sent_channel = await _send_official_channel(
            user=user,
            preference=preference,
            message=message,
            subject=subject,
        )
        if notification is not None:
            notification.payload = {
                **(notification.payload or {}),
                "official_channel_sent": sent_channel,
            }

    return notification


async def create_global_notification(
    db: AsyncSession,
    *,
    notification_type: str,
    message: str,
    payload: dict[str, Any] | None = None,
    official: bool = True,
    subject: str = "Information officielle BICEC VeriPass",
) -> int:
    """Fan out a regulatory notification to all active client users."""
    result = await db.execute(
        select(User).where(
            User.role == "CLIENT",
            User.is_deleted == False,  # noqa: E712
        )
    )
    count = 0
    for user in result.scalars().all():
        created = await create_user_notification(
            db,
            user_id=user.id,
            notification_type=notification_type,
            message=message,
            payload=payload,
            official=official,
            subject=subject,
        )
        if created is not None:
            count += 1
    return count
