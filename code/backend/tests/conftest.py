import asyncio
import os
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# Use DATABASE_URL from env (CI sets it), fallback to TEST_DATABASE_URL, then local default
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/veripass_test",
    ),
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.main import app  # noqa: E402 — must be after env override
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402

# Engine dédié aux tests (created lazily)
_test_engine = None
_db_available = False


def _get_test_engine():
    global _test_engine
    if _test_engine is None:
        _test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    return _test_engine


async def _check_db_available():
    """Check if PostgreSQL is reachable."""
    global _db_available
    try:
        engine = _get_test_engine()
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        _db_available = True
    except Exception:
        _db_available = False
    return _db_available


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Crée toutes les tables avant la session de tests, les supprime après.
    Skip si PostgreSQL n'est pas disponible (CI sans DB)."""
    available = await _check_db_available()
    if not available:
        pytest.skip("PostgreSQL not available — skipping DB-dependent tests")
        return

    engine = _get_test_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Session DB isolée par test avec rollback automatique."""
    if not _db_available:
        pytest.skip("PostgreSQL not available")
        return

    engine = _get_test_engine()
    async with engine.begin() as conn:
        async with AsyncSession(bind=conn) as session:
            yield session
            await conn.rollback()


@pytest.fixture
async def client(db_session):
    """Client HTTP avec override de la dépendance DB.
    Fallback sans DB si PostgreSQL n'est pas disponible."""
    if _db_available:

        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-Correlation-ID": "test-id"},
    ) as ac:
        yield ac

    if _db_available:
        app.dependency_overrides.clear()
