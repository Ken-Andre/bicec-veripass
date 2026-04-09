"""JWT Service for token generation and validation.

This module provides a dedicated JWT service that wraps the core security
functions with a cleaner API matching the task requirements:
- create_access_token(sub, role, expires=24h)
- create_refresh_token(sub, expires=7d)
"""

from datetime import timedelta, timezone, datetime
from typing import Optional, Any
import uuid as uuid_lib

from jose import JWTError, jwt

from app.core.config import settings
from app.core.logging import logger


def create_access_token(
    sub: str,
    role: Optional[str] = None,
    expires: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT access token with 24-hour default expiry.

    Args:
        sub: Subject identifier (user/agent UUID)
        role: User role for RBAC (e.g., "CLIENT", "JEAN", "THOMAS", "SYLVIE", "ADMIN_IT")
        expires: Custom expiry timedelta. Defaults to 24 hours.

    Returns:
        Encoded JWT token string
    """
    if expires is None:
        expires = timedelta(hours=24)

    expire = datetime.now(timezone.utc) + expires

    to_encode: dict[str, Any] = {
        "exp": expire,
        "sub": str(sub),
        "type": "access",
    }

    if role:
        to_encode["role"] = role

    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt


def create_refresh_token(
    sub: str,
    expires: Optional[timedelta] = None,
) -> tuple[str, str]:
    """
    Create a JWT refresh token with 7-day default expiry.

    Args:
        sub: Subject identifier (user/agent UUID)
        expires: Custom expiry timedelta. Defaults to 7 days.

    Returns:
        Tuple of (encoded_jwt, jti) where jti is the token ID for revocation tracking
    """
    if expires is None:
        expires = timedelta(days=7)

    expire = datetime.now(timezone.utc) + expires
    jti = str(uuid_lib.uuid4())

    to_encode = {
        "exp": expire,
        "sub": str(sub),
        "type": "refresh",
        "jti": jti,
    }

    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt, jti


def verify_token(token: str) -> Optional[dict[str, Any]]:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded payload dict or None if invalid/expired
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """
    Decode and validate an access token.

    Args:
        token: JWT access token string

    Returns:
        Decoded payload or None if invalid
    """
    payload = verify_token(token)
    if not payload:
        return None

    if payload.get("type") != "access":
        logger.warning(f"Invalid token type: {payload.get('type')}")
        return None

    return payload


def decode_refresh_token(token: str) -> Optional[dict[str, Any]]:
    """
    Decode and validate a refresh token.

    Args:
        token: JWT refresh token string

    Returns:
        Decoded payload or None if invalid
    """
    payload = verify_token(token)
    if not payload:
        return None

    if payload.get("type") != "refresh":
        logger.warning(f"Invalid token type: {payload.get('type')}")
        return None

    if not payload.get("jti"):
        logger.warning("Refresh token missing jti")
        return None

    return payload
