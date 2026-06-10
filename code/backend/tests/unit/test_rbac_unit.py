"""
Unit tests for RBAC — role enum, require_role factory, and endpoint access control.
Uses the mocked HTTP client from conftest (no DB, no Redis).
"""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

from app.core.security import create_access_token, require_role
from app.modules.auth.models import AgentRole


def _empty_page() -> dict:
    return {"items": [], "total": 0, "page": 1, "pages": 1, "limit": 10}


# ---------------------------------------------------------------------------
# AgentRole enum
# ---------------------------------------------------------------------------


class TestAgentRoleEnum:
    """AgentRole values are functional role identifiers, not person names."""

    def test_enum_values(self):
        assert AgentRole.JEAN.value == "JEAN"
        assert AgentRole.THOMAS.value == "THOMAS"
        assert AgentRole.SYLVIE.value == "SYLVIE"
        assert AgentRole.ADMIN_IT.value == "ADMIN_IT"

    def test_enum_names(self):
        assert AgentRole.JEAN.name == "JEAN"
        assert AgentRole.THOMAS.name == "THOMAS"
        assert AgentRole.SYLVIE.name == "SYLVIE"
        assert AgentRole.ADMIN_IT.name == "ADMIN_IT"

    def test_all_four_roles_exist(self):
        roles = {r.value for r in AgentRole}
        assert roles == {"JEAN", "THOMAS", "SYLVIE", "ADMIN_IT"}


# ---------------------------------------------------------------------------
# require_role factory
# ---------------------------------------------------------------------------


class TestRequireRoleFactory:
    def test_single_role_creates_dependency(self):
        dep = require_role(AgentRole.JEAN)
        assert dep is not None

    def test_multiple_roles_creates_dependency(self):
        dep = require_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
        assert dep is not None

    def test_empty_roles_creates_dependency_that_always_denies(self):
        """require_role() with no args creates a dependency — it will deny all at runtime."""
        dep = require_role()
        assert dep is not None  # factory succeeds; enforcement happens at request time


# ---------------------------------------------------------------------------
# Endpoint access control (HTTP level)
# ---------------------------------------------------------------------------


def _agent_token(role: AgentRole, subject: str = "agent-test-id") -> str:
    """Helper: create a valid JWT for a given functional role."""
    return create_access_token(
        subject=subject,
        additional_claims={"role": role.value, "user_type": "agent"},
    )


