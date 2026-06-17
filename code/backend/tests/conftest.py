import os
import urllib.parse
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

# Use DATABASE_URL from env (CI sets it), fallback to TEST_DATABASE_URL, then local default
# On Windows/Docker: use port 15432 (mapped from container's 5432)
# IMPORTANT: Never hardcode passwords here - always use environment variables
# CI/Production: Set TEST_DATABASE_URL or DATABASE_URL environment variable
# Local dev: Set DB_USER, DB_PASSWORD, DB_HOST, DB_PORT in environment
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    os.getenv(
        "DATABASE_URL",
        None,  # No fallback - require explicit configuration
    ),
)

# If still no DATABASE_URL, try reading from .env file (for local dev)
if TEST_DATABASE_URL is None:
    try:
        from dotenv import load_dotenv
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
        TEST_DATABASE_URL = os.getenv(
            "TEST_DATABASE_URL",
            os.getenv("DATABASE_URL", None),
        )
    except ImportError:
        pass

if TEST_DATABASE_URL is None:
    db_user = os.getenv("DB_USER", "")
    db_password = os.getenv("DB_PASSWORD", "")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "15432")
    db_name = os.getenv("DB_NAME", "veripass")

    if db_user and db_password:
        encoded_password = urllib.parse.quote_plus(db_password)
        TEST_DATABASE_URL = f"postgresql+asyncpg://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
    else:
        TEST_DATABASE_URL = None

if TEST_DATABASE_URL is not None:
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    os.environ.setdefault("TEST_DATABASE_URL", TEST_DATABASE_URL)

os.environ["SENTRY_DSN"] = ""
os.environ["SKIP_SENTRY"] = "1"
os.environ.setdefault("STORAGE_PATH", os.path.abspath(".test-data/documents"))
os.environ.setdefault("MODELS_PATH", os.path.abspath(".test-data/models"))

import sentry_sdk  # noqa: E402
_original_init = sentry_sdk.init

def _mock_init(*args, **kwargs):
    pass

sentry_sdk.init = _mock_init

from app.main import app  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402

from app.core.celery_config import celery as celery_app
celery_app.conf.task_always_eager = True

# Dedicated engine for tests (created lazily)
_test_engine = None
_db_available = None  # None = not checked yet, True/False = checked


def _get_test_engine():
    global _test_engine
    if _test_engine is None:
        from sqlalchemy.pool import NullPool
        _test_engine = create_async_engine(
            TEST_DATABASE_URL,
            echo=False,
            # Use NullPool to avoid connection pool cleanup issues
            # Each connection is created and destroyed per operation
            poolclass=NullPool,
        )
    return _test_engine


async def _check_db_available():
    """Check if PostgreSQL is reachable."""
    global _db_available
    if _db_available is not None:
        return _db_available
    try:
        engine = _get_test_engine()
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        _db_available = True
    except Exception:
        _db_available = False
    return _db_available


# Configure pytest-asyncio
pytest_plugins = ('pytest_asyncio',)


# Override pytest-asyncio's loop scope for function-scoped fixtures
def pytest_configure(config):
    config.option.asyncio_default_fixture_loop_scope = "function"


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Keep SlowAPI's in-memory counters isolated between tests."""
    limiter.reset()
    yield
    limiter.reset()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create all tables before the test session, drop them after.
    Skip if PostgreSQL is not available (CI without DB).

    Note: Engine is kept alive for the entire session and cleaned up naturally.
    """
    available = await _check_db_available()
    if not available:
        # Keep non-DB tests runnable in environments without PostgreSQL.
        yield
        return

    engine = _get_test_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Clean up: drop all tables after tests
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    except Exception:
        pass
    # Don't dispose the engine - let it be garbage collected naturally
    # This avoids "event loop is closed" errors during cleanup


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Isolated DB session per test with automatic rollback."""
    if not await _check_db_available():
        pytest.skip("PostgreSQL not available")
        return

    engine = _get_test_engine()
    session = AsyncSession(engine, expire_on_commit=False, autocommit=False, autoflush=False)
    
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        try:
            await session.rollback()
        except Exception:
            pass


@pytest_asyncio.fixture
async def client():
    """HTTP client without DB override. Use client_db for DB-backed tests."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-Correlation-ID": "test-id"},
    ) as ac:
        yield ac


@pytest_asyncio.fixture
async def client_db():
    """Client HTTP with dedicated DB session for tests."""
    if not await _check_db_available():
        pytest.skip("PostgreSQL not available")
        return

    engine = _get_test_engine()
    # Use scoped session to ensure proper cleanup
    async with AsyncSession(engine, expire_on_commit=False, autoflush=False) as session:
        async def override_get_db():
            yield session

        app.dependency_overrides[get_db] = override_get_db

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
                headers={"X-Correlation-ID": "test-id"},
            ) as ac:
                yield ac
        finally:
            app.dependency_overrides.clear()
