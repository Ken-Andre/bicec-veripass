"""Sentry filtering helpers for backend observability."""

from __future__ import annotations

from typing import Any

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


_EXPECTED_CLIENT_ERROR_FRAGMENTS = (
    "not authenticated",
    "invalid or expired token",
    "invalid or revoked refresh token",
    "invalid or expired otp",
    "otp has expired",
    "role '",
    "not authorized",
    "device tag required",
    "device tag is not registered",
    "missing required documents",
    "missing required bill document",
    "invalid email or password",
    "no passkey registered",
    "pin ",
    "user not found",
    "method not allowed",
    "not found",
)


def _event_status_code(event: dict[str, Any]) -> int | None:
    for key in ("status_code", "status"):
        value = event.get(key)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)

    for item in event.get("exception", {}).get("values", []) or []:
        mechanism = item.get("mechanism") or {}
        handled_data = mechanism.get("data") or {}
        value = handled_data.get("status_code")
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)

    return None


def _event_message(event: dict[str, Any]) -> str:
    candidates: list[str] = []
    logentry = event.get("logentry") or {}
    if isinstance(logentry, dict):
        candidates.extend(str(value) for value in logentry.values() if value)
    candidates.append(str(event.get("message") or ""))
    for item in event.get("exception", {}).get("values", []) or []:
        candidates.append(str(item.get("type") or ""))
        candidates.append(str(item.get("value") or ""))
    return " ".join(candidates).lower()


def before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """Drop expected client errors while preserving server/runtime failures."""
    exc = hint.get("exc_info", (None, None, None))[1] if hint.get("exc_info") else hint.get("original_exception")

    if isinstance(exc, RequestValidationError):
        return None

    if isinstance(exc, StarletteHTTPException) and exc.status_code < 500:
        return None

    status_code = _event_status_code(event)
    if status_code is not None and status_code < 500:
        return None

    message = _event_message(event)
    if any(fragment in message for fragment in _EXPECTED_CLIENT_ERROR_FRAGMENTS):
        return None

    return event
