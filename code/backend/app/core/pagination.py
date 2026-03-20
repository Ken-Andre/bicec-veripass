"""
Pagination helper — KISS MVP.

Usage:
    from app.core.pagination import paginate, PageParams, PageResponse

    @router.get("/items")
    async def list_items(page: PageParams = Depends(), db: AsyncSession = Depends(get_db)):
        query = select(MyModel).order_by(MyModel.created_at.desc())
        return await paginate(db, query, page)
"""
from typing import TypeVar, Generic, List, Type
from math import ceil

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PageParams:
    """Query params for pagination — injected via Depends()."""
    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
        limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.limit = limit

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class PageResponse(BaseModel, Generic[T]):
    """Unified paginated response — same structure on every list endpoint."""
    items: List[T]
    total: int
    page: int
    pages: int
    limit: int


async def paginate(db: AsyncSession, query, params: PageParams, schema: Type[T]) -> PageResponse[T]:
    """
    Execute a paginated SELECT query.

    Args:
        db:     async SQLAlchemy session
        query:  base SELECT statement (no limit/offset yet)
        params: PageParams (page + limit)
        schema: Pydantic model to serialise each row

    Returns:
        PageResponse with items, total, page, pages, limit
    """
    # Count total rows with same filters — wrap in subquery for safety
    count_q = select(func.count()).select_from(query.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    # Fetch the page
    rows = (await db.execute(query.offset(params.offset).limit(params.limit))).scalars().all()

    return PageResponse(
        items=[schema.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        pages=ceil(total / params.limit) if total else 1,
        limit=params.limit,
    )
