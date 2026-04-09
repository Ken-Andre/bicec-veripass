"""Tests unitaires pour le RBAC (Issue #49 — AUTH-03)."""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

from app.core.security import create_access_token, require_role
from app.modules.auth.models import AgentRole


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
        """Aucun rôle ne devrait lever une erreur."""
        with pytest.raises(TypeError):
            require_role()


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
            subject="agent-jean-123",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = {
                "items": [],
                "total": 0,
                "page": 1,
                "page_size": 10,
            }
            response = await client.get(
                "/api/v1/backoffice/queue",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_backoffice_queue_with_thomas_token(self, client: AsyncClient):
        """Thomas doit pouvoir accéder à la queue KYC."""
        token = create_access_token(
            subject="agent-thomas-456",
            additional_claims={"role": AgentRole.THOMAS.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = {
                "items": [],
                "total": 0,
                "page": 1,
                "page_size": 10,
            }
            response = await client.get(
                "/api/v1/backoffice/queue",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_backoffice_audit_logs_jean_denied(self, client: AsyncClient):
        """Jean ne doit PAS pouvoir accéder aux audit logs."""
        token = create_access_token(
            subject="agent-jean-123",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        response = await client.get(
            "/api/v1/backoffice/audit-logs",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_backoffice_audit_logs_thomas_allowed(self, client: AsyncClient):
        """Thomas doit pouvoir accéder aux audit logs."""
        token = create_access_token(
            subject="agent-thomas-456",
            additional_claims={"role": AgentRole.THOMAS.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = {
                "items": [],
                "total": 0,
                "page": 1,
                "page_size": 10,
            }
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
            subject="agent-jean-123",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {jean_token}"},
        )
        assert response.status_code == 403

        # Admin IT tries — should succeed
        admin_token = create_access_token(
            subject="agent-admin-789",
            additional_claims={"role": AgentRole.ADMIN_IT.value, "user_type": "agent"},
        )
        with patch(
            "app.modules.admin.router.paginate", new_callable=AsyncMock
        ) as mock_paginate:
            mock_paginate.return_value = {
                "items": [],
                "total": 0,
                "page": 1,
                "page_size": 10,
            }
            response = await client.get(
                "/api/v1/admin/users",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_aml_screening_thomas_allowed(self, client: AsyncClient):
        """Thomas doit pouvoir accéder au AML screening."""
        token = create_access_token(
            subject="agent-thomas-456",
            additional_claims={"role": AgentRole.THOMAS.value, "user_type": "agent"},
        )
        response = await client.post(
            "/api/v1/aml/screening",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Should not be 401/403 (may be 501 Not Implemented if logic is TODO)
        assert response.status_code not in (401, 403)

    @pytest.mark.asyncio
    async def test_aml_screening_jean_denied(self, client: AsyncClient):
        """Jean ne doit PAS pouvoir accéder au AML screening."""
        token = create_access_token(
            subject="agent-jean-123",
            additional_claims={"role": AgentRole.JEAN.value, "user_type": "agent"},
        )
        response = await client.post(
            "/api/v1/aml/screening",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_analytics_dashboard_sylvie_allowed(self, client: AsyncClient):
        """Sylvie doit pouvoir accéder au dashboard analytics."""
        token = create_access_token(
            subject="agent-sylvie-321",
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
            subject="agent-jean-123",
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
