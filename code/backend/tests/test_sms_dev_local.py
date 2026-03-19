import asyncio
import logging
from app.modules.notifications.service import send_sms_notification

# Setup basic logging to see the logger.info too
logging.basicConfig(level=logging.INFO)

async def test_dev_local():
    print("Testing SMS in dev_local mode...")
    phone = "+237670000000"
    message = "Votre code VeriPass est 987654. Il expire dans 10 minutes."
    
    result = await send_sms_notification(phone, message)
    print(f"Result: {result}")

if __name__ == "__main__":
    asyncio.run(test_dev_local())
