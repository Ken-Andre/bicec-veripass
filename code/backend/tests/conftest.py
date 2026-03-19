import asyncio
import os
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Override DATABASE_URL before any app import
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://vp_user:vp_password@localhost:5432/veripass_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.main import app  # noqa: E402 — must be after env override
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402

# Engine dédié aux tests
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Crée toutes les tables avant la session de tests, les supprime après."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Session DB isolée par test avec rollback automatique."""
    async with test_engine.begin() as conn:
        async with AsyncSession(bind=conn) as session:
            yield session
            await conn.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Client HTTP avec override de la dépendance DB."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-Correlation-ID": "test-id"},
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
