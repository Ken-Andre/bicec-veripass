"""Auth module Pydantic schemas."""

from typing import Optional, Annotated
from pydantic import BaseModel, Field, EmailStr, StringConstraints


# Reusable types for security enforcement
ConstrainedPhone = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, pattern=r"^\+?[1-9]\d{6,14}$", max_length=20
    ),
]
ConstrainedPin = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, pattern=r"^\d{6}$", min_length=6, max_length=6
    ),
]
ConstrainedOtp = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, pattern=r"^\d{6}$", min_length=6, max_length=6
    ),
]


class TokenResponse(BaseModel):
    """JWT token response.

    session_handle is an HMAC-SHA256 digest of the internal KYCSession DB id,
    keyed with JWT_SECRET. It is ephemeral and opaque — clients must treat it
    as an opaque string and never attempt to reverse it to a DB id.
    """

    access_token: str = Field(..., max_length=1024)
    refresh_token: str = Field(..., max_length=1024)
    token_type: str = Field("bearer", max_length=20)
    expires_in: int = Field(..., gt=0)
    session_handle: Optional[str] = Field(None, max_length=64)


class RefreshTokenRequest(BaseModel):
    """Refresh token request."""

    refresh_token: str = Field(..., max_length=1024)


class AgentLoginRequest(BaseModel):
    """Agent login request (back-office)."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserResponse(BaseModel):
    """User response schema."""

    model_config = {"from_attributes": True}

    id: str = Field(..., max_length=64)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=128)
    role: str = Field(..., max_length=20)
    language: str = Field(..., max_length=10)
    biometric_opt_in: bool
    has_pin: bool


class AgentResponse(BaseModel):
    """Agent response schema."""

    model_config = {"from_attributes": True}

    id: str = Field(..., max_length=64)
    name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=128)
    role: str = Field(..., max_length=20)
    is_available: bool
    active_dossier_count: int = Field(..., ge=0)


class PinSetupRequest(BaseModel):
    """PIN setup request."""

    pin: ConstrainedPin


class PinVerifyRequest(BaseModel):
    """PIN verification request."""

    phone: ConstrainedPhone
    pin: ConstrainedPin


class OtpSendRequest(BaseModel):
    """OTP send request."""

    phone: Optional[ConstrainedPhone] = None
    email: Optional[EmailStr] = None
    mode: str = Field(default="signup")  # "login" or "signup"


class OtpVerifyRequest(BaseModel):
    """OTP verification request."""

    phone: Optional[ConstrainedPhone] = None
    email: Optional[EmailStr] = None
    otp: ConstrainedOtp


class EmailOtpSendRequest(BaseModel):
    """Email OTP send request."""

    email: EmailStr


class EmailOtpVerifyRequest(BaseModel):
    """Email OTP verification request."""

    otp: ConstrainedOtp


class UserExistsCheckResponse(BaseModel):
    """User exists check response."""

    exists: bool
    has_pin: bool = False
    has_email: bool = False
    phone: Optional[str] = None
