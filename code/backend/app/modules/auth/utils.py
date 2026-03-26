"""OTP generation and Redis-backed storage with TTL."""
import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.redis import get_redis, otp_key
from app.core.config import settings
from app.core.logging import logger


def generate_otp(length: int = 6) -> str:
    """Generate a high-entropy numeric OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


async def store_otp(identifier: str, otp: str, expire_minutes: int = settings.OTP_EXPIRY_MINUTES) -> bool:
    """
    Store bcrypt-hashed OTP in Redis with a TTL.
    Defense-in-depth: even if Redis is compromised, raw OTPs are not exposed.
    """
    try:
        from app.core.security import hash_password
        redis = await get_redis()
        key = otp_key(identifier)
        otp_hash = hash_password(otp)
        await redis.setex(key, expire_minutes * 60, otp_hash)
        return True
    except Exception as e:
        logger.error(f"Failed to store OTP for {identifier}: {e}")
        return False


async def verify_otp(identifier: str, otp_to_verify: str) -> bool:
    """
    Verify OTP against its bcrypt hash stored in Redis.
    Returns True if valid, False otherwise.
    Does NOT delete the OTP on check — caller must call delete_otp() after success.
    """
    try:
        from app.core.security import verify_password
        redis = await get_redis()
        key = otp_key(identifier)
        stored_hash = await redis.get(key)

        if stored_hash is None:
            return False
        # Redis returns bytes — decode to str for bcrypt
        if isinstance(stored_hash, bytes):
            stored_hash = stored_hash.decode("utf-8")
        return verify_password(otp_to_verify, stored_hash)
    except Exception as e:
        logger.error(f"Failed to verify OTP for {identifier}: {e}")
        return False


async def delete_otp(identifier: str) -> None:
    """Delete OTP from Redis after successful verification."""
    try:
        redis = await get_redis()
        await redis.delete(otp_key(identifier))
    except Exception as e:
        logger.error(f"Failed to delete OTP for {identifier}: {e}")


async def mark_otp_session_used(
    db: AsyncSession,
    identifier: str,
    is_phone: bool = True,
) -> None:
    """
    Mark the most recent unused OTPSession record as used in the DB audit trail.
    Looks up by phone or email depending on is_phone flag.
    """
    from app.modules.auth.models import OTPSession

    try:
        col = OTPSession.phone if is_phone else OTPSession.email
        result = await db.execute(
            select(OTPSession)
            .where(col == identifier, OTPSession.is_used == False)  # noqa: E712
            .order_by(OTPSession.created_at.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()
        if session:
            session.is_used = True
            session.used_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to mark OTPSession used for {identifier}: {e}")


async def increment_otp_attempts(
    db: AsyncSession,
    identifier: str,
    is_phone: bool = True,
) -> None:
    """Increment the attempts counter on the most recent unused OTPSession."""
    from app.modules.auth.models import OTPSession

    try:
        col = OTPSession.phone if is_phone else OTPSession.email
        result = await db.execute(
            select(OTPSession)
            .where(col == identifier, OTPSession.is_used == False)  # noqa: E712
            .order_by(OTPSession.created_at.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()
        if session:
            session.attempts = (session.attempts or 0) + 1
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to increment OTP attempts for {identifier}: {e}")
