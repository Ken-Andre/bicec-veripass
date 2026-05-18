import asyncio
from app.db.base import *  # Import all models to avoid mapper errors
from app.db.seed_data import seed_development_data
from app.db.session import AsyncSessionLocal

async def run():
    async with AsyncSessionLocal() as db:
        await seed_development_data(db)

if __name__ == '__main__':
    asyncio.run(run())
