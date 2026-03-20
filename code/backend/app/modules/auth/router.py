"""Auth router: OTP, PIN, Agent login, Token refresh."""
from datetime import timedelta
from fastapi import APIRouter, Request, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_current_agent,
)
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import User, Agent
from app.modules.auth.utils import generate_otp, store_otp, verify_otp, delete_otp
from app.modules.auth.schemas import (
    TokenResponse,
    RefreshTokenRequest,
    AgentLoginRequest,
    UserResponse,
    AgentResponse,
    PinSetupRequest,
    PinVerifyRequest,
    OtpSendRequest,
    OtpVerifyRequest,
    EmailOtpSendRequest,
    EmailOtpVerifyRequest,
)

router = APIRouter()

# ============================================================
# MOBILE OTP ENDPOINTS (Story 1.3 — Marie)
# ============================================================

@router.post("/otp/send", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_OTP)
async def send_otp(request: Request, body: OtpSendRequest, db: AsyncSession = Depends(get_db)):
    """Send OTP via SMS or email for mobile authentication."""
    phone = body.phone

    # Check if user exists or create one
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if not user:
        user = User(phone=phone, role="CLIENT")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info(f"New user created: {phone}")

    # Generate and store OTP
    otp = generate_otp()
    stored = await store_otp(phone, otp)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate OTP",
        )

    # Trigger background task for robust sending (SMS + Fallback Email)
    from app.modules.auth.tasks import send_otp_task
    send_otp_task.delay(phone, otp, user.email)
    
    logger.info(f"OTP task queued for {phone}")
    
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
    phone = body.phone

    # Verify OTP
    is_valid = await verify_otp(phone, body.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP",
        )

    # Delete OTP after successful verification
    await delete_otp(phone)

    # Get or create user
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if not user:
        user = User(phone=phone, role="CLIENT")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        additional_claims={"role": user.role, "user_type": "mobile"},
    )
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
    db: AsyncSession = Depends(get_db)
):
    """Send OTP via email for Dual Authentication."""
    email = body.email

    # Update user email
    current_user.email = email
    await db.commit()

    # Generate and store OTP
    otp = generate_otp()
    stored = await store_otp(email, otp)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate OTP",
        )

    from app.modules.auth.tasks import send_only_email_otp_task
    send_only_email_otp_task.delay(email, otp)
    
    logger.info(f"Email OTP task queued for {email}")
    
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
    db: AsyncSession = Depends(get_db)
):
    """Verify Email OTP."""
    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email associated with this user",
        )

    # Verify OTP
    is_valid = await verify_otp(current_user.email, body.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP",
        )

    # Delete OTP after successful verification
    await delete_otp(current_user.email)

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
    current_user.pin_hash = hash_password(body.pin)
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

    if not user or not user.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(body.pin, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        additional_claims={"role": user.role, "user_type": "mobile"},
    )
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ============================================================
# AGENT LOGIN ENDPOINT (Story 1.4 — Jean, Thomas, Sylvie)
# ============================================================

@router.post("/agent/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def agent_login(
    request: Request, body: AgentLoginRequest, db: AsyncSession = Depends(get_db)
):
    """Agent login for back-office (Jean, Thomas, Sylvie)."""
    result = await db.execute(select(Agent).where(Agent.email == body.email))
    agent = result.scalar_one_or_none()

    if not agent or not verify_password(body.password, agent.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Create tokens
    access_token = create_access_token(
        subject=str(agent.id),
        additional_claims={"role": agent.role, "user_type": "agent"},
    )
    refresh_token = create_refresh_token(subject=str(agent.id))

    logger.info(f"Agent login: {agent.email} (role={agent.role})")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ============================================================
# TOKEN REFRESH ENDPOINT
# ============================================================

@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def refresh_token(request: Request, body: RefreshTokenRequest):
    """Refresh JWT access token using a valid refresh token."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Create new tokens (rotation)
    access_token = create_access_token(subject=subject)
    new_refresh_token = create_refresh_token(subject=subject)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ============================================================
# CURRENT USER/AGENT ENDPOINTS
# ============================================================

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
