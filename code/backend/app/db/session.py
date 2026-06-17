import os
import sys
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.logging import logger

is_testing = "TEST_DATABASE_URL" in os.environ or "pytest" in sys.modules
is_celery = any("celery" in arg for arg in sys.argv)

if is_testing or is_celery:
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_timeout=30,
        pool_recycle=1800,
        echo=False,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def check_db_connection() -> bool:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False
