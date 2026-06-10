# Issue #177 - Prometheus metrics endpoint

Implemented on 2026-06-10.

Scope delivered:

- Added `GET /metrics` on the FastAPI app.
- Exposes Prometheus text exposition format with:
  - `veripass_app_info`
  - `veripass_http_requests_total`
  - `veripass_http_request_duration_seconds_sum`
  - `veripass_http_request_duration_seconds_count`
- Added request counting middleware excluding `/metrics` itself.
- Added targeted tests for the endpoint and request recording.

Validation:

- `python -m py_compile app\core\metrics.py app\main.py tests\test_metrics.py`
  passed locally.
- `pytest` could not be run locally because both available Python environments
  are missing `pytest`; Docker was not started.

Project update:

- Status: `In Progress`
- Debut: `2026-06-10`
- Fin: `2026-06-10`
