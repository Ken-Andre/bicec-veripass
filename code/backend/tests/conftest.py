import os
import urllib.parse
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

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
    # Try to import python-dotenv if available
    try:
        from dotenv import load_dotenv
        # Look for .env in backend directory or parent
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
        # Now check again after loading .env
        TEST_DATABASE_URL = os.getenv(
            "TEST_DATABASE_URL",
            os.getenv(
                "DATABASE_URL",
                None
            ),
        )
    except ImportError:
        pass  # dotenv not installed, that's fine

# Final fallback: require environment variables to be set
if TEST_DATABASE_URL is None:
    db_user = os.getenv("DB_USER", "")
    db_password = os.getenv("DB_PASSWORD", "")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "15432")  # Docker-mapped port
    db_name = os.getenv("DB_NAME", "veripass")
    
    if db_user and db_password:
        # Construct URL from individual environment variables
        encoded_password = urllib.parse.quote_plus(db_password)
        TEST_DATABASE_URL = f"postgresql+asyncpg://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
    else:
        # No credentials available - tests will skip
        TEST_DATABASE_URL = None
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# Also set TEST_DATABASE_URL for tests that use it directly
os.environ.setdefault("TEST_DATABASE_URL", TEST_DATABASE_URL)

# Skip Sentry initialization in tests (langchain incompatible with Python 3.14)
os.environ["SENTRY_DSN"] = ""
os.environ["SKIP_SENTRY"] = "1"

# Patch sentry_sdk.init to be a no-op before importing app.main
import sentry_sdk  # noqa: E402
_original_init = sentry_sdk.init  # noqa: F841

def _mock_init(*args, **kwargs):
    # Don't actually initialize Sentry in tests
    pass

sentry_sdk.init = _mock_init

# Now import app after Sentry is mocked
from app.main import app  # noqa: E402 — must be after env override
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402

# Engine dédié aux tests (created lazily)
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


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Crée toutes les tables avant la session de tests, les supprime après.
    Skip si PostgreSQL n'est pas disponible (CI sans DB).
    
    Note: Engine is kept alive for the entire session and cleaned up naturally.
    """
    available = await _check_db_available()
    if not available:
        pytest.skip("PostgreSQL not available — skipping DB-dependent tests")
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
    """Session DB isolée par test.
    
    Uses a connection from the pool with explicit rollback for isolation.
    """
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
    """Client HTTP without DB override."""
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
