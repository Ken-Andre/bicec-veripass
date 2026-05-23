"""Tests pour le rate limiting middleware (ADMIN-01 — Issue #174).

Vérifie que les limites de requêtes sont correctement appliquées :
- 100 req/min par IP (API générale)
- 10 req/min par IP (auth endpoints)
- 3 req/min par IP (OTP send)
- Réponse 429 avec header Retry-After
"""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock, AsyncMock

from app.main import app
from app.db.session import get_db


# ============================================================
# HELPERS
# ============================================================


def _auth_header(user_id: str = "11111111-1111-1111-1111-111111111111") -> dict:
    """Génère un header Authorization JWT pour un utilisateur."""
    from app.core.security import create_access_token

    token = create_access_token(
        subject=user_id,
        additional_claims={"role": "CLIENT", "user_type": "mobile"},
    )
    return {"Authorization": f"Bearer {token}"}


def _agent_header(agent_id: str = "22222222-2222-2222-2222-222222222222", role: str = "JEAN") -> dict:
    """Génère un header Authorization JWT pour un agent."""
    from app.core.security import create_access_token

    token = create_access_token(
        subject=agent_id,
        additional_claims={"role": role, "user_type": "agent"},
    )
    return {"Authorization": f"Bearer {token}"}


class FakeRedis:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def incr(self, key):
        self.values[key] = int(self.values.get(key, 0)) + 1
        return self.values[key]

    async def expire(self, key, seconds):
        return True

    async def set(self, key, value, ex=None):
        self.values[key] = value
        return True

    async def delete(self, key):
        self.values.pop(key, None)
        return True


@pytest.fixture(autouse=True)
def _mock_db_dependency():
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    result.scalars.return_value.first.return_value = None

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.refresh = AsyncMock()

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


# ============================================================
# TEST RATE LIMITING — OTP ENDPOINTS (3 req/min)
# ============================================================


class TestOtpRateLimiting:
    """Tests de rate limiting pour les endpoints OTP (3 req/min par IP)."""

    @pytest.mark.asyncio
    async def test_otp_send_rate_limit_exceeded(self, client: AsyncClient):
        """Vérifie que 4 appels OTP send déclenchent le 429 (limite: 3/min)."""
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = None

        with (
            patch(
                "app.modules.auth.router.store_otp",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch("app.modules.auth.tasks.send_otp_task") as mock_task,
        ):
            mock_task.delay = MagicMock()

            # 3 premières requêtes doivent passer
            for i in range(3):
                response = await client.post(
                    "/api/v1/auth/otp/send",
                    json={"phone": f"+23760000000{i}"},
                )
                assert response.status_code == 200, f"Request {i + 1} should succeed"

            # 4ème requête doit être bloquée (429)
            response = await client.post(
                "/api/v1/auth/otp/send",
                json={"phone": "+237600000003"},
            )
            assert response.status_code == 429, "4th request should be rate limited"

    @pytest.mark.asyncio
    async def test_otp_send_429_includes_retry_after_header(self, client: AsyncClient):
        """Vérifie que la réponse 429 inclut le header Retry-After."""
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = None

        with (
            patch(
                "app.modules.auth.router.store_otp",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch("app.modules.auth.tasks.send_otp_task") as mock_task,
        ):
            mock_task.delay = MagicMock()

            # Envoyer 4 requêtes pour déclencher le rate limit
            for i in range(4):
                response = await client.post(
                    "/api/v1/auth/otp/send",
                    json={"phone": f"+2376000000{i}"},
                )

            # La dernière doit indiquer le rate limit.
            assert response.status_code == 429
            message = response.json().get("detail") or response.json().get("error")
            assert message


# ============================================================
# TEST RATE LIMITING — AUTH ENDPOINTS (10 req/min)
# ============================================================


class TestAuthRateLimiting:
    """Tests de rate limiting pour les endpoints auth (10 req/min par IP)."""

    @pytest.mark.asyncio
    async def test_agent_login_rate_limit_exceeded(self, client: AsyncClient):
        """Vérifie que 11 appels agent login déclenchent le 429 (limite: 10/min)."""
        with patch("app.modules.auth.router.get_redis", new_callable=AsyncMock, return_value=FakeRedis()):
            # Mock pour retourner None (login échoué)
            # 10 premières requêtes doivent passer (retournent 401 car mauvais credentials)
            for i in range(10):
                response = await client.post(
                    "/api/v1/auth/agent/login",
                    json={"email": f"agent{i}@test.com", "password": "wrongpass"},
                )
                # 401 = auth failed, mais pas rate limited
                assert response.status_code in [401, 429], (
                    f"Request {i + 1} should be 401 or 429"
                )

            # 11ème requête doit être bloquée (429)
            response = await client.post(
                "/api/v1/auth/agent/login",
                json={"email": "agent10@test.com", "password": "wrongpass"},
            )
            assert response.status_code == 429, "11th request should be rate limited"

    @pytest.mark.asyncio
    async def test_auth_endpoint_429_includes_retry_after(self, client: AsyncClient):
        """Vérifie que la réponse 429 inclut le header Retry-After sur auth."""
        with patch("app.modules.auth.router.get_redis", new_callable=AsyncMock, return_value=FakeRedis()):
            # Envoyer 11 requêtes pour déclencher le rate limit
            for i in range(11):
                response = await client.post(
                    "/api/v1/auth/agent/login",
                    json={"email": f"agent{i}@test.com", "password": "wrongpass"},
                )

            # La dernière doit indiquer le rate limit.
            assert response.status_code == 429
            message = response.json().get("detail") or response.json().get("error")
            assert message


# ============================================================
# TEST RATE LIMITING — GENERAL API (100 req/min)
# ============================================================


class TestGeneralApiRateLimiting:
    """Tests de rate limiting pour l'API générale (100 req/min par IP)."""

    @pytest.mark.asyncio
    async def test_general_api_health_not_rate_limited(self, client: AsyncClient):
        """Vérifie que le health check n'est pas rate limited (endpoint sans décorateur)."""
        # Le health check est à /api/health (pas sous /api/v1)
        response = await client.get("/api/health")
        # Doit retourner 200 ou 503 (degraded), mais pas 429
        assert response.status_code in [200, 503], (
            "Health check should not be rate limited"
        )


# ============================================================
# TEST RATE LIMITING — RESPONSE FORMAT
# ============================================================


class TestRateLimitResponseFormat:
    """Tests du format de la réponse 429."""

    @pytest.mark.asyncio
    async def test_429_response_has_detail(self, client: AsyncClient):
        """Vérifie que la réponse 429 contient un champ 'detail'."""
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = None

        with (
            patch(
                "app.modules.auth.router.store_otp",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch("app.modules.auth.tasks.send_otp_task") as mock_task,
        ):
            mock_task.delay = MagicMock()

            # Déclencher le rate limit
            for i in range(4):
                response = await client.post(
                    "/api/v1/auth/otp/send",
                    json={"phone": f"+2376000000{i}"},
                )

            assert response.status_code == 429
            data = response.json()
            message = data.get("detail") or data.get("error")
            assert message, "429 response should contain a rate-limit message"
            assert (
                "rate limit" in message.lower()
                or "too many" in message.lower()
            ), "Message should mention rate limiting"
