"""Auth router: OTP, PIN, Agent login, Token refresh."""

import secrets
import uuid as _uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Request, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.redis import get_redis
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    revoke_token,
    get_current_user,
    get_current_agent,
    make_session_handle,
)
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import User, Agent, OTPSession, WebAuthnChallenge, WebAuthnCredential
from app.modules.kyc.models import KYCSession
from app.modules.auth.utils import (
    generate_otp,
    store_otp,
    verify_otp_atomic,
    mark_otp_session_used,
    increment_otp_attempts,
    increment_redis_otp_attempts,
    reset_otp_attempts,
    get_otp_attempts,
    OTP_MAX_ATTEMPTS,
)
from app.modules.auth.schemas import (
    TokenResponse,
    RefreshTokenRequest,
    AgentLoginRequest,
    AgentPasswordChangeRequest,
    UserResponse,
    AgentResponse,
    PinSetupRequest,
    PinVerifyRequest,
    WebAuthnRegisterOptionsResponse,
    WebAuthnRegisterVerifyRequest,
    WebAuthnAuthOptionsRequest,
    WebAuthnAuthOptionsResponse,
    WebAuthnAuthVerifyRequest,
    OtpSendRequest,
    OtpVerifyRequest,
    EmailOtpSendRequest,
    EmailOtpVerifyRequest,
    UserExistsCheckResponse,
)

router = APIRouter()


def _active_mobile_statuses() -> list[str]:
    return ["DRAFT", "PENDING_INFO"]


def _pin_attempt_keys(user_id: _uuid.UUID) -> tuple[str, str]:
    return f"pin_attempts:{user_id}", f"pin_lockout:{user_id}"


async def _get_or_create_mobile_session(db: AsyncSession, user: User) -> KYCSession:
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == user.id, KYCSession.status.in_(_active_mobile_statuses()))
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    kyc_session = result.scalar_one_or_none()
    if kyc_session is None:
        kyc_session = KYCSession(
            user_id=user.id,
            status="DRAFT",
            last_step_completed="PHONE_VERIFIED",
            access_level="GUEST",
        )
        db.add(kyc_session)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            result = await db.execute(
                select(KYCSession)
                .where(
                    KYCSession.user_id == user.id,
                    KYCSession.status.in_(_active_mobile_statuses()),
                )
                .order_by(KYCSession.started_at.desc())
                .limit(1)
            )
            kyc_session = result.scalar_one_or_none()
            if kyc_session is None:
                raise
    return kyc_session


async def _issue_mobile_tokens(db: AsyncSession, user: User) -> TokenResponse:
    kyc_session = await _get_or_create_mobile_session(db, user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(KYCSession)
            .where(
                KYCSession.user_id == user.id,
                KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
            )
            .order_by(KYCSession.started_at.desc())
            .limit(1)
        )
        kyc_session = result.scalar_one_or_none()
        if kyc_session is None:
            raise
    await db.refresh(kyc_session)
    session_handle = make_session_handle(str(kyc_session.id))
    access_token = create_access_token(
        subject=str(user.id),
        additional_claims={
            "role": user.role,
            "user_type": "mobile",
            "sid": session_handle,
        },
    )
    refresh_token = create_refresh_token(subject=str(user.id))
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        session_handle=session_handle,
    )

# ============================================================
# HEALTH CHECK
# ============================================================


@router.get("/health")
async def health_check():
    """Auth module health check for readiness probes."""
    return {"status": "healthy", "module": "auth"}


# ============================================================
# MOBILE OTP ENDPOINTS (Story 1.3 — Marie)
# ============================================================


