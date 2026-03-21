# Minimal conftest for unit tests — no database required.
# Override the session-scoped DB fixture so it doesn't skip everything.
import pytest


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """No-op override: unit tests don't need a database."""
    yield
