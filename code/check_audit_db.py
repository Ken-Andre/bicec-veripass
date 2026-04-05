
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
import json

# DB Config from environment or defaults
DB_USER = "vp_user"
DB_PASS = "veripass_secret_password"
DB_HOST = "localhost"
DB_PORT = "15432"
DB_NAME = "veripass"

DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

async def check_session():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Search for the user with the specific phone number
        from sqlalchemy import text
        
        print(f"Checking for user +237670000001...")
        
        user_query = text("SELECT id, phone, email, role FROM users WHERE phone = '+237670000001'")
        user_result = await session.execute(user_query)
        user = user_result.fetchone()
        
        if not user:
            print("User not found.")
            return

        print(f"User found: ID={user.id}, Phone={user.phone}, Email={user.email}")
        
        # Search for KYC sessions for this user
        session_query = text("SELECT id, status, last_step_completed, started_at FROM kyc_sessions WHERE user_id = :user_id")
        session_result = await session.execute(session_query, {"user_id": user.id})
        sessions = session_result.fetchall()
        
        if not sessions:
            print("No KYC sessions found for this user.")
        else:
            print(f"Found {len(sessions)} KYC session(s):")
            for s in sessions:
                print(f"  - Session ID: {s.id}")
                print(f"    Status: {s.status}")
                print(f"    Last Step: {s.last_step_completed}")
                print(f"    Started At: {s.started_at}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_session())
