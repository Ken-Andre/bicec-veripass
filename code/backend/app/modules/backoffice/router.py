from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa — ensures all mappers (Agency, etc.) are registered
from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.pagination import PageParams, PageResponse, paginate
from app.core.security import get_current_agent, require_agent_role
from app.db.session import get_db
from app.modules.auth.models import AgentRole
from app.modules.kyc.models import KYCSession
from app.modules.audit.models import AuditLog
from app.modules.backoffice.schemas import KYCQueueItemSchema, AuditLogSchema

router = APIRouter()


@router.get("/")
async def get_root():
    return {"module": "backoffice", "status": "initialized"}


@router.get(
    "/queue",
    response_model=PageResponse[KYCQueueItemSchema],
    dependencies=[
        Depends(
            require_agent_role(
                AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT
            )
        )
    ],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_queue(
    request: Request,
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated KYC session queue — sessions in PENDING or SUBMITTED status,
    most recent first, priority sessions first.

    Access: JEAN, THOMAS, SYLVIE, ADMIN_IT
    """
    query = (
        select(KYCSession)
        .where(KYCSession.status.in_(["PENDING", "SUBMITTED", "DRAFT"]))
        .order_by(KYCSession.priority_flag.desc(), KYCSession.submitted_at.asc())
        # Eager-load `user` to avoid N+1 if schema exposes user fields.
        # Add further selectinload() calls here when new relations are needed.
        .options(selectinload(KYCSession.user))
    )
    return await paginate(db, query, page, KYCQueueItemSchema)


@router.get(
    "/audit-logs",
    response_model=PageResponse[AuditLogSchema],
    dependencies=[
        Depends(
            require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT)
        )
    ],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_audit_logs(
    request: Request,
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Paginated audit log — most recent first.

    Access: THOMAS, SYLVIE, ADMIN_IT
    """
    query = select(AuditLog).order_by(AuditLog.performed_at.desc())
    return await paginate(db, query, page, AuditLogSchema)
