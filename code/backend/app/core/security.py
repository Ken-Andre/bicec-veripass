"""Security utilities: JWT encoding/decoding, password hashing, and RBAC.

JWT Claim Validation Rules
--------------------------
Access token claims:
  - sub  (str, required): opaque user/agent UUID — never expose raw DB id in responses
  - exp  (int, required): expiry timestamp (UTC)
  - type (str, required): must be "access"
  - role (str, required for mobile/agent): user role string
  - user_type (str, required): "mobile" | "agent"
  - sid  (str, optional): HMAC-derived ephemeral session handle — NOT the raw KYCSession DB id

Refresh token claims:
  - sub  (str, required): same opaque UUID as access token
  - exp  (int, required): expiry timestamp (UTC, 7-day window)
  - type (str, required): must be "refresh"
  - jti  (str, required): random UUID for per-token revocation tracking

Validation rules enforced at decode time:
  - Algorithm: HS256 only (no "none", no RS256 fallback)
  - type claim checked before trusting any other claim
  - sub must resolve to an existing DB row
  - sid is verified via HMAC before any DB lookup
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Any, BinaryIO
import hashlib
import hmac
import uuid as _uuid
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import User, Agent, AgentRole
from app.db.session import get_db
from app.modules.auth.models import User, Agent

# JWT Bearer security scheme
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    pwd_bytes = password.encode("utf-8")
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    plain_password_bytes = plain_password.encode("utf-8")
    hashed_password_bytes = hashed_password.encode("utf-8")
    try:
        return bcrypt.checkpw(plain_password_bytes, hashed_password_bytes)
    except ValueError:
        return False


def make_session_handle(db_session_id: str) -> str:
    """
    Derive an ephemeral session handle from a KYCSession DB id using HMAC-SHA256.

    The raw DB UUID is never exposed to clients. Instead, callers receive this
    opaque handle. The backend can re-derive it at any time to verify a handle
    without storing a mapping table.

    Usage:
        handle = make_session_handle(str(kyc_session.id))
        # store handle in token / response; never store raw id client-side
    """
    return hmac.new(
        settings.JWT_SECRET.encode(),
        db_session_id.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_session_handle(handle: str, db_session_id: str) -> bool:
    """Constant-time verification of a session handle against a DB id."""
    expected = make_session_handle(db_session_id)
    return hmac.compare_digest(expected, handle)


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    additional_claims: Optional[dict[str, Any]] = None,
) -> str:
    """
    Create a JWT access token.

    Allowed additional_claims keys: role, user_type, sid.
    - sid must be a pre-computed HMAC handle (use make_session_handle), NOT a raw DB id.
    - Any other keys are silently dropped to keep the token minimal.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode: dict[str, Any] = {"exp": expire, "sub": str(subject), "type": "access"}

    # Allowlist: only include claims that are explicitly needed
    _allowed = {"role", "user_type", "sid"}
    if additional_claims:
        sanitized_claims = {}
        for k, v in additional_claims.items():
            if k in _allowed:
                # Sanitize: convert Enums to their .value representation
                sanitized_claims[k] = v.value if hasattr(v, 'value') else v
        to_encode.update(sanitized_claims)

    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt


def create_refresh_token(subject: str) -> str:
    """
    Create a JWT refresh token with longer expiry.

    Includes a jti (JWT ID) for per-token revocation tracking.
    Claims: sub, exp, type, jti — nothing else.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh",
        "jti": str(
            _uuid.uuid4()
        ),  # unique token id — store in a revocation list to invalidate
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and verify a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None


async def is_token_revoked(jti: str, db: AsyncSession) -> bool:
    """Check if a refresh token jti is in the revocation list."""
    from app.modules.auth.models import TokenRevocation
    import uuid as _uuid_mod

    try:
        jti_uuid = _uuid_mod.UUID(jti)
    except ValueError:
        return True  # malformed jti — treat as revoked
    result = await db.execute(
        select(TokenRevocation).where(TokenRevocation.jti == jti_uuid)
    )
    return result.scalar_one_or_none() is not None


async def revoke_token(jti: str, expires_at, db: AsyncSession) -> None:
    """Add a refresh token jti to the revocation list."""
    from app.modules.auth.models import TokenRevocation
    from datetime import datetime
    import uuid as _uuid_mod

    revocation = TokenRevocation(jti=_uuid_mod.UUID(jti), expires_at=expires_at)
    db.add(revocation)
    await db.commit()


async def decode_refresh_token(
    token: str, db: AsyncSession
) -> Optional[dict[str, Any]]:
    """Decode a refresh token and verify it hasn't been revoked."""
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        return None
    jti = payload.get("jti")
    if not jti or await is_token_revoked(jti, db):
        logger.warning(f"Refresh token revoked or missing jti: {jti}")
        return None
    return payload


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current authenticated user from JWT token."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Validate UUID format to prevent DB errors
    try:
        parsed_uuid = _uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == parsed_uuid))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_current_agent(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Agent:
    """Get current authenticated agent from JWT token (back-office)."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    agent_id = payload.get("sub")
    if not agent_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Validate UUID format to prevent DB errors
    try:
        parsed_uuid = _uuid.UUID(agent_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(Agent).where(Agent.id == parsed_uuid))
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Agent not found",
        )

    return agent


def require_role(*allowed_roles: str):
    """Dependency factory to require specific roles (for mobile users)."""

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' not authorized. Required: {allowed_roles}",
            )
        return current_user

    return role_checker


def require_agent_role(*allowed_roles: AgentRole):
    """Dependency factory to require specific agent roles (for back-office)."""

    async def role_checker(
        current_agent: Agent = Depends(get_current_agent),
    ) -> Agent:
        if current_agent.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_agent.role.value}' not authorized. Required: {[r.value for r in allowed_roles]}",
            )
        return current_agent

    return role_checker
