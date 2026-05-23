"""Redis async client and utilities  KISS Foundation.

Security threat model (ADR-016):
- Redis is bound to the private Docker network (veripass-net) only.
  It is NOT exposed to the public internet.
- Redis AUTH password is required in production (set REDIS_URL with credentials).
- All data in transit between containers uses the Docker bridge network.
  For production deployments outside Docker, enable Redis TLS (rediss://).
- Key names use human-readable prefixes (otp:, refresh:, lock:) which is
  acceptable because Redis is only reachable from within the private network.
  If Redis were ever exposed, identifiers should be HMAC-hashed before use as keys.
- decode_responses=True is set globally so all get() calls return str, never bytes.
"""

from typing import Optional
from urllib.parse import urlparse

import redis.asyncio as redis

from app.core.config import settings
from app.core.logging import logger

# Global singleton client  lazy-initialised on first request
redis_client = None


# ============================================================
# REDIS KEY HELPERS  ADR-016 Namespaces
# ============================================================


def otp_key(identifier: str) -> str:
    """otp:{identifier}  TTL: REDIS_OTP_TTL"""
    return f"otp:{identifier}"


def otp_attempts_key(identifier: str) -> str:
    """otp_verify_attempts:{identifier}  TTL: REDIS_OTP_ATTEMPTS_TTL"""
    return f"otp_verify_attempts:{identifier}"


def refresh_key(user_id: str, jti: str) -> str:
    """refresh:{user_id}:{jti}  TTL: REDIS_REFRESH_TOKEN_TTL"""
    return f"refresh:{user_id}:{jti}"


def ratelimit_key(scope: str, identifier: str) -> str:
    """ratelimit:{scope}:{identifier}  scopes: otp, auth, global"""
    return f"ratelimit:{scope}:{identifier}"


def lock_key(resource: str, resource_id: Optional[str] = None) -> str:
    """lock:{resource}[:{resource_id}]  distributed lock"""
    base = f"lock:{resource}"
    if resource_id:
        return f"{base}:{resource_id}"
    return base


def analytics_key(report: str) -> str:
    """analytics:{report}  TTL: REDIS_ANALYTICS_CACHE_TTL"""
    return f"analytics:{report}"


async def get_redis():
    """
    Returns the global Redis client, initialising if needed.
    decode_responses=True ensures all values are returned as str (never bytes).
    """
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                retry_on_timeout=True,
            )
            await redis_client.ping()
        except Exception as e:
            # Parse and redact credentials from Redis URL to avoid logging passwords
            parsed_url = urlparse(settings.REDIS_URL)
            # Rebuild URL without credentials
            if parsed_url.hostname and parsed_url.port:
                redacted_url = f"{parsed_url.scheme}://***:***@{parsed_url.hostname}:{parsed_url.port}{parsed_url.path}"
            else:
                redacted_url = (
                    f"{parsed_url.scheme}://***:***@localhost:6379{parsed_url.path}"
                )
            logger.error(f"Failed to connect to Redis at {redacted_url}: {e}")
            raise ConnectionError(f"Redis connection failed: {type(e).__name__}") from e
    return redis_client


async def check_redis_connection() -> bool:
    """Helper for health checks."""
    try:
        client = await get_redis()
        return await client.ping()
    except Exception:
        return False
