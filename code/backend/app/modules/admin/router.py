from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa — ensures all mappers are registered
from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.pagination import PageParams, PageResponse, paginate
from app.core.security import get_current_agent, require_role
from app.db.session import get_db
from app.modules.auth.models import AgentRole, User
from app.modules.admin.schemas import UserSchema

router = APIRouter()


@router.get("/")
async def get_root():
    return {"module": "admin", "status": "initialized"}


@router.get(
    "/users",
    response_model=PageResponse[UserSchema],
    dependencies=[Depends(require_role(AgentRole.ADMIN_IT))],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_users(
    request: Request,
    current_agent: User = Depends(get_current_agent),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Paginated user list — most recently created first.
    
    Access: ADMIN_IT only
    """
    query = select(User).order_by(User.created_at.desc())
    return await paginate(db, query, page, UserSchema)