@router.post("/otp/send", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_OTP)
async def send_otp(
    request: Request, body: OtpSendRequest, db: AsyncSession = Depends(get_db)
):
    """Send OTP via SMS or email for mobile authentication.

    If body.phone is provided: send OTP to phone.
    If body.email is provided: send OTP to email.
    mode='login': user MUST exist, no user creation.
    mode='signup': user must NOT exist, creates new user.
    """
    mode = body.mode or "signup"
    phone = body.phone
    email = body.email

    user: User | None = None

    if phone:
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        # Block OTP for deleted accounts
        if user and user.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Ce compte a été supprimé. Veuillez créer un nouveau compte.",
            )
        if not user and mode == "login":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Numéro non reconnu. Créez d'abord un compte.",
            )
        if not user:
            user = User(phone=phone, role="CLIENT")
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info(f"New user created: {phone}")
        identifier = phone
        # Set rate limit identifier for per-identifier throttling
        request.state.rate_limit_identifier = identifier
    elif email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        # Block OTP for deleted accounts
        if user and user.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Ce compte a été supprimé. Veuillez créer un nouveau compte.",
            )
        if not user and mode == "login":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email non reconnu. Créez d'abord un compte.",
            )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email OTP is only for login, not signup.",
            )
        identifier = email
        # Set rate limit identifier for per-identifier throttling
        request.state.rate_limit_identifier = identifier
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either phone or email must be provided.",
        )

    # Generate and store OTP
    otp = generate_otp()
    stored = await store_otp(identifier, otp)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate OTP",
        )

    # Reset attempt counter — new OTP means fresh start
    await reset_otp_attempts(identifier)

    # Record in Postgres (Audit)
    from datetime import datetime, timezone

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.OTP_EXPIRY_MINUTES
    )
    otp_session = OTPSession(
        phone=phone or user.phone,
        email=email or user.email,
        code_hash=hash_password(otp),
        hash_algo="bcrypt",
        expires_at=expires_at,
        request_ip=request.client.host if request.client else None,
    )
    db.add(otp_session)
    await db.commit()

    # Trigger background task for robust sending (SMS + Fallback Email)
    from app.modules.auth.tasks import send_otp_task

    send_otp_task.delay(identifier, otp, user.email)

    logger.info(f"OTP task queued and session audited for {identifier}")

    # Return response (including OTP in dev/test for convenience)
    response = {"message": "OTP request received and is being processed"}
    if settings.ENVIRONMENT != "production":
        response["otp_debug"] = otp

    return response


@router.post("/otp/verify", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_OTP)
async def verify_otp_endpoint(
    request: Request, body: OtpVerifyRequest, db: AsyncSession = Depends(get_db)
):
    """Verify OTP and issue JWT tokens for mobile user."""
    identifier = body.phone or body.email
    is_phone = bool(body.phone)

    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone or email is required",
        )

    # Anti-replay: check attempt counter before doing anything
    attempts = await get_otp_attempts(identifier)
    if attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please request a new OTP.",
        )

    # M1: server-side expiry check against DB audit record (defence if Redis TTL drifts)
    from datetime import datetime, timezone

    if is_phone:
        result_otp = await db.execute(
            select(OTPSession)
            .where(OTPSession.phone == identifier, OTPSession.is_used == False)  # noqa: E712
            .order_by(OTPSession.created_at.desc())
            .limit(1)
        )
    else:
        result_otp = await db.execute(
            select(OTPSession)
            .where(OTPSession.email == identifier, OTPSession.is_used == False)  # noqa: E712
            .order_by(OTPSession.created_at.desc())
            .limit(1)
        )
    otp_session_record = result_otp.scalar_one_or_none()
    if otp_session_record and otp_session_record.expires_at < datetime.now(
        timezone.utc
    ):
        await increment_redis_otp_attempts(identifier)
        await increment_otp_attempts(db, identifier, is_phone=is_phone)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP has expired",
        )

    # Atomic verify + delete (anti-replay: OTP consumed inside distributed lock)
    is_valid = await verify_otp_atomic(identifier, body.otp)
    if not is_valid:
        count = await increment_redis_otp_attempts(identifier)
        await increment_otp_attempts(db, identifier, is_phone=is_phone)
        remaining = max(0, OTP_MAX_ATTEMPTS - count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired OTP. {remaining} attempt(s) remaining.",
        )

    # Success — clear attempt counter and mark DB audit record as used
    await reset_otp_attempts(identifier)
    await mark_otp_session_used(db, identifier, is_phone=is_phone)

    # Get or create user
    if is_phone:
        result = await db.execute(select(User).where(User.phone == identifier))
    else:
        result = await db.execute(select(User).where(User.email == identifier))
    user = result.scalar_one_or_none()

    # Block OTP verify for deleted accounts
    if user and user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Ce compte a été supprimé. Veuillez créer un nouveau compte.",
        )

    if not user:
        user = User(phone=identifier, role="CLIENT")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Manage KYCSession for State Resume
    # Use order_by + limit(1) to always pick the most recent active session.
    # A user may have multiple DRAFT/PENDING_INFO sessions (e.g. after a reset),
    # which would cause scalar_one_or_none() to raise MultipleResultsFound.
    result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == user.id,
            KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
        )
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    kyc_session = result.scalar_one_or_none()

    if not kyc_session:
        from app.modules.admin.models import Agency
        agency_result = await db.execute(select(Agency).limit(1))
        default_agency = agency_result.scalar_one_or_none()
        agency_id = default_agency.id if default_agency else None

        kyc_session = KYCSession(
            user_id=user.id,
            agency_id=agency_id,
            status="DRAFT",
            last_step_completed="PHONE_VERIFIED",
            access_level="GUEST",
        )
        db.add(kyc_session)
    else:
        if not kyc_session.last_step_completed:
            kyc_session.last_step_completed = "PHONE_VERIFIED"

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(KYCSession)
            .where(
                KYCSession.user_id == user.id,
                KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
            )
            .order_by(KYCSession.started_at.desc())
            .limit(1)
        )
        kyc_session = result.scalar_one_or_none()
        if kyc_session is None:
            raise
    await db.refresh(kyc_session)
    session_handle = make_session_handle(str(kyc_session.id))

    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        additional_claims={
            "role": user.role,
            "user_type": "mobile",
            "sid": session_handle,
        },
    )
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        session_handle=session_handle,
    )


