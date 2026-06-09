"""Module Audit API Routes."""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import require_agent_role
from app.db.session import get_db
from app.modules.auth.models import AgentRole
from app.modules.audit import service
from app.modules.audit.schemas import AuditEntryResponse

router = APIRouter()


@router.get("/")
async def get_root(_agent=Depends(require_agent_role(AgentRole.ADMIN_IT, AgentRole.SYLVIE))):
    return {"module": "audit", "status": "active"}


@router.get("/audit-log", response_model=list[AuditEntryResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_audit_log(
    request: Request,
    session_id: str | None = None,
    agent_id: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.ADMIN_IT, AgentRole.SYLVIE)),
):
    """
    Récupère le journal d'audit avec filtres optionnels.
    Access: ADMIN_IT, SYLVIE
    """
    entries = await service.get_audit_log(db, session_id, agent_id, limit)
    return entries


@router.post("/audit-log/export-cobac")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def export_audit_log_cobac(
    request: Request,
    date_from: str,
    date_to: str,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    """
    Export du journal d'audit pour le régulateur COBAC.
    Access: SYLVIE, ADMIN_IT
    """
    entries = await service.export_audit_log_cobac(
        db,
        date_from,
        date_to,
        performed_by=getattr(_agent, "id", None),
        client_ip=request.client.host if request.client else None,
    )
    report = service.build_cobac_audit_report_html(
        entries,
        date_from=date_from,
        date_to=date_to,
        generated_by=getattr(_agent, "name", None),
    )
    filename = f"rapport-cobac-audit-{date_to}.html"
    return Response(
        content=report,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
