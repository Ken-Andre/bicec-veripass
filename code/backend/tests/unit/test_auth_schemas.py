"""
Unit tests for auth Pydantic schemas — no DB or network required.
"""

import pytest
from pydantic import ValidationError

from app.modules.auth.schemas import (
    OtpSendRequest,
    TokenResponse,
    PinSetupRequest,
    AgentLoginRequest,
)


class TestOtpSendRequest:
    def test_valid_phone(self):
        req = OtpSendRequest(phone="+237612345678")
        assert req.phone == "+237612345678"

    def test_invalid_phone_short(self):
        with pytest.raises(ValidationError):
            OtpSendRequest(phone="123")

    def test_invalid_phone_letters(self):
        with pytest.raises(ValidationError):
            OtpSendRequest(phone="abc")


class TestTokenResponse:
    def test_valid_token_response(self):
        token = TokenResponse(
            access_token="abc123",
            refresh_token="def456",
            expires_in=3600,
        )
        assert token.token_type == "bearer"
        assert token.access_token == "abc123"


class TestPinSetupRequest:
    def test_valid_pin(self):
        # PIN is exactly 6 digits per ConstrainedPin schema
        req = PinSetupRequest(pin="123456")
        assert req.pin == "123456"

    def test_pin_too_short(self):
        with pytest.raises(ValidationError):
            PinSetupRequest(pin="123")  # min_length=6

    def test_pin_too_long(self):
        with pytest.raises(ValidationError):
            PinSetupRequest(pin="1234567")  # max_length=6

    def test_pin_non_numeric(self):
        with pytest.raises(ValidationError):
            PinSetupRequest(pin="abcdef")  # must match ^\d{6}$


class TestAgentLoginRequest:
    def test_valid_login(self):
        req = AgentLoginRequest(email="agent@bicec.cm", password="password123")
        assert req.email == "agent@bicec.cm"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            AgentLoginRequest(email="not-an-email", password="password123")
