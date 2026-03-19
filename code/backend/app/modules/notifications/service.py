"""Module service layer logic."""
from typing import Dict, Any
from app.core.orange_sms import orange_sms
import logging

logger = logging.getLogger(__name__)

async def send_sms_notification(phone_number: str, message: str) -> Dict[str, Any]:
    """
    Send an SMS notification. Respects OTP_MODE for local development.
    """
    from app.core.config import settings
    
    if settings.OTP_MODE == "dev_local":
        print("\n" + "="*50)
        print("DEBUG SMS [dev_local mode]")
        print(f"TO:      {phone_number}")
        print(f"MESSAGE: {message}")
        print("="*50 + "\n")
        
        logger.info(f"SIMULATED SMS to {phone_number}: {message[:20]}...")
        return {
            "status": "simulated",
            "mode": "dev_local",
            "phone_number": phone_number,
            "message_preview": message[:20] + "..."
        }

    try:
        result = await orange_sms.send_sms(phone_number, message)
        logger.info(f"SMS sent to {phone_number}: {result.get('outboundSMSMessageRequest', {}).get('resourceURL')}")
        return result
    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_number}: {str(e)}")
        raise
