"""Module service layer logic."""
from typing import Dict, Any
from app.core.orange_sms import orange_sms
import logging

logger = logging.getLogger(__name__)

async def send_sms_notification(phone_number: str, message: str) -> Dict[str, Any]:
    """
    Send an SMS notification via Orange API.
    """
    try:
        result = await orange_sms.send_sms(phone_number, message)
        logger.info(f"SMS sent to {phone_number}: {result.get('outboundSMSMessageRequest', {}).get('resourceURL')}")
        return result
    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_number}: {str(e)}")
        raise
