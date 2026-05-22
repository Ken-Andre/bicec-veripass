"""Notification and Web Push subscription API."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.kyc.models import Notification
from app.modules.notifications.models import PushSubscription
from app.modules.notifications.schemas import (
    NotificationListResponse,
    NotificationReadRequest,
    NotificationResponse,
    PushSubscriptionCreate,
    PushSubscriptionResponse,
)

router = APIRouter()


def _notification_title(notification_type: str) -> str:
    titles = {
        "KYC_APPROVED": "Dossier valide",
        "KYC_REJECTED": "Dossier rejete",
        "KYC_INFO_REQUESTED": "Information demandee",
        "SUPPORT_MESSAGE": "Nouveau message support",
        "GENERAL": "Notification",
    }
    return titles.get(notification_type, notification_type.replace("_", " ").title())


def _to_notification_response(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        type=notification.type,
        title=_notification_title(notification.type),
        message=notification.message,
        read=bool(notification.is_read),
        created_at=notification.sent_at,
        metadata=notification.payload,
    )


@router.get("", response_model=NotificationListResponse)
@router.get("/", response_model=NotificationListResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def list_notifications(
    request: Request,
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List notifications for the authenticated mobile user."""
    filters = [Notification.user_id == current_user.id]
    if unread_only:
        filters.append(Notification.is_read == False)  # noqa: E712

    result = await db.execute(
        select(Notification)
        .where(*filters)
        .order_by(Notification.sent_at.desc())
        .limit(limit)
    )
    notifications = result.scalars().all()

    unread_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    unread_count = int(unread_result.scalar_one() or 0)

    return NotificationListResponse(
        items=[_to_notification_response(item) for item in notifications],
        unread_count=unread_count,
    )


@router.post("/read")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def mark_notifications_read(
    request: Request,
    body: NotificationReadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark selected notifications, or all notifications, as read."""
    if not body.mark_all and not body.notification_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide notification_ids or mark_all=true.",
        )

    now = datetime.now(timezone.utc)
    stmt = (
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .where(Notification.is_read == False)  # noqa: E712
        .values(is_read=True, read_at=now)
    )
    if not body.mark_all:
        stmt = stmt.where(Notification.id.in_(body.notification_ids or []))

    result = await db.execute(stmt)
    await db.commit()
    return {"status": "success", "marked_read": result.rowcount or 0}


@router.get("/subscriptions", response_model=list[PushSubscriptionResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def list_push_subscriptions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active Web Push subscriptions for the authenticated user."""
    result = await db.execute(
        select(PushSubscription)
        .where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.is_active == True,  # noqa: E712
        )
        .order_by(PushSubscription.created_at.desc())
    )
    return [
        PushSubscriptionResponse(
            id=item.id,
            endpoint=item.endpoint,
            device_tag=item.device_tag,
            is_active=item.is_active,
            created_at=item.created_at,
        )
        for item in result.scalars().all()
    ]


@router.post("/subscriptions", response_model=PushSubscriptionResponse, status_code=201)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def create_push_subscription(
    request: Request,
    body: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or refresh a Web Push subscription."""
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == body.endpoint,
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        subscription = PushSubscription(
            user_id=current_user.id,
            endpoint=body.endpoint,
            p256dh=body.keys.p256dh,
            auth=body.keys.auth,
        )
        db.add(subscription)

    subscription.p256dh = body.keys.p256dh
    subscription.auth = body.keys.auth
    subscription.user_agent = body.user_agent or request.headers.get("user-agent")
    subscription.device_tag = body.device_tag
    subscription.subscription_metadata = body.metadata
    subscription.is_active = True
    subscription.last_error = None

    await db.commit()
    await db.refresh(subscription)
    return PushSubscriptionResponse(
        id=subscription.id,
        endpoint=subscription.endpoint,
        device_tag=subscription.device_tag,
        is_active=subscription.is_active,
        created_at=subscription.created_at,
    )


@router.delete("/subscriptions/{subscription_id}", status_code=204)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def delete_push_subscription(
    request: Request,
    subscription_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a Web Push subscription."""
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.id == subscription_id,
            PushSubscription.user_id == current_user.id,
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    subscription.is_active = False
    await db.commit()
    return None
