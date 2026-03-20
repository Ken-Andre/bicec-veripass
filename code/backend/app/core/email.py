
import ssl
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib
from app.core.config import settings
from app.core.logging import logger

class EmailClient:
    """Standard SMTP email client using aiosmtplib for async support."""
    
    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.use_tls = settings.SMTP_TLS
        self.use_ssl = settings.SMTP_SSL
        self.sender = settings.SMTP_FROM

    async def send_email(
        self,
        to_email: str,
        subject: str,
        content: str,
        content_type: str = "plain"
    ) -> bool:
        """Send an email asynchronously."""
        if not to_email:
            logger.warning("Empty recipient email, skipping send.")
            return False
            
        if settings.ENVIRONMENT != "production" and not self.user and self.host == "localhost":
             logger.info(f"[SIMULATED EMAIL] to {to_email}: {subject}")
             # Optional: log content
             return True

        message = MIMEText(content, content_type, "utf-8")
        message["From"] = self.sender
        message["To"] = to_email
        message["Subject"] = subject

        try:
            await aiosmtplib.send(
                message,
                hostname=self.host,
                port=self.port,
                username=self.user,
                password=self.password,
                use_tls=self.use_ssl,
                start_tls=self.use_tls,
            )
            logger.info(f"Email sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

# Global instance
email_client = EmailClient()
