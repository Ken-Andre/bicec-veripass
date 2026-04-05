
import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.abspath("/app"))

# Force environment for script if needed, but REDIS_URL should be in env
# os.environ["REDIS_URL"] = "redis://redis:6379/0"

from app.modules.auth.utils import store_otp, verify_otp_atomic
from app.core.redis import get_redis

async def test_otp():
    phone = "+237600000000"
    otp = "123456"
    
    print(f"Testing with REDIS_URL: {os.environ.get('REDIS_URL')}")
    
    print(f"Storing OTP {otp} for {phone}...")
    success = await store_otp(phone, otp)
    if not success:
        print("FAIL: store_otp returned False")
        return

    redis = await get_redis()
    key = f"otp:{phone}"
    stored_hash = await redis.get(key)
    print(f"Stored hash in Redis: {stored_hash}")

    print("Verifying OTP...")
    verified = await verify_otp_atomic(phone, otp)
    if verified:
        print("SUCCESS: OTP verified correctly")
    else:
        print("FAIL: OTP verification failed")

if __name__ == "__main__":
    asyncio.run(test_otp())
