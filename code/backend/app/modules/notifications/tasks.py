"""Celery tasks for push notification delivery."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from celery import shared_task
from httpx import TimeoutException, NetworkError

from app.core.logging import logger
from app.modules.notifications.push_sender import send_push_notification

_RETRYABLE = (TimeoutException, NetworkError, ConnectionError, OSError)


@shared_task(
    name="app.modules.notifications.tasks.send_push_task",
    queue="notifications",
    autoretry_for=_RETRYABLE,
    retry_kwargs={"max_retries": 2},
    retry_backoff=True,
)
def send_push_task(
    user_id: str,
    payload: dict[str, Any],
):
    """Send push notification to all active subscriptions for a user."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_send_push_flow(user_id, payload))
    except Exception as exc:
        logger.error("send_push_task failed for user %s: %s", user_id, exc)
        raise
    finally:
        loop.close()


async def _send_push_flow(user_id: str, payload: dict[str, Any]):
    from sqlalchemy import select
    from app.db.session import async_session_maker
    from app.modules.notifications.models import PushSubscription, NotificationPreference

    uid = uuid.UUID(user_id)

    async with async_session_maker() as db:
        pref_result = await db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == uid)
        )
        preference = pref_result.scalar_one_or_none()

        if preference is not None and not preference.push_enabled:
            logger.info(
                "Push disabled for user %s, skipping", user_id
            )
            return {"skipped": True, "reason": "push_disabled"}

        result = await db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == uid,
                PushSubscription.is_active == True,
            )
        )
        subscriptions = result.scalars().all()

        if not subscriptions:
            logger.info("No active push subscriptions for user %s", user_id)
            return {"skipped": True, "reason": "no_subscriptions"}

        sent_count = 0
        failed_count = 0

        for sub in subscriptions:
            success = send_push_notification(sub, payload)
            if success:
                sent_count += 1
            else:
                failed_count += 1

        await db.commit()

        logger.info(
            "Push sent for user %s: %d sent, %d failed",
            user_id, sent_count, failed_count,
        )

        return {"sent": sent_count, "failed": failed_count}
