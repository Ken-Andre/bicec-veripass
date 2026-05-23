import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def clean():
    async with AsyncSessionLocal() as db:
        # Onboarding spec uses 69 + 7 digits = 9 digits total
        result = await db.execute(text("DELETE FROM users WHERE phone LIKE '69%' AND length(phone) = 9"))
        await db.commit()
        deleted = result.rowcount if result.rowcount is not None else 0
        print(f"Cleaned up {deleted} users matching 69xxxxxxx")

if __name__ == '__main__':
    asyncio.run(clean())
