from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User

async def get_active_kyc_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Stub implementation
    return {"id": "stub_id", "user_id": current_user.id}
