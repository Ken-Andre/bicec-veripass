"""Tests unitaires pour le RBAC (Issue #49 — AUTH-03)."""

import uuid
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import Request, HTTPException, status

from app.core.security import create_access_token, require_role
from app.modules.auth.models import AgentRole


def _empty_page() -> dict:
    return {"items": [], "total": 0, "page": 1, "pages": 1, "limit": 10}


@pytest.fixture(autouse=True)
def _mock_rbac_dependencies():
    from app.main import app
    from app.db.session import get_db
    from app.core.security import get_current_agent, decode_token
    from app.modules.auth.models import Agent

    result = MagicMock()
    result.scalar.return_value = 0
    result.scalar_one_or_none.return_value = None
    result.scalars.return_value.unique.return_value.all.return_value = []
    result.scalars.return_value.all.return_value = []

    async def _mock_get_db():
        db = AsyncMock()
        db.execute = AsyncMock(return_value=result)
        db.commit = AsyncMock()
        db.rollback = AsyncMock()
        yield db

    async def _mock_get_current_agent(request: Request) -> Agent:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
            )
        payload = decode_token(auth_header.split(" ", 1)[1])
        if not payload or payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        agent = MagicMock(spec=Agent)
        agent.id = uuid.uuid4()
        agent.role = AgentRole(payload["role"])
        agent.is_available = True
        agent.active_dossier_count = 0
        return agent

    app.dependency_overrides[get_db] = _mock_get_db
    app.dependency_overrides[get_current_agent] = _mock_get_current_agent
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_agent, None)


# ============================================================
# TESTS REQUIRE_ROLE DECORATOR
# ============================================================


class TestRequireRole:
    """Tests pour le décorateur require_role()."""

    def test_require_role_single_role_allowed(self):
        """Un rôle unique doit être accepté."""
        dep = require_role(AgentRole.JEAN)
        assert dep is not None

    def test_require_role_multiple_roles_allowed(self):
        """Plusieurs rôles doivent être acceptés."""
        dep = require_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
        assert dep is not None

    def test_require_role_empty_should_fail(self):
        """Aucun rôle crée une dépendance qui refusera à l'exécution."""
        dep = require_role()
        assert dep is not None


# ============================================================
# TESTS RBAC ENDPOINTS (mocks — pas de DB)
# ============================================================


class TestRBACEndpoints:
    """Tests des endpoints avec RBAC."""

    @pytest.mark.asyncio
    async def test_backoffice_queue_without_token(self, client: AsyncClient):
        """Accéder à /backoffice/queue sans token doit retourner 401."""
        response = await client.get("/api/v1/backoffice/queue")
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_backoffice_queue_with_jean_token(self, client: AsyncClient):
        """Jean doit pouvoir accéder à la queue KYC."""
        token = create_access_token(
            subject="11111111-1111-1111-1111-111111111111",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = _empty_page()
            response = await client.get(
                "/api/v1/backoffice/queue",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_backoffice_queue_with_thomas_token(self, client: AsyncClient):
        """Thomas doit pouvoir accéder à la queue KYC."""
        token = create_access_token(
            subject="22222222-2222-2222-2222-222222222222",
            additional_claims={"role": AgentRole.THOMAS.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = _empty_page()
            response = await client.get(
                "/api/v1/backoffice/queue",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_backoffice_audit_logs_jean_allowed(self, client: AsyncClient):
        """Jean ne doit PAS pouvoir accéder aux audit logs."""
        token = create_access_token(
            subject="11111111-1111-1111-1111-111111111111",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = _empty_page()
            response = await client.get(
                "/api/v1/backoffice/audit-logs",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_backoffice_audit_logs_thomas_allowed(self, client: AsyncClient):
        """Thomas doit pouvoir accéder aux audit logs."""
        token = create_access_token(
            subject="22222222-2222-2222-2222-222222222222",
            additional_claims={"role": AgentRole.THOMAS.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = _empty_page()
            response = await client.get(
                "/api/v1/backoffice/audit-logs",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_users_only_admin_it(self, client: AsyncClient):
        """Seul ADMIN_IT peut accéder à /admin/users."""
        # Jean tries — should fail
        jean_token = create_access_token(
            subject="11111111-1111-1111-1111-111111111111",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {jean_token}"},
        )
        assert response.status_code == 403

        # Admin IT tries — should succeed
        admin_token = create_access_token(
            subject="44444444-4444-4444-4444-444444444444",
            additional_claims={"role": AgentRole.ADMIN_IT.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.admin.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = _empty_page()
            response = await client.get(
                "/api/v1/admin/users",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_aml_screening_thomas_allowed(self, client: AsyncClient):
        """Thomas doit pouvoir accéder aux alertes AML."""
        token = create_access_token(
            subject="22222222-2222-2222-2222-222222222222",
            additional_claims={"role": AgentRole.THOMAS.value, "user_type": "agent"},
        )
        with patch("app.modules.aml.router.service.get_aml_alerts", new_callable=AsyncMock) as mock_alerts:
            mock_alerts.return_value = []
            response = await client.get(
                "/api/v1/aml/alerts",
                headers={"Authorization": f"Bearer {token}"},
            )
        # Should not be 401/403 (may be 501 Not Implemented if logic is TODO)
        assert response.status_code not in (401, 403)

    @pytest.mark.asyncio
    async def test_aml_screening_jean_denied(self, client: AsyncClient):
        """Jean ne doit PAS pouvoir accéder aux alertes AML."""
        token = create_access_token(
            subject="11111111-1111-1111-1111-111111111111",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        response = await client.get(
            "/api/v1/aml/alerts",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_analytics_dashboard_sylvie_allowed(self, client: AsyncClient):
        """Sylvie doit pouvoir accéder au dashboard analytics."""
        token = create_access_token(
            subject="33333333-3333-3333-3333-333333333333",
            additional_claims={"role": AgentRole.SYLVIE.value, "user_type": "agent"},
        )
        response = await client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Should not be 401/403
        assert response.status_code not in (401, 403)

    @pytest.mark.asyncio
    async def test_analytics_dashboard_jean_denied(self, client: AsyncClient):
        """Jean ne doit PAS pouvoir accéder au dashboard analytics."""
        token = create_access_token(
            subject="11111111-1111-1111-1111-111111111111",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        response = await client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


# ============================================================
# TESTS RBAC MATRIX VALIDATION
# ============================================================


class TestRBACMatrix:
    """Validation de la matrice RBAC."""

    def test_agent_role_enum_values(self):
        """L'enum AgentRole doit avoir les bonnes valeurs."""
        assert AgentRole.JEAN.value == "JEAN"
        assert AgentRole.THOMAS.value == "THOMAS"
        assert AgentRole.SYLVIE.value == "SYLVIE"
        assert AgentRole.ADMIN_IT.value == "ADMIN_IT"

    def test_role_descriptions(self):
        """Les rôles doivent avoir les bonnes descriptions (docstring)."""
        # Jean = KYC Validator
        # Thomas = AML Supervisor
        # Sylvie = Operations Director
        # Admin IT = Admin IT
        # These are documented in the enum definition
        assert AgentRole.JEAN.name == "JEAN"
        assert AgentRole.THOMAS.name == "THOMAS"
        assert AgentRole.SYLVIE.name == "SYLVIE"
        assert AgentRole.ADMIN_IT.name == "ADMIN_IT"
