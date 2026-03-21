from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
from app.core.config import settings


def _get_rate_limit_key(request: Request) -> str:
    """
    Composite rate limit key: IP + endpoint path.
    For auth/OTP endpoints, also includes the identifier (phone/email) from the body
    if available via request state (set by the router before rate-limit check).
    """
    ip = get_remote_address(request)
    path = request.url.path
    # Identifier injected by auth endpoints for per-user isolation
    identifier = getattr(request.state, "rate_limit_identifier", None)
    if identifier:
        return f"{path}:{ip}:{identifier}"
    return f"{path}:{ip}"


limiter = Limiter(
    key_func=_get_rate_limit_key,
    enabled=settings.RATE_LIMIT_ENABLED,
    default_limits=[settings.RATE_LIMIT_DEFAULT]
)
