"""OTP generation and Redis-backed storage with TTL."""
import secrets
from typing import Optional
from app.core.redis import get_redis
from app.core.config import settings
from app.core.logging import logger

def generate_otp(length: int = 6) -> str:
    """Generate a high-entropy numeric OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


async def store_otp(identifier: str, otp: str, expire_minutes: int = settings.OTP_EXPIRY_MINUTES) -> bool:
    """
    Store OTP in Redis with a TTL.
    The key format is: otp:{identifier}
    """
    try:
        redis = await get_redis()
        key = f"otp:{identifier}"
        # Set with expiration in minutes -> convert to seconds
        await redis.setex(key, expire_minutes * 60, otp)
        return True
    except Exception as e:
        logger.error(f"Failed to store OTP for {identifier}: {e}")
        return False


async def verify_otp(identifier: str, otp_to_verify: str) -> bool:
    """
    Check if OTP matches the one in Redis. 
    Returns True if valid, False otherwise.
    Note: It does NOT delete the OTP on check (standard policy for retry window).
    """
    try:
        redis = await get_redis()
        key = f"otp:{identifier}"
        stored_otp = await redis.get(key)
        
        if stored_otp and stored_otp == otp_to_verify:
            return True
        return False
    except Exception as e:
        logger.error(f"Failed to verify OTP for {identifier}: {e}")
        return False


async def delete_otp(identifier: str):
    """Clean up OTP after successful login/check."""
    try:
        redis = await get_redis()
        await redis.delete(f"otp:{identifier}")
    except Exception as e:
        logger.error(f"Failed to delete OTP for {identifier}: {e}")
