"""Web Push notification sender using pywebpush."""

from __future__ import annotations

import json
from typing import Any

from pywebpush import webpush, WebPushException

from app.core.config import settings
from app.core.logging import logger
from app.modules.notifications.models import PushSubscription


def _build_vapid_claims() -> dict[str, str]:
    return {"sub": settings.VAPID_CLAIMS_EMAIL or "mailto:admin@bicec.cm"}


def send_push_notification(
    subscription: PushSubscription,
    payload: dict[str, Any],
) -> bool:
    """Send a web push notification to a single subscription.

    Returns True on success, False on failure.
    On 410 Gone the subscription is deactivated automatically.
    """
    if not subscription.is_active:
        return False

    if not subscription.endpoint:
        logger.warning("Push subscription %s has no endpoint", subscription.id)
        return False

    private_key = settings.VAPID_PRIVATE_KEY
    if not private_key:
        logger.error("VAPID_PRIVATE_KEY is not configured")
        return False

    sub_info = {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        },
    }

    try:
        webpush(
            subscription_info=sub_info,
            data=json.dumps(payload),
            vapid_private_key=private_key,
            vapid_claims=_build_vapid_claims(),
        )
        return True

    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None

        if status == 410:
            logger.info(
                "Push subscription %s expired (410 Gone), deactivating",
                subscription.id,
            )
            subscription.is_active = False
            subscription.last_error = "410 Gone — subscription expired"
        else:
            logger.warning(
                "Push send failed for subscription %s: HTTP %s %s",
                subscription.id,
                status,
                exc,
            )
            subscription.last_error = f"HTTP {status}: {exc}"

        return False

    except Exception as exc:
        logger.error(
            "Unexpected push send error for subscription %s: %s",
            subscription.id,
            exc,
        )
        subscription.last_error = f"unexpected: {exc}"
        return False
