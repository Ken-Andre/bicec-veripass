
import asyncio
from typing import Optional
from celery import shared_task
from app.core.sms import sms_client
from app.core.email import email_client
from app.core.config import settings
from app.core.logging import logger

@shared_task(
    name="app.modules.auth.tasks.send_otp_task",
    queue="notifications",
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True
)
def send_otp_task(phone: str, otp: str, email: Optional[str] = None):
    """
    Celery task to send OTP via SMS (Orange API) with fallback to Email if requested.
    This task is synchronous but calls internal async methods.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_send_otp_flow(phone, otp, email))
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

    # 2. Try SMS
    # If phone starts with specific test numbers, skip real SMS if needed, 
    # but here we use the OrangeSMSClient which should handle its own credits/failures.
    sms_sent = await sms_client.send_sms(to_phone=phone, message=message)
    if sms_sent:
        logger.info(f"OTP successfully sent to {phone} via SMS")
        return True
    
    # 3. Fallback to Email if SMS fails and fallback is enabled
    if settings.OTP_FALLBACK_EMAIL and email:
        logger.warning(f"SMS failed for {phone}, attempting fallback to email: {email}")
        email_sent = await email_client.send_email(
            to_email=email,
            subject="VeriPass Verification Code",
            content=message
        )
        if email_sent:
            logger.info(f"OTP successfully sent to {email} as fallback")
            return True
            
    logger.error(f"Critical: Failed to send OTP to {phone} (email: {email}) via all configured channels.")
    return False
