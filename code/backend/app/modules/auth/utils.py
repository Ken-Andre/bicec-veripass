"""OTP generation and Redis-backed storage with TTL."""
import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.redis import get_redis, otp_key, otp_attempts_key, lock_key
from app.core.config import settings
from app.core.logging import logger

# Maximum failed OTP verification attempts before lockout
OTP_MAX_ATTEMPTS = 3


def generate_otp(length: int = 6) -> str:
    """Generate a high-entropy numeric OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


async def store_otp(identifier: str, otp: str, expire_seconds: int = settings.REDIS_OTP_TTL) -> bool:
    """
    Store bcrypt-hashed OTP in Redis with a TTL.
    Uses SET ... EX (not deprecated SETEX) per ADR-016 R3.
    Defense-in-depth: even if Redis is compromised, raw OTPs are not exposed.
    """
    try:
        from app.core.security import hash_password
        redis = await get_redis()
        key = otp_key(identifier)
        otp_hash = hash_password(otp)
        await redis.set(key, otp_hash, ex=expire_seconds)
        return True
    except Exception as e:
        logger.exception(f"Failed to store OTP for {identifier}: {e}")
        return False


async def get_otp_attempts(identifier: str) -> int:
    """Return current failed attempt count for an identifier (0 if none)."""
    try:
        redis = await get_redis()
        val = await redis.get(otp_attempts_key(identifier))
        # decode_responses=True on client, but guard defensively
        if val is None:
            return 0
        if isinstance(val, bytes):
            val = val.decode("utf-8")
        return int(val)
    except Exception as e:
        logger.exception(f"Failed to get OTP attempts for {identifier}: {e}")
        return 0


async def increment_redis_otp_attempts(identifier: str) -> int:
    """
    Increment the Redis-backed failed attempt counter.
    TTL is reset on each increment to keep the window sliding.
    Returns the new attempt count.
    """
    try:
        redis = await get_redis()
        key = otp_attempts_key(identifier)
        count = await redis.incr(key)
        # Refresh TTL on every increment (sliding window)
        await redis.expire(key, settings.REDIS_OTP_ATTEMPTS_TTL)
        return count
    except Exception as e:
        logger.exception(f"Failed to increment Redis OTP attempts for {identifier}: {e}")
        return 0


async def reset_otp_attempts(identifier: str) -> None:
    """Clear the attempt counter after a successful verification."""
    try:
        redis = await get_redis()
        await redis.delete(otp_attempts_key(identifier))
    except Exception as e:
        logger.exception(f"Failed to reset OTP attempts for {identifier}: {e}")


async def verify_otp_atomic(identifier: str, otp_to_verify: str) -> bool:
    """
    Atomically verify OTP and delete it from Redis on success.

    Anti-replay guarantee: a distributed lock prevents concurrent verification
    attempts on the same identifier. The OTP key is deleted inside the lock
    before the lock is released, so a replayed request will find no OTP.

    Returns True if valid (and OTP is consumed), False otherwise.
    """
    from app.core.security import verify_password

    lock = lock_key("otp_verify", identifier)
    redis = await get_redis()

    # Acquire a short-lived distributed lock (5 s is more than enough for bcrypt)
    acquired = await redis.set(lock, "1", nx=True, ex=5)
    if not acquired:
        # Another request is already verifying this OTP  treat as failure
        logger.warning(f"OTP verify lock contention for {identifier}")
        return False

    try:
        key = otp_key(identifier)
        stored_hash = await redis.get(key)

        if stored_hash is None:
            return False

        # decode_responses=True on client, but guard defensively
        if isinstance(stored_hash, bytes):
            stored_hash = stored_hash.decode("utf-8")

        if not verify_password(otp_to_verify, stored_hash):
            return False

        # Valid  delete immediately inside the lock (anti-replay)
        await redis.delete(key)
        return True
    except Exception as e:
        logger.exception(f"Failed to atomically verify OTP for {identifier}: {e}")
        return False
    finally:
        await redis.delete(lock)


async def delete_otp(identifier: str) -> bool:
    """
    Delete OTP from Redis (kept for backward compat; prefer verify_otp_atomic).
    Returns True on success, False on failure so callers can react.
    """
    try:
        redis = await get_redis()
        await redis.delete(otp_key(identifier))
        return True
    except Exception as e:
        # Use logger.exception to capture full stacktrace for diagnostics
        logger.exception(f"Failed to delete OTP for {identifier}: {e}")
        return False


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
        logger.exception(f"Failed to mark OTPSession used for {identifier}: {e}")


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
        logger.exception(f"Failed to increment OTP attempts for {identifier}: {e}")
