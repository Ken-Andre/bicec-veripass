import logging
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class OrangeSMSClient:
    """
    Client for Orange SMS API (Orange Developer).
    Standard 2-legged OAuth flow.
    """

    def __init__(self):
        self.base_url = settings.ORANGE_BASE_URL.rstrip("/")
        self.client_id = settings.ORANGE_CLIENT_ID
        self.client_secret = settings.ORANGE_CLIENT_SECRET
        self.auth_header = settings.ORANGE_AUTH_HEADER_BASIC
        self.access_token: Optional[str] = None

    async def _get_access_token(self) -> str:
        """Fetch access token using oauth protocol."""
        # Use existing header if provided, otherwise compute it (safety)
        headers = {
            "Authorization": self.auth_header,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        }

        data = {"grant_type": "client_credentials"}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/oauth/v3/token",
                    headers=headers,
                    data=data,
                    timeout=10.0,
                )
                response.raise_for_status()
                token_data = response.json()
                self.access_token = token_data.get("access_token")
                return self.access_token
            except httpx.HTTPStatusError as e:
                logger.error(f"Orange Auth Error: {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"Orange Connection Error: {str(e)}")
                raise

    async def send_sms(self, phone_number: str, message: str) -> Dict[str, Any]:
        """
        Send an SMS via Orange API.
        Format: +237xxxxxxxxx
        """
        if not self.access_token:
            await self._get_access_token()

        # Specific endpoint for Orange SMS Messaging
        # Usually follows pattern: /smsmessaging/v1/outbound/{senderAddress}/requests
        # For Cameroon, senderAddress must be 'tel:...' and can be a shortcode.

        sender_address = settings.ORANGE_SENDER_PHONE or "tel:+237000000000"
        if not sender_address.startswith("tel:"):
            sender_address = f"tel:{sender_address}"

        endpoint = f"{self.base_url}/smsmessaging/v1/outbound/{sender_address}/requests"

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        payload = {
            "outboundSMSMessageRequest": {
                "address": f"tel:{phone_number}",
                "outboundSMSTextMessage": {"message": message},
                "senderAddress": sender_address,
                "senderName": settings.ORANGE_SENDER_NAME,
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    endpoint, headers=headers, json=payload, timeout=15.0
                )

                # Handle token expiration (401)
                if response.status_code == 401:
                    logger.warning("Orange Token expired, refreshing...")
                    await self._get_access_token()
                    headers["Authorization"] = f"Bearer {self.access_token}"
                    response = await client.post(
                        endpoint, headers=headers, json=payload, timeout=15.0
                    )

                response.raise_for_status()
                return response.json()

            except httpx.HTTPStatusError as e:
                logger.error(f"Orange SMS Send Error: {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"Orange SMS Connection Error: {str(e)}")
                raise


# Singleton instance
orange_sms = OrangeSMSClient()
