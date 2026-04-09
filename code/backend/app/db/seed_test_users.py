"""Seed script to create initial test users for E2E validation.

Usage:
    uv run python app/db/seed_test_users.py
"""

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import User


async def seed_test_users(db: AsyncSession):
    """Create test users if they don't exist."""

    users_data = [
        {
            "phone": "+237612345678",
            "email": "marie.onboarding@gmail.com",
            "role": "CLIENT",
            "has_pin": False,
        },
        {
            "phone": "+237699999999",
            "email": "returning.user@gmail.com",
            "role": "CLIENT",
            "has_pin": True,
            "pin": "123456",
        },
    ]

    for user_data in users_data:
        result = await db.execute(select(User).where(User.phone == user_data["phone"]))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            if user_data.get("has_pin"):
                existing_user.pin_hash = hash_password(user_data["pin"])
            print(f"V User updated/refreshed: {user_data['phone']}")
        else:
            user = User(
                phone=user_data["phone"],
                email=user_data["email"],
                role=user_data["role"],
                pin_hash=hash_password(user_data["pin"])
                if user_data.get("has_pin")
                else None,
            )
            db.add(user)
            print(f"V Created test user: {user.phone} ({user.email})")

    await db.commit()
    print("\nV Seed completed successfully!")


async def main():
    """Main entry point for seed script."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed_test_users(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