# ============================================================
# MOBILE EMAIL OTP ENDPOINTS (Story 1.3 — Marie)
# ============================================================


@router.post("/email/send", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_OTP)
async def send_email_otp(
    request: Request,
    body: EmailOtpSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send OTP via email for Dual Authentication."""
    from sqlalchemy.exc import IntegrityError

    email = body.email

    try:
        # Check if email is already used by another user
        existing_user = await db.execute(
            select(User).where(User.email == email, User.id != current_user.id)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use by another account.",
            )

        # Update user email
        current_user.email = email
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already in use by another account.",
        )

    # Generate and store OTP
    otp = generate_otp()
    stored = await store_otp(email, otp)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate OTP",
        )

    # Reset attempt counter — new OTP means fresh start
    await reset_otp_attempts(email)

    # Record in Postgres (Audit) — code_hash uses bcrypt (salt embedded), hash_algo for auditability
    from datetime import datetime, timezone

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.OTP_EXPIRY_MINUTES
    )
    otp_session = OTPSession(
        phone=current_user.phone,
        email=email,
        code_hash=hash_password(otp),
        hash_algo="bcrypt",
        expires_at=expires_at,
        request_ip=request.client.host if request.client else None,
    )
    db.add(otp_session)
    await db.commit()

    from app.modules.auth.tasks import send_only_email_otp_task

    send_only_email_otp_task.delay(email, otp)

    logger.info(f"Email OTP task queued and session audited for {email}")

    response = {"message": "Email OTP request received and is being processed"}
    if settings.ENVIRONMENT != "production":
        response["otp_debug"] = otp

    return response


@router.post("/email/verify", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_OTP)
async def verify_email_otp(
    request: Request,
    body: EmailOtpVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify Email OTP."""
    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email associated with this user",
        )

    email = current_user.email

    # Anti-replay: check attempt counter
    attempts = await get_otp_attempts(email)
    if attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please request a new OTP.",
        )

    # M1: server-side expiry check
    from datetime import datetime, timezone

    result_otp = await db.execute(
        select(OTPSession)
        .where(OTPSession.email == email, OTPSession.is_used == False)  # noqa: E712
        .order_by(OTPSession.created_at.desc())
        .limit(1)
    )
    otp_session_record = result_otp.scalar_one_or_none()
    if otp_session_record and otp_session_record.expires_at < datetime.now(
        timezone.utc
    ):
        await increment_redis_otp_attempts(email)
        await increment_otp_attempts(db, email, is_phone=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP has expired",
        )

    # Atomic verify + delete (anti-replay)
    is_valid = await verify_otp_atomic(email, body.otp)
    if not is_valid:
        count = await increment_redis_otp_attempts(email)
        await increment_otp_attempts(db, email, is_phone=False)
        remaining = max(0, OTP_MAX_ATTEMPTS - count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired OTP. {remaining} attempt(s) remaining.",
        )

    # Success — clear attempt counter and mark DB audit record as used
    await reset_otp_attempts(email)
    await mark_otp_session_used(db, email, is_phone=False)

    # Update KYCSession State — limit(1) prevents MultipleResultsFound
    result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
        )
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    kyc_session = result.scalar_one_or_none()
    if kyc_session:
        if kyc_session.last_step_completed == "PHONE_VERIFIED":
            kyc_session.last_step_completed = "EMAIL_VERIFIED"
            await db.commit()

    return {"message": "Email verified successfully"}


