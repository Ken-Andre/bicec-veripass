# conftest.py  unit tests (no database, no Redis required)
# Overrides session-scoped DB fixture and provides an HTTP client
# with all DB/Redis dependencies mocked out.
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from fastapi import Request, HTTPException, status


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """No-op override: unit tests don't need a database."""
    yield


@pytest.fixture
async def client():
    """
    HTTP test client with DB, Redis, and auth dependencies replaced by mocks.

    Both get_current_user and get_current_agent are overridden to decode the JWT
    from the Authorization header and return mock objects whose role matches the
    token role claim. This allows require_role() RBAC enforcement to work
    correctly without a running database.
    """
    from app.main import app
    from app.db.session import get_db
    from app.core.redis import get_redis
    from app.core.security import get_current_user, get_current_agent, decode_token
    from app.modules.auth.models import User, Agent, AgentRole

    async def _mock_get_db():
        result = MagicMock()
        result.scalar.return_value = 0
        result.scalar_one_or_none.return_value = None
        result.scalars.return_value.unique.return_value.all.return_value = []
        result.scalars.return_value.all.return_value = []
        db = AsyncMock()
        db.execute = AsyncMock(return_value=result)
        db.commit = AsyncMock()
        db.rollback = AsyncMock()
        db.close = AsyncMock()
        yield db

    _redis_mock = AsyncMock()
    _redis_mock.get = AsyncMock(return_value=None)
    _redis_mock.set = AsyncMock(return_value=True)
    _redis_mock.setex = AsyncMock(return_value=True)
    _redis_mock.delete = AsyncMock(return_value=1)
    _redis_mock.incr = AsyncMock(return_value=1)
    _redis_mock.expire = AsyncMock(return_value=True)
    _redis_mock.ping = AsyncMock(return_value=True)

    async def _mock_get_redis():
        return _redis_mock

    def _extract_role_from_request(request: Request) -> str:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )
        token = auth_header.split(" ", 1)[1]
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        role_str = payload.get("role")
        if not role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing role claim"
            )
        return role_str

    async def _mock_get_current_user(request: Request) -> User:
        role_str = _extract_role_from_request(request)
        user = MagicMock(spec=User)
        user.id = uuid.uuid4()
        user.role = role_str
        user.is_available = True
        return user

    async def _mock_get_current_agent(request: Request) -> Agent:
        role_str = _extract_role_from_request(request)
        try:
            role = AgentRole(role_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unknown role: {role_str}",
            )
        agent = MagicMock(spec=Agent)
        agent.id = uuid.uuid4()
        agent.role = role
        agent.is_available = True
        agent.active_dossier_count = 0
        return agent

    app.dependency_overrides[get_db] = _mock_get_db
    app.dependency_overrides[get_redis] = _mock_get_redis
    app.dependency_overrides[get_current_user] = _mock_get_current_user
    app.dependency_overrides[get_current_agent] = _mock_get_current_agent

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-Correlation-ID": "unit-test-id"},
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
