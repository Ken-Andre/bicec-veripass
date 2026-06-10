import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_prometheus_metrics_endpoint_exposes_text(client: AsyncClient):
    response = await client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "veripass_app_info" in response.text
    assert "veripass_http_requests_total" in response.text


@pytest.mark.asyncio
async def test_prometheus_metrics_records_api_requests(client: AsyncClient):
    await client.get("/api/v1/openapi.json")

    response = await client.get("/metrics")

    assert response.status_code == 200
    assert 'path="/api/v1/openapi.json"' in response.text
