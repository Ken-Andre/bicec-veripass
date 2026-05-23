"""
Unit tests for security utilities: JWT, password hashing, session handles.
No database or Redis required — pure function tests.
"""

from datetime import timedelta

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    make_session_handle,
    verify_session_handle,
)


class TestPasswordHashing:
    def test_hash_differs_from_plaintext(self):
        hashed = hash_password("TestPassword123")
        assert hashed != "TestPassword123"
        assert len(hashed) > 20  # bcrypt ~60 chars

    def test_verify_correct_password(self):
        pw = "MySecurePass456"
        assert verify_password(pw, hash_password(pw)) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("CorrectPassword")
        assert verify_password("WrongPassword", hashed) is False

    def test_unique_salts_per_hash(self):
        """bcrypt must produce different hashes for the same input (different salts)."""
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2


class TestJWTAccessToken:
    def test_contains_subject(self):
        token = create_access_token(subject="user-123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"

    def test_additional_claims_included(self):
        token = create_access_token(
            subject="agent-456",
            additional_claims={"role": "JEAN", "user_type": "agent"},
        )
        payload = decode_token(token)
        assert payload["role"] == "JEAN"
        assert payload["user_type"] == "agent"

    def test_unknown_claims_dropped(self):
        """Claims not in the allowlist must be silently dropped."""
        token = create_access_token(
            subject="agent-456",
            additional_claims={"role": "JEAN", "injected_field": "evil"},
        )
        payload = decode_token(token)
        assert "injected_field" not in payload

    def test_custom_expiry(self):
        token = create_access_token(subject="u", expires_delta=timedelta(hours=1))
        payload = decode_token(token)
        assert payload is not None

    def test_expired_token_returns_none(self):
        token = create_access_token(subject="u", expires_delta=timedelta(seconds=-1))
        assert decode_token(token) is None

    def test_invalid_token_returns_none(self):
        assert decode_token("invalid.token.here") is None

    def test_tampered_token_returns_none(self):
        token = create_access_token(subject="user-123")
        tampered = token[:-5] + "XXXXX"
        assert decode_token(tampered) is None


class TestJWTRefreshToken:
    def test_type_is_refresh(self):
        token = create_refresh_token(subject="user-789")
        payload = decode_token(token)
        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-789"

    def test_has_jti(self):
        """Refresh token must include a jti for revocation tracking."""
        token = create_refresh_token(subject="user-789")
        payload = decode_token(token)
        assert "jti" in payload
        assert len(payload["jti"]) > 0

    def test_jti_unique_per_token(self):
        t1 = create_refresh_token(subject="u")
        t2 = create_refresh_token(subject="u")
        p1 = decode_token(t1)
        p2 = decode_token(t2)
        assert p1["jti"] != p2["jti"]


class TestSessionHandle:
    def test_handle_differs_from_db_id(self):
        db_id = "123e4567-e89b-12d3-a456-426614174000"
        handle = make_session_handle(db_id)
        assert handle != db_id

    def test_verify_correct_handle(self):
        db_id = "123e4567-e89b-12d3-a456-426614174000"
        handle = make_session_handle(db_id)
        assert verify_session_handle(handle, db_id) is True

    def test_verify_wrong_handle(self):
        db_id = "123e4567-e89b-12d3-a456-426614174000"
        assert verify_session_handle("bad-handle", db_id) is False

    def test_verify_wrong_db_id(self):
        db_id = "123e4567-e89b-12d3-a456-426614174000"
        handle = make_session_handle(db_id)
        assert (
            verify_session_handle(handle, "999e4567-e89b-12d3-a456-426614174999")
            is False
        )

    def test_deterministic(self):
        """Same db_id must always produce the same handle."""
        db_id = "abc-123"
        assert make_session_handle(db_id) == make_session_handle(db_id)
