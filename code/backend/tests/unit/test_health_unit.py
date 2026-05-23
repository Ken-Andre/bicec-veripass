"""
Unit tests for health endpoint — no DB or Redis required.
DB and Redis checks are mocked to return True.
"""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_ok_when_all_services_up(self, client: AsyncClient):
        with (
            patch(
                "app.main.check_db_connection",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "app.main.check_redis_connection",
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["db"] == "ok"
        assert data["redis"] == "ok"
        assert "version" in data

    @pytest.mark.asyncio
    async def test_health_degraded_when_db_down(self, client: AsyncClient):
        with (
            patch(
                "app.main.check_db_connection",
                new_callable=AsyncMock,
                return_value=False,
            ),
            patch(
                "app.main.check_redis_connection",
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["db"] == "error"

    @pytest.mark.asyncio
    async def test_health_degraded_when_redis_down(self, client: AsyncClient):
        with (
            patch(
                "app.main.check_db_connection",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "app.main.check_redis_connection",
                new_callable=AsyncMock,
                return_value=False,
            ),
        ):
            response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["redis"] == "error"

    @pytest.mark.asyncio
    async def test_openapi_schema_accessible(self, client: AsyncClient):
        response = await client.get("/api/v1/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert data["info"]["title"] == "BICEC VeriPass"
