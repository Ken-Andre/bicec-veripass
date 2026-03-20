"""Redis async client and utilities — KISS Foundation."""
import redis.asyncio as redis
from app.core.config import settings
from app.core.logging import logger

# Global singleton client
# Initialisation is lazy or via lifespan
redis_client = None


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
