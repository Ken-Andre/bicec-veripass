"""
Unit tests for OTP Redis storage, anti-replay, and rate-limiting logic.
All Redis calls are mocked — no real Redis required.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_redis(stored_hash: str | None = None):
    """Return a mock Redis client pre-configured for OTP tests."""
    r = AsyncMock()
    r.get = AsyncMock(return_value=stored_hash)
    r.set = AsyncMock(return_value=True)
    r.setex = AsyncMock(return_value=True)
    r.delete = AsyncMock(return_value=1)
    r.incr = AsyncMock(return_value=1)
    r.expire = AsyncMock(return_value=True)
    return r


# ---------------------------------------------------------------------------
# store_otp
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_store_otp_sets_key_with_ttl():
    redis = _make_redis()
    with patch("app.modules.auth.utils.get_redis", return_value=redis), \
         patch("app.core.security.hash_password", return_value="hashed"):
        from app.modules.auth.utils import store_otp
        from app.core.config import settings
        result = await store_otp("237600000000", "123456")

    assert result is True
    redis.set.assert_awaited_once()
    call_kwargs = redis.set.call_args
    assert call_kwargs[0][0] == "otp:237600000000"
    assert call_kwargs[0][1] == "hashed"
    assert call_kwargs[1].get("ex") == settings.REDIS_OTP_TTL  # 600s per ADR-016


@pytest.mark.asyncio
async def test_store_otp_returns_false_on_redis_error():
    redis = _make_redis()
    redis.set = AsyncMock(side_effect=Exception("connection refused"))
    with patch("app.modules.auth.utils.get_redis", return_value=redis), \
         patch("app.core.security.hash_password", return_value="hashed"):
        from app.modules.auth.utils import store_otp
        result = await store_otp("237600000000", "123456")

    assert result is False


# ---------------------------------------------------------------------------
# verify_otp_atomic — anti-replay
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_otp_atomic_success_deletes_key():
    """Valid OTP: key is deleted inside the lock (anti-replay)."""
    redis = _make_redis(stored_hash="hashed_otp")
    redis.set = AsyncMock(return_value=True)  # lock acquired

    with patch("app.modules.auth.utils.get_redis", return_value=redis), \
         patch("app.core.security.verify_password", return_value=True):
        from app.modules.auth.utils import verify_otp_atomic
        result = await verify_otp_atomic("237600000000", "123456")

    assert result is True
    # OTP key deleted inside lock
    redis.delete.assert_any_await("otp:237600000000")
    # Lock released
    redis.delete.assert_any_await("lock:otp_verify:237600000000")


@pytest.mark.asyncio
async def test_verify_otp_atomic_wrong_otp_does_not_delete():
    """Wrong OTP: key must NOT be deleted (OTP still valid for retry)."""
    redis = _make_redis(stored_hash="hashed_otp")
    redis.set = AsyncMock(return_value=True)

    with patch("app.modules.auth.utils.get_redis", return_value=redis), \
         patch("app.core.security.verify_password", return_value=False):
        from app.modules.auth.utils import verify_otp_atomic
        result = await verify_otp_atomic("237600000000", "000000")

    assert result is False
    # OTP key must NOT have been deleted
    deleted_keys = [call.args[0] for call in redis.delete.call_args_list]
    assert "otp:237600000000" not in deleted_keys


@pytest.mark.asyncio
async def test_verify_otp_atomic_no_otp_in_redis():
    """No OTP stored (expired or already consumed) → False."""
    redis = _make_redis(stored_hash=None)
    redis.set = AsyncMock(return_value=True)

    with patch("app.modules.auth.utils.get_redis", return_value=redis):
        from app.modules.auth.utils import verify_otp_atomic
        result = await verify_otp_atomic("237600000000", "123456")

    assert result is False


@pytest.mark.asyncio
async def test_verify_otp_atomic_lock_contention_returns_false():
    """If lock cannot be acquired (concurrent request), return False immediately."""
    redis = _make_redis(stored_hash="hashed_otp")
    redis.set = AsyncMock(return_value=None)  # lock NOT acquired (nx=True failed)

    with patch("app.modules.auth.utils.get_redis", return_value=redis):
        from app.modules.auth.utils import verify_otp_atomic
        result = await verify_otp_atomic("237600000000", "123456")

    assert result is False
    # Should not have tried to read the OTP key
    redis.get.assert_not_awaited()


# ---------------------------------------------------------------------------
# Attempt counter (rate-limiting storage backend)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_increment_redis_otp_attempts_increments_and_sets_ttl():
    redis = _make_redis()
    redis.incr = AsyncMock(return_value=2)

    with patch("app.modules.auth.utils.get_redis", return_value=redis):
        from app.modules.auth.utils import increment_redis_otp_attempts
        count = await increment_redis_otp_attempts("237600000000")

    assert count == 2
    redis.incr.assert_awaited_once_with("otp_verify_attempts:237600000000")
    redis.expire.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_otp_attempts_returns_zero_when_no_key():
    redis = _make_redis(stored_hash=None)
    redis.get = AsyncMock(return_value=None)

    with patch("app.modules.auth.utils.get_redis", return_value=redis):
        from app.modules.auth.utils import get_otp_attempts
        count = await get_otp_attempts("237600000000")

    assert count == 0


@pytest.mark.asyncio
async def test_get_otp_attempts_returns_current_count():
    redis = _make_redis()
    redis.get = AsyncMock(return_value="2")

    with patch("app.modules.auth.utils.get_redis", return_value=redis):
        from app.modules.auth.utils import get_otp_attempts
        count = await get_otp_attempts("237600000000")

    assert count == 2


@pytest.mark.asyncio
async def test_reset_otp_attempts_deletes_key():
    redis = _make_redis()

    with patch("app.modules.auth.utils.get_redis", return_value=redis):
        from app.modules.auth.utils import reset_otp_attempts
        await reset_otp_attempts("237600000000")

    redis.delete.assert_awaited_once_with("otp_verify_attempts:237600000000")


# ---------------------------------------------------------------------------
# OTP_MAX_ATTEMPTS constant
# ---------------------------------------------------------------------------

def test_otp_max_attempts_is_three():
    from app.modules.auth.utils import OTP_MAX_ATTEMPTS
    assert OTP_MAX_ATTEMPTS == 3
