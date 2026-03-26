"""Redis async client and utilities — KISS Foundation."""
from typing import Optional

import redis.asyncio as redis

from app.core.config import settings
from app.core.logging import logger

# Global singleton client
# Initialisation is lazy or via lifespan
redis_client = None


# ============================================================
# REDIS KEY HELPERS — ADR-016 Namespaces
# ============================================================
# Centralized key construction to avoid typos and ensure
# consistent namespace usage across the codebase.
# ============================================================

def otp_key(identifier: str) -> str:
    """
    Redis key for OTP storage.
    Pattern: otp:{identifier} (phone or email)
    TTL: REDIS_OTP_TTL (300s / 5 min)
    """
    return f"otp:{identifier}"


def otp_attempts_key(identifier: str) -> str:
    """
    Redis key for OTP verification attempts counter.
    Pattern: otp_verify_attempts:{identifier}
    TTL: REDIS_OTP_ATTEMPTS_TTL (300s / 5 min)
    """
    return f"otp_verify_attempts:{identifier}"


def refresh_key(user_id: str, jti: str) -> str:
    """
    Redis key for refresh token tracking.
    Pattern: refresh:{user_id}:{jti}
    TTL: REDIS_REFRESH_TOKEN_TTL (604800s / 7 days)
    """
    return f"refresh:{user_id}:{jti}"


def ratelimit_key(scope: str, identifier: str) -> str:
    """
    Redis key for rate limiting counters.
    Pattern: ratelimit:{scope}:{identifier}
    Scopes: 'otp', 'auth', 'global'
    TTL: Varies by scope (see REDIS_RATELIMIT_*_TTL constants)
    """
    return f"ratelimit:{scope}:{identifier}"


def lock_key(resource: str, resource_id: Optional[str] = None) -> str:
    """
    Redis key for distributed locks.
    Pattern: lock:{resource}:{resource_id}
    TTL: Varies by resource (see REDIS_LOCK_*_TTL constants)
    """
    base = f"lock:{resource}"
    if resource_id:
        return f"{base}:{resource_id}"
    return base


def analytics_key(report: str) -> str:
    """
    Redis key for analytics dashboard cache.
    Pattern: analytics:{report}
    TTL: REDIS_ANALYTICS_CACHE_TTL (60s)
    """
    return f"analytics:{report}"


async def get_redis():
    """Returns the global redis client, initialising if needed."""
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                retry_on_timeout=True
            )
            # Basic ping test
            await redis_client.ping()
        except Exception as e:
            logger.error(f"Failed to connect to Redis at {settings.REDIS_URL}: {e}")
            raise e
    return redis_client


async def check_redis_connection() -> bool:
    """Helper for health checks."""
    try:
        client = await get_redis()
        return await client.ping()
    except Exception:
        return False
