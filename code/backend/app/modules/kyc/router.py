from fastapi import APIRouter, Request, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import get_current_user, make_session_handle
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.kyc.models import KYCSession
from app.modules.kyc.schemas import KYCSessionResponse

router = APIRouter()

@router.get("/")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_root(request: Request):
    return {"module": "kyc", "status": "initialized"}

@router.get("/session/current", response_model=KYCSessionResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_current_session(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current active KYC session for the user."""
    result = await db.execute(
        select(KYCSession).where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(["DRAFT", "PENDING_INFO", "LOCKED_LIVENESS"])
        ).order_by(KYCSession.started_at.desc())
    )
    kyc_session = result.scalars().first()
    
    if not kyc_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active KYC session found.",
        )
        
    return KYCSessionResponse(
        id=make_session_handle(str(kyc_session.id)),
        status=kyc_session.status,
        last_step_completed=kyc_session.last_step_completed,
        started_at=kyc_session.started_at,
        user_id=str(kyc_session.user_id)
    )
