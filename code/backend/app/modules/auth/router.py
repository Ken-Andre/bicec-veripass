from fastapi import APIRouter, Request
from app.core.rate_limit import limiter
from app.core.config import settings

router = APIRouter()

@router.get("/")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def get_root(request: Request):
    return {"module": "auth", "status": "initialized"}
