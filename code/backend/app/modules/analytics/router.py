from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import get_current_agent, require_agent_role
from app.db.session import get_db
from app.modules.auth.models import AgentRole

from app.modules.analytics import service as analytics_service

router = APIRouter()


@router.get("/")
async def get_root():
    return {"module": "analytics", "status": "initialized"}


@router.get("/dashboard")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_dashboard(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    """Analytics dashboard — KPIs, funnel metrics, agent performance.

    Access: SYLVIE, ADMIN_IT
    """
    stats = await analytics_service.get_dashboard_stats(db)
    return stats
