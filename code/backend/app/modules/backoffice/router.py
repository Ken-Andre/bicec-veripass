from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa — ensures all mappers (Agency, etc.) are registered
from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.pagination import PageParams, PageResponse, paginate
from app.db.session import get_db
from app.modules.kyc.models import KYCSession
from app.modules.audit.models import AuditLog
from app.modules.backoffice.schemas import KYCQueueItemSchema, AuditLogSchema

router = APIRouter()


@router.get("/")
async def get_root():
    return {"module": "backoffice", "status": "initialized"}


@router.get("/queue", response_model=PageResponse[KYCQueueItemSchema])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_queue(
    request: Request,
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated KYC session queue — sessions in PENDING or SUBMITTED status,
    most recent first, priority sessions first.
    """
    query = (
        select(KYCSession)
        .where(KYCSession.status.in_(["PENDING", "SUBMITTED", "DRAFT"]))
        .order_by(KYCSession.priority_flag.desc(), KYCSession.submitted_at.asc())
    )
    return await paginate(db, query, page, KYCQueueItemSchema)


@router.get("/audit-logs", response_model=PageResponse[AuditLogSchema])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_audit_logs(
    request: Request,
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Paginated audit log — most recent first."""
    query = select(AuditLog).order_by(AuditLog.performed_at.desc())
    return await paginate(db, query, page, AuditLogSchema)
