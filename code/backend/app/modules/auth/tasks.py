import asyncio
import httpx
from typing import Optional
from celery import shared_task
from app.core.sms import sms_client
from app.core.email import email_client
from app.core.config import settings
from app.core.logging import logger


# Only retry on transient network/timeout failures — not on auth errors or bad input
_RETRYABLE = (httpx.TimeoutException, httpx.NetworkError, ConnectionError, OSError)


@shared_task(
    name="app.modules.auth.tasks.send_otp_task",
    queue="notifications",
    autoretry_for=_RETRYABLE,
    retry_kwargs={"max_retries": 3},
    retry_backoff=True,
)
def send_otp_task(phone: str, otp: str, email: Optional[str] = None):
    """
    Celery task to send OTP via SMS (Orange API) with fallback to Email if requested.
    This task is synchronous but calls internal async methods via a managed event loop.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_send_otp_flow(phone, otp, email))
    except Exception as exc:
        logger.error(f"send_otp_task failed for {phone}: {exc}")
        raise
    finally:
        loop.close()


async def _send_otp_flow(phone: str, otp: str, email: Optional[str] = None):
    """Internal async workflow for sending OTP."""
    message = f"VeriPass : Votre code de verification est {otp}. Il expire dans {settings.OTP_EXPIRY_MINUTES} minutes."

    # 1. Manage Simulation Mode
    if settings.OTP_MODE == "dev_local":
        logger.info(f"[DEV_LOCAL SIMULATION] OTP for {phone}: {otp}")
        if email:
            logger.info(f"[DEV_LOCAL SIMULATION] Fallback email record: {email}")
        return True

    # 1b. Email-only mode — skip SMS entirely
    if settings.OTP_MODE == "email":
        target_email = email
        if not target_email and settings.ENVIRONMENT != "production" and settings.OTP_FALLBACK_EMAIL:
            target_email = settings.OTP_FALLBACK_EMAIL_ADDRESS or None
        if not target_email:
            logger.error(f"OTP_MODE=email but no email address provided for {phone}")
            raise RuntimeError(
                f"OTP_MODE=email but no email address available for {phone}."
            )
        email_sent = await email_client.send_email(
            to_email=target_email, subject="VeriPass Verification Code", content=message
        )
        if email_sent:
            logger.info(f"OTP successfully sent to {target_email} via email")
            return True
        raise RuntimeError(
            f"Critical: Failed to send OTP to {target_email} via email (email-only mode)."
        )

    # 2. Try SMS
    try:
        sms_sent = await sms_client.send_sms(to_phone=phone, message=message)
        if sms_sent:
            logger.info(f"OTP successfully sent to {phone} via SMS")
            return True
    except Exception as e:
        logger.error(f"SMS client failed (likely config or network issue): {e}")
        sms_sent = False

    # 3. Fallback to Email if SMS fails and fallback is enabled
    target_email = email
    # For jury presentations / tests: fallback to a default email if SMS API is down/out of credits
    if (
        not target_email
        and settings.ENVIRONMENT != "production"
        and settings.OTP_FALLBACK_EMAIL
    ):
        target_email = settings.OTP_FALLBACK_EMAIL_ADDRESS or None

    if settings.OTP_FALLBACK_EMAIL and target_email:
        logger.warning(
            f"SMS failed for {phone}, attempting fallback to email: {target_email}"
        )
        email_sent = await email_client.send_email(
            to_email=target_email, subject="VeriPass Verification Code", content=message
        )
        if email_sent:
            logger.info(f"OTP successfully sent to {email} as fallback")
            return True

    raise RuntimeError(
        f"Critical: Failed to send OTP to {phone} via SMS (email fallback impossible or failed)."
    )


@shared_task(
    name="app.modules.auth.tasks.send_only_email_otp_task",
    queue="notifications",
    autoretry_for=_RETRYABLE,
    retry_kwargs={"max_retries": 3},
    retry_backoff=True,
)
def send_only_email_otp_task(email: str, otp: str):
    """Celery task to send OTP via Email only."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_send_only_email_flow(email, otp))
    except Exception as exc:
        logger.error(f"send_only_email_otp_task failed for {email}: {exc}")
        raise
    finally:
        loop.close()


async def _send_only_email_flow(email: str, otp: str):
    message = f"VeriPass : Votre code de verification est {otp}. Il expire dans {settings.OTP_EXPIRY_MINUTES} minutes."

    if settings.OTP_MODE == "dev_local":
        logger.info(f"[DEV_LOCAL SIMULATION] Email OTP for {email}: {otp}")
        return True

    email_sent = await email_client.send_email(
        to_email=email, subject="VeriPass Verification Code", content=message
    )
    if email_sent:
        logger.info(f"OTP successfully sent to {email}")
        return True

    raise RuntimeError(f"Critical: Failed to send OTP to {email}.")


@shared_task(
    name="app.modules.auth.tasks.cleanup_expired_otp_sessions", queue="notifications"
)
def cleanup_expired_otp_sessions():
    """Celery task to delete expired or used OTP sessions from the database."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_cleanup_expired_otp_sessions_flow())
    except Exception as exc:
        logger.error(f"cleanup_expired_otp_sessions failed: {exc}")
        raise
    finally:
        loop.close()


async def _cleanup_expired_otp_sessions_flow():
    from app.db.session import async_session_maker
    from sqlalchemy import delete
    from app.modules.auth.models import OTPSession
    from datetime import datetime, timezone

    async with async_session_maker() as db:
        query = delete(OTPSession).where(
            (OTPSession.expires_at < datetime.now(timezone.utc)) | (OTPSession.is_used)
        )
        result = await db.execute(query)
        await db.commit()
        logger.info(f"Cleaned up {result.rowcount} expired/used OTP sessions.")
        return result.rowcount
