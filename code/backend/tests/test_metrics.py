import pytest
from httpx import AsyncClient

from app.core.metrics import MetricsRegistry


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


@pytest.mark.asyncio
async def test_prometheus_metrics_does_not_record_self_scrapes(client: AsyncClient):
    first_response = await client.get("/metrics")
    second_response = await client.get("/metrics")

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert 'path="/metrics"' not in second_response.text


def test_prometheus_metrics_escapes_label_values():
    registry = MetricsRegistry()

    registry.record_http_request(
        method="get",
        path='/api/v1/items/"quoted"\\line\nnext',
        status_code=200,
        duration_seconds=0.25,
    )

    rendered = registry.render(app_name='BICEC "VeriPass"', version="1\\2\n3")

    assert 'app="BICEC \\"VeriPass\\""' in rendered
    assert 'version="1\\\\2\\n3"' in rendered
    assert 'path="/api/v1/items/\\"quoted\\"\\\\line\\nnext"' in rendered