# ============================================================
# PIN ENDPOINTS (Story 1.3 — Marie returning user)
# ============================================================


@router.post("/pin/setup", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def setup_pin(
    request: Request,
    body: PinSetupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Setup PIN for returning mobile user."""
    if current_user.pin_hash:
        if not body.current_pin or not verify_password(body.current_pin, current_user.pin_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current PIN is required to replace an existing PIN.",
            )

    current_user.pin_hash = hash_password(body.pin)

    # Update KYCSession State — limit(1) prevents MultipleResultsFound
    result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
        )
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    kyc_session = result.scalar_one_or_none()
    if kyc_session:
        if kyc_session.last_step_completed in ["PHONE_VERIFIED", "EMAIL_VERIFIED"]:
            kyc_session.last_step_completed = "PIN_SETUP"

    await db.commit()
    logger.info(f"PIN setup for user {current_user.id}")
    return {"message": "PIN setup successful"}


@router.post("/pin/verify", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_OTP)
async def verify_pin(
    request: Request, body: PinVerifyRequest, db: AsyncSession = Depends(get_db)
):
    """Verify PIN for returning mobile user."""
    result = await db.execute(select(User).where(User.phone == body.phone))
    user = result.scalar_one_or_none()

    # Block login for deleted accounts
    if user and user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Ce compte a été supprimé. Veuillez créer un nouveau compte.",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PIN non configuré. Veuillez d'abord configurer votre PIN via OTP.",
        )

    redis = await get_redis()
    attempts_key, lockout_key = _pin_attempt_keys(user.id)
    if await redis.get(lockout_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account locked for 15 minutes due to multiple failed PIN attempts.",
        )

    if not verify_password(body.pin, user.pin_hash):
        attempts = await redis.incr(attempts_key)
        await redis.expire(attempts_key, 3600)
        if attempts >= settings.PIN_MAX_ATTEMPTS:
            await redis.set(lockout_key, "locked", ex=settings.PIN_LOCKOUT_SECONDS)
            await redis.delete(attempts_key)
            logger.warning("PIN account locked after repeated failures: user_id=%s", user.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account locked for 15 minutes due to multiple failed PIN attempts.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    await redis.delete(attempts_key)

    # Manage KYCSession for State Resume — limit(1) prevents MultipleResultsFound.
    # A user who restarted KYC multiple times may have several DRAFT sessions;
    # we always want the most recent one.
    kyc_result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == user.id,
            KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
        )
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    kyc_session = kyc_result.scalar_one_or_none()

    if not kyc_session:
        # No active session (old one may be ABANDONED/SUBMITTED) — start fresh
        kyc_session = KYCSession(
            user_id=user.id,
            status="DRAFT",
            last_step_completed="PHONE_VERIFIED",
            access_level="GUEST",
        )
        db.add(kyc_session)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            kyc_result = await db.execute(
                select(KYCSession)
                .where(
                    KYCSession.user_id == user.id,
                    KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
                )
                .order_by(KYCSession.started_at.desc())
                .limit(1)
            )
            kyc_session = kyc_result.scalar_one_or_none()
            if kyc_session is None:
                raise
        await db.refresh(kyc_session)

    session_handle = make_session_handle(str(kyc_session.id))

    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        additional_claims={
            "role": user.role,
            "user_type": "mobile",
            "sid": session_handle,
        },
    )
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        session_handle=session_handle,
    )


# ============================================================
# AGENT LOGIN ENDPOINT (Story 1.4 — Jean, Thomas, Sylvie)
# ============================================================


# ============================================================
# WEBAUTHN / PASSKEY ENDPOINTS
# ============================================================


@router.post("/webauthn/register/options", response_model=WebAuthnRegisterOptionsResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def webauthn_register_options(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a server challenge for passkey registration."""
    challenge = secrets.token_urlsafe(32)
    db.add(
        WebAuthnChallenge(
            user_id=current_user.id,
            challenge=challenge,
            purpose="REGISTER",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        )
    )
    await db.commit()
    return WebAuthnRegisterOptionsResponse(
        challenge=challenge,
        rp_id=request.url.hostname or "localhost",
        rp_name="BICEC VeriPass",
        user_id=str(current_user.id),
        user_name=current_user.phone or current_user.email or str(current_user.id),
    )


@router.post("/webauthn/register/verify")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def webauthn_register_verify(
    request: Request,
    body: WebAuthnRegisterVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist a passkey credential after browser WebAuthn registration."""
    now = datetime.now(timezone.utc)
    challenge_result = await db.execute(
        select(WebAuthnChallenge).where(
            WebAuthnChallenge.user_id == current_user.id,
            WebAuthnChallenge.challenge == body.challenge,
            WebAuthnChallenge.purpose == "REGISTER",
            WebAuthnChallenge.consumed_at.is_(None),
        )
    )
    challenge = challenge_result.scalar_one_or_none()
    if challenge is None or challenge.expires_at < now:
        raise HTTPException(status_code=400, detail="Invalid or expired WebAuthn challenge.")

    if not body.raw_response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Raw WebAuthn registration response is required.",
        )
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Passkey registration requires server-side WebAuthn attestation verification.",
    )

    challenge.consumed_at = now
    credential_result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.credential_id == body.credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if credential is None:
        credential = WebAuthnCredential(
            user_id=current_user.id,
            credential_id=body.credential_id,
        )
        db.add(credential)

    credential.public_key = body.public_key
    credential.transports = body.transports
    credential.device_tag = body.device_tag
    current_user.biometric_opt_in = True
    await db.commit()
    return {"status": "success", "credential_id": credential.credential_id}


@router.post("/webauthn/auth/options", response_model=WebAuthnAuthOptionsResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def webauthn_auth_options(
    request: Request,
    body: WebAuthnAuthOptionsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a server challenge for passkey authentication."""
    user_result = await db.execute(select(User).where(User.phone == body.phone))
    user = user_result.scalar_one_or_none()
    if not user or user.is_deleted:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    credential_result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
    )
    credentials = credential_result.scalars().all()
    if not credentials:
        raise HTTPException(status_code=404, detail="No passkey registered for this account.")

    challenge = secrets.token_urlsafe(32)
    db.add(
        WebAuthnChallenge(
            user_id=user.id,
            challenge=challenge,
            purpose="AUTH",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        )
    )
    await db.commit()
    return WebAuthnAuthOptionsResponse(
        challenge=challenge,
        rp_id=request.url.hostname or "localhost",
        allow_credentials=[item.credential_id for item in credentials],
    )


@router.post("/webauthn/auth/verify", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def webauthn_auth_verify(
    request: Request,
    body: WebAuthnAuthVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify a passkey challenge and issue JWT tokens."""
    user_result = await db.execute(select(User).where(User.phone == body.phone))
    user = user_result.scalar_one_or_none()
    if not user or user.is_deleted:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    now = datetime.now(timezone.utc)
    challenge_result = await db.execute(
        select(WebAuthnChallenge).where(
            WebAuthnChallenge.user_id == user.id,
            WebAuthnChallenge.challenge == body.challenge,
            WebAuthnChallenge.purpose == "AUTH",
            WebAuthnChallenge.consumed_at.is_(None),
        )
    )
    challenge = challenge_result.scalar_one_or_none()
    if challenge is None or challenge.expires_at < now:
        raise HTTPException(status_code=400, detail="Invalid or expired WebAuthn challenge.")

    credential_result = await db.execute(
        select(WebAuthnCredential).where(
            WebAuthnCredential.user_id == user.id,
            WebAuthnCredential.credential_id == body.credential_id,
        )
    )
    credential = credential_result.scalar_one_or_none()
    if credential is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not body.raw_response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Raw WebAuthn assertion response is required.",
        )
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Passkey authentication requires server-side WebAuthn assertion verification.",
    )

    challenge.consumed_at = now
    credential.last_used_at = now
    user.biometric_opt_in = True
    return await _issue_mobile_tokens(db, user)


@router.post("/agent/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def agent_login(
    request: Request, body: AgentLoginRequest, db: AsyncSession = Depends(get_db)
):
    """Agent login for back-office (Jean, Thomas, Sylvie)."""
    # Granular rate limiting by email
    request.state.rate_limit_identifier = body.email

    redis = await get_redis()
    lockout_key = f"agent_lockout:{body.email}"
    attempts_key = f"agent_attempts:{body.email}"

    # 1. Check if account is locked
    if await redis.get(lockout_key):
        logger.warning(f"Login attempt on locked agent account: {body.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account locked for 15 minutes due to multiple failed attempts.",
        )

    result = await db.execute(select(Agent).where(Agent.email == body.email))
    agent = result.scalar_one_or_none()

    # 2. Verify credentials
    if not agent or not verify_password(body.password, agent.password_hash):
        # Increment failed attempts
        attempts = await redis.incr(attempts_key)
        await redis.expire(attempts_key, 3600)  # window of 1 hour

        if attempts >= 5:
            await redis.set(lockout_key, "locked", ex=900)  # 15 minutes
            await redis.delete(attempts_key)
            logger.warning(f"Agent account locked: {body.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account locked for 15 minutes due to multiple failed attempts.",
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid email or password. Attempt {attempts}/5.",
        )

    if not agent.is_available:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent account is disabled.",
        )

    # 3. Success: Reset attempts
    await redis.delete(attempts_key)
    agent.last_activity_at = datetime.now(timezone.utc)
    await db.commit()

    # Create tokens
    access_token = create_access_token(
        subject=str(agent.id),
        additional_claims={"role": agent.role.value, "user_type": "agent"},
    )
    refresh_token = create_refresh_token(subject=str(agent.id))

    logger.info(f"Agent login: {agent.email} (role={agent.role})")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ============================================================
# AGENT PASSWORD CHANGE (Story 1.4 — self-service)
# ============================================================



@router.post("/agent/password-change")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def agent_password_change(
    request: Request,
    body: AgentPasswordChangeRequest,
    current_agent: Agent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """Agent self-service password change.

    Requires current password verification. On success, all existing
    refresh tokens remain valid (they are subject-based, not password-based),
    but the agent should re-login for a clean token set.
    """
    if not verify_password(body.current_password, current_agent.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password.",
        )

    current_agent.password_hash = hash_password(body.new_password)
    await db.commit()

    logger.info(f"Agent password changed: {current_agent.email}")
    return {"status": "success", "message": "Password updated successfully"}


# ============================================================
# TOKEN REFRESH ENDPOINT
# ============================================================


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def refresh_token(
    request: Request, body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)
):
    """Refresh JWT access token using a valid refresh token. Old token is revoked on use."""
    payload = await decode_refresh_token(body.refresh_token, db)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token",
        )

    subject = payload.get("sub")
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not subject or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Revoke the consumed refresh token (rotation — one-time use)
    from datetime import datetime, timezone

    expires_at = (
        datetime.fromtimestamp(exp, tz=timezone.utc)
        if exp
        else datetime.now(timezone.utc)
    )
    await revoke_token(jti, expires_at, db)

    logger.info(
        f"Token refresh: subject={subject}, ip={request.client.host if request.client else 'unknown'}, "
        f"user_agent={request.headers.get('user-agent', 'unknown')}"
    )

    # Look up the subject to preserve role/user_type claims in the new access token
    try:
        parsed_uuid = _uuid.UUID(subject)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    # Try Agent first (back-office), then User (mobile)
    additional_claims: dict | None = None
    result = await db.execute(select(Agent).where(Agent.id == parsed_uuid))
    agent = result.scalar_one_or_none()
    if agent:
        if not agent.is_available:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Agent account is disabled",
            )
        additional_claims = {"role": agent.role.value, "user_type": "agent"}
    else:
        result = await db.execute(select(User).where(User.id == parsed_uuid))
        user = result.scalar_one_or_none()
        if user:
            if user.is_deleted:
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="Account has been deleted",
                )
            # For mobile users, re-derive session handle if possible — limit(1) prevents crash
            kyc_result = await db.execute(
                select(KYCSession)
                .where(
                    KYCSession.user_id == user.id,
                    KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
                )
                .order_by(KYCSession.started_at.desc())
                .limit(1)
            )
            kyc_session = kyc_result.scalar_one_or_none()
            session_handle = make_session_handle(str(kyc_session.id)) if kyc_session else None
            additional_claims = {
                "role": user.role,
                "user_type": "mobile",
            }
            if session_handle:
                additional_claims["sid"] = session_handle
        else:
            # Subject not found — account deleted. Refuse token refresh.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account no longer exists",
            )

    # Issue new tokens
    access_token = create_access_token(subject=subject, additional_claims=additional_claims)
    new_refresh_token = create_refresh_token(subject=subject)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ============================================================
# CURRENT USER/AGENT ENDPOINTS
# ============================================================


@router.get("/user/exists", response_model=UserExistsCheckResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def check_user_exists(
    request: Request,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Check if a user exists by phone or email."""
    user: User | None = None

    if phone:
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
    elif email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    # Don't reveal deleted accounts in existence check
    if not user or user.is_deleted:
        return UserExistsCheckResponse(exists=False, has_pin=False, has_email=False)

    return UserExistsCheckResponse(
        exists=True,
        has_pin=bool(user.pin_hash),
        has_email=bool(user.email),
        phone=user.phone,
    )


@router.get("/me", response_model=UserResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_me(request: Request, current_user: User = Depends(get_current_user)):
    """Get current authenticated mobile user."""
    return UserResponse(
        id=str(current_user.id),
        phone=current_user.phone,
        email=current_user.email,
        role=current_user.role,
        language=current_user.language,
        biometric_opt_in=current_user.biometric_opt_in,
        has_pin=bool(current_user.pin_hash),
    )


@router.get("/agent/me", response_model=AgentResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_agent_me(
    request: Request, current_agent: Agent = Depends(get_current_agent)
):
    """Get current authenticated agent."""
    return AgentResponse(
        id=str(current_agent.id),
        name=current_agent.name,
        email=current_agent.email,
        role=current_agent.role,
        is_available=current_agent.is_available,
        active_dossier_count=current_agent.active_dossier_count,
    )


# ============================================================
# DELETE ACCOUNT ENDPOINT
# ============================================================


@router.delete("/account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete user account.

    Authentication is BLOCKED for deleted users (OTP, PIN, token refresh).
    All KYC data and documents are RETAINED for compliance (10 years per COBAC regulations).
    Only the user record is marked as deleted — data is preserved for audit trail.
    """
    from datetime import datetime, timezone

    # Soft delete: mark user as deleted, retain all data for compliance
    current_user.is_deleted = True
    current_user.deleted_at = datetime.now(timezone.utc)
    # Clear authentication credentials to prevent any login attempt
    current_user.pin_hash = None
    # Clear phone/email to prevent OTP being sent to old credentials
    # NOTE: In production, you might want to retain these for audit purposes
    # but clearing them prevents re-registration with the same phone/email
    # current_user.phone = None  # Uncomment if you want to free up the phone number
    # current_user.email = None  # Uncomment if you want to free up the email

    await db.commit()

    logger.info(f"User {current_user.id} soft-deleted. Data retained for compliance (10 years).")

    return {"message": "Account deleted successfully"}
