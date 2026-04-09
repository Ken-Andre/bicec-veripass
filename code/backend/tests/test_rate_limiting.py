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


# ============================================================
# HELPERS
# ============================================================


def _auth_header(user_id: str = "test-user-id") -> dict:
    """Génère un header Authorization JWT pour un utilisateur."""
    from app.core.security import create_access_token

    token = create_access_token(
        subject=user_id,
        additional_claims={"role": "CLIENT", "user_type": "mobile"},
    )
    return {"Authorization": f"Bearer {token}"}


def _agent_header(agent_id: str = "test-agent-id", role: str = "JE") -> dict:
    """Génère un header Authorization JWT pour un agent."""
    from app.core.security import create_access_token

    token = create_access_token(
        subject=agent_id,
        additional_claims={"role": role, "user_type": "agent"},
    )
    return {"Authorization": f"Bearer {token}"}


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
            patch("app.modules.auth.router.send_otp_task") as mock_task,
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
            patch("app.modules.auth.router.send_otp_task") as mock_task,
        ):
            mock_task.delay = MagicMock()

            # Envoyer 4 requêtes pour déclencher le rate limit
            for i in range(4):
                response = await client.post(
                    "/api/v1/auth/otp/send",
                    json={"phone": f"+2376000000{i}"},
                )

            # La dernière doit avoir le header Retry-After
            assert response.status_code == 429
            assert (
                "retry-after" in response.headers or "Retry-After" in response.headers
            ), "429 response must include Retry-After header"


# ============================================================
# TEST RATE LIMITING — AUTH ENDPOINTS (10 req/min)
# ============================================================


class TestAuthRateLimiting:
    """Tests de rate limiting pour les endpoints auth (10 req/min par IP)."""

    @pytest.mark.asyncio
    async def test_agent_login_rate_limit_exceeded(self, client: AsyncClient):
        """Vérifie que 11 appels agent login déclenchent le 429 (limite: 10/min)."""
        with patch("app.modules.auth.router.select") as mock_select:
            # Mock pour retourner None (login échoué)
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_select.return_value = MagicMock()

            # 10 premières requêtes doivent passer (retournent 401 car mauvais credentials)
            for i in range(10):
                response = await client.post(
                    "/api/v1/auth/agent/login",
                    json={"email": f"agent{i}@test.com", "password": "wrong"},
                )
                # 401 = auth failed, mais pas rate limited
                assert response.status_code in [401, 429], (
                    f"Request {i + 1} should be 401 or 429"
                )

            # 11ème requête doit être bloquée (429)
            response = await client.post(
                "/api/v1/auth/agent/login",
                json={"email": "agent10@test.com", "password": "wrong"},
            )
            assert response.status_code == 429, "11th request should be rate limited"

    @pytest.mark.asyncio
    async def test_auth_endpoint_429_includes_retry_after(self, client: AsyncClient):
        """Vérifie que la réponse 429 inclut le header Retry-After sur auth."""
        with patch("app.modules.auth.router.select"):
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None

            # Envoyer 11 requêtes pour déclencher le rate limit
            for i in range(11):
                response = await client.post(
                    "/api/v1/auth/agent/login",
                    json={"email": f"agent{i}@test.com", "password": "wrong"},
                )

            # La dernière doit avoir le header Retry-After
            assert response.status_code == 429
            assert (
                "retry-after" in response.headers or "Retry-After" in response.headers
            ), "429 response must include Retry-After header"


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
            patch("app.modules.auth.router.send_otp_task") as mock_task,
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
            assert "detail" in data, "429 response should contain 'detail' field"
            assert (
                "rate limit" in data["detail"].lower()
                or "too many" in data["detail"].lower()
            ), "Detail should mention rate limiting"
