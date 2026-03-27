from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import get_current_agent, require_role
from app.db.session import get_db
from app.modules.auth.models import AgentRole

router = APIRouter()


@router.get("/")
async def get_root():
    return {"module": "aml", "status": "initialized"}


@router.post(
    "/screening",
    dependencies=[Depends(require_role(AgentRole.THOMAS, AgentRole.SYLVIE)), Depends(get_current_agent)],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def aml_screening(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """AML screening endpoint — PEP/Sanctions check.
    
    Access: THOMAS, SYLVIE
    """
    # TODO: Implement AML screening logic
    return {"status": "screening_completed"}
