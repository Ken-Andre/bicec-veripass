"""Auth module Pydantic schemas."""
from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    """Refresh token request."""
    refresh_token: str


class AgentLoginRequest(BaseModel):
    """Agent login request (back-office)."""
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    """User response schema."""
    model_config = {"from_attributes": True}
    
    id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    language: str
    biometric_opt_in: bool


class AgentResponse(BaseModel):
    """Agent response schema."""
    model_config = {"from_attributes": True}
    
    id: str
    name: str
    email: str
    role: str
    is_available: bool
    active_dossier_count: int


class PinSetupRequest(BaseModel):
    """PIN setup request."""
    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d+$")


class PinVerifyRequest(BaseModel):
    """PIN verification request."""
    phone: str = Field(..., pattern=r"^\+?[1-9]\d{6,14}$")
    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d+$")


class OtpSendRequest(BaseModel):
    """OTP send request."""
    phone: str = Field(..., pattern=r"^\+?[1-9]\d{6,14}$", description="E.164 format phone number")


class OtpVerifyRequest(BaseModel):
    """OTP verification request."""
    phone: str = Field(..., pattern=r"^\+?[1-9]\d{6,14}$")
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d+$")


class EmailOtpSendRequest(BaseModel):
    """Email OTP send request."""
    email: EmailStr


class EmailOtpVerifyRequest(BaseModel):
    """Email OTP verification request."""
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d+$")
