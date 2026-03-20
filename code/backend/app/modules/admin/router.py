"""Admin router — user management."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa — ensures all mappers are registered
from app.core.pagination import PageParams, PageResponse, paginate
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.admin.schemas import UserSchema

router = APIRouter()


@router.get("/")
async def get_root():
    return {"module": "admin", "status": "initialized"}


@router.get("/users", response_model=PageResponse[UserSchema])
async def list_users(
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Paginated user list — most recently created first."""
    query = select(User).order_by(User.created_at.desc())
    return await paginate(db, query, page, UserSchema)
