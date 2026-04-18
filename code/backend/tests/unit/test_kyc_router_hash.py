"""Unit tests for KYC router helpers used by story-aligned upload contracts."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.kyc.router import (
    _is_valid_sha256,
    _locked_liveness_response,
    _normalize_sha256,
    _normalize_capture_side,
    _reset_user_lockout_window_if_needed,
)


def test_normalize_sha256_trims_and_lowercases():
    raw = "  AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899  "
    normalized = _normalize_sha256(raw)
    assert normalized == "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"


def test_is_valid_sha256_accepts_64_hex_chars():
    assert _is_valid_sha256("a" * 64) is True
    assert _is_valid_sha256("ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789") is True


def test_is_valid_sha256_rejects_invalid_values():
    assert _is_valid_sha256("a" * 63) is False
    assert _is_valid_sha256("g" * 64) is False
    assert _is_valid_sha256("not-a-hash") is False


def test_normalize_capture_side_accepts_recto_verso_case_insensitive():
    assert _normalize_capture_side("recto") == "RECTO"
    assert _normalize_capture_side("VERSO") == "VERSO"


def test_normalize_capture_side_rejects_invalid_side():
    with pytest.raises(HTTPException):
        _normalize_capture_side("front")


def test_reset_user_lockout_window_resets_after_24h():
    user = SimpleNamespace(
        liveness_lockout_count_24h=2,
        last_lockout_reset_at=datetime.now(timezone.utc) - timedelta(hours=25),
    )
    _reset_user_lockout_window_if_needed(user)
    assert user.liveness_lockout_count_24h == 0
    assert isinstance(user.last_lockout_reset_at, datetime)


def test_reset_user_lockout_window_keeps_recent_counter():
    reset_at = datetime.now(timezone.utc) - timedelta(hours=2)
    user = SimpleNamespace(
        liveness_lockout_count_24h=2,
        last_lockout_reset_at=reset_at,
    )
    _reset_user_lockout_window_if_needed(user)
    assert user.liveness_lockout_count_24h == 2
    assert user.last_lockout_reset_at == reset_at


def test_locked_liveness_response_contains_lockout_metadata():
    res = _locked_liveness_response(lockout_count_24h=3)
    assert res.is_alive is False
    assert res.is_locked is True
    assert res.cooldown_seconds == 60
    assert res.lockout_count_24h == 3
    assert res.branch_fallback_available is True