class TestBackofficeQueueAccess:
    """GET /api/v1/backoffice/queue — accessible to JEAN, THOMAS, SYLVIE, ADMIN_IT."""

    @pytest.mark.asyncio
    async def test_no_token_returns_401_or_403(self, client: AsyncClient):
        response = await client.get("/api/v1/backoffice/queue")
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_jean_role_can_access(self, client: AsyncClient):
        token = _agent_token(AgentRole.JEAN)
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_p:
            mock_p.return_value = _empty_page()
            response = await client.get(
                "/api/v1/backoffice/queue",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_thomas_role_can_access(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_p:
            mock_p.return_value = _empty_page()
            response = await client.get(
                "/api/v1/backoffice/queue",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200


class TestAuditLogsAccess:
    """GET /api/v1/backoffice/audit-logs - JEAN, THOMAS, SYLVIE, ADMIN_IT."""

    @pytest.mark.asyncio
    async def test_jean_role_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.JEAN)
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_p:
            mock_p.return_value = _empty_page()
            response = await client.get(
                "/api/v1/backoffice/audit-logs",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_thomas_role_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        with patch(
            "app.modules.backoffice.router.paginate", new_callable=AsyncMock
        ) as mock_p:
            mock_p.return_value = _empty_page()
            response = await client.get(
                "/api/v1/backoffice/audit-logs",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200


class TestAdminUsersAccess:
    """GET /api/v1/admin/users — ADMIN_IT only."""

    @pytest.mark.asyncio
    async def test_jean_role_denied(self, client: AsyncClient):
        token = _agent_token(AgentRole.JEAN)
        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_thomas_role_denied(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_it_role_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.ADMIN_IT)
        with patch(
            "app.modules.admin.router.paginate", new_callable=AsyncMock
        ) as mock_p:
            mock_p.return_value = _empty_page()
            response = await client.get(
                "/api/v1/admin/users",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200


class TestAmlAlertsAccess:
    """GET /api/v1/aml/alerts - THOMAS, SYLVIE only."""

    @pytest.mark.asyncio
    async def test_jean_role_denied(self, client: AsyncClient):
        token = _agent_token(AgentRole.JEAN)
        response = await client.get(
            "/api/v1/aml/alerts",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_thomas_role_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        with patch("app.modules.aml.router.service.get_aml_alerts", new_callable=AsyncMock) as mock_alerts:
            mock_alerts.return_value = []
            response = await client.get(
                "/api/v1/aml/alerts",
                headers={"Authorization": f"Bearer {token}"},
            )
        # Not 401/403 - may be 200 or 422 depending on body
        assert response.status_code not in (401, 403)


class TestAmlListManagementAccess:
    """AML list registry is visible to compliance/ops; imports are Thomas/Admin only."""

    @pytest.mark.asyncio
    async def test_jean_cannot_view_aml_lists(self, client: AsyncClient):
        token = _agent_token(AgentRole.JEAN)
        response = await client.get(
            "/api/v1/aml/lists",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_thomas_can_view_aml_lists(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        with patch("app.modules.aml.router.service.get_aml_list_registry", new_callable=AsyncMock) as mock_lists:
            mock_lists.return_value = []
            response = await client.get(
                "/api/v1/aml/lists",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_it_can_download_template(self, client: AsyncClient):
        token = _agent_token(AgentRole.ADMIN_IT)
        response = await client.get(
            "/api/v1/aml/lists/template",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert "full_name" in response.text


class TestAnalyticsDashboardAccess:
    """GET /api/v1/analytics/dashboard - SYLVIE, ADMIN_IT, THOMAS only."""

    @pytest.mark.asyncio
    async def test_jean_role_denied(self, client: AsyncClient):
        token = _agent_token(AgentRole.JEAN)
        response = await client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_sylvie_role_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.SYLVIE)
        response = await client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code not in (401, 403)

    @pytest.mark.asyncio
    async def test_admin_it_technical_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.ADMIN_IT)
        response = await client.get(
            "/api/v1/analytics/technical",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code not in (401, 403)

    @pytest.mark.asyncio
    async def test_thomas_fraud_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        response = await client.get(
            "/api/v1/analytics/fraud",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code not in (401, 403)

    @pytest.mark.asyncio
    async def test_thomas_technical_denied(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        response = await client.get(
            "/api/v1/analytics/technical",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_jean_business_case_denied(self, client: AsyncClient):
        token = _agent_token(AgentRole.JEAN)
        response = await client.get(
            "/api/v1/analytics/business-case",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_thomas_business_case_denied(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        response = await client.get(
            "/api/v1/analytics/business-case",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_sylvie_business_case_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.SYLVIE)
        with patch("app.modules.analytics.router.analytics_service.get_business_case", new_callable=AsyncMock) as mock_case:
            mock_case.return_value = {"baseline_required": True, "generated_at": "2026-06-03T00:00:00Z"}
            response = await client.get(
                "/api/v1/analytics/business-case",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_it_business_export_allowed_json(self, client: AsyncClient):
        token = _agent_token(AgentRole.ADMIN_IT)
        with patch("app.modules.analytics.router.analytics_service.get_business_case", new_callable=AsyncMock) as mock_case:
            mock_case.return_value = {"baseline_required": True, "generated_at": "2026-06-03T00:00:00Z"}
            response = await client.get(
                "/api/v1/analytics/business-case/export?format=json",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200
        assert response.json()["baseline_required"] is True

    @pytest.mark.asyncio
    async def test_thomas_business_baseline_write_denied(self, client: AsyncClient):
        token = _agent_token(AgentRole.THOMAS)
        response = await client.post(
            "/api/v1/analytics/business-baseline",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "period_start": "2026-06-01",
                "period_end": "2026-06-30",
                "monthly_kyc_volume": 100,
            },
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_sylvie_business_baseline_write_allowed(self, client: AsyncClient):
        token = _agent_token(AgentRole.SYLVIE)
        payload = {
            "period_start": "2026-06-01",
            "period_end": "2026-06-30",
            "monthly_kyc_volume": 100,
        }
        with patch("app.modules.analytics.router.analytics_service.create_business_baseline", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = payload | {"id": "00000000-0000-0000-0000-000000000001"}
            response = await client.post(
                "/api/v1/analytics/business-baseline",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
        assert response.status_code == 200
