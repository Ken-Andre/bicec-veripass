# Day 3 Support Compatibility Route Retirement Proof

Generated: 2026-05-23 07:31 +02:00

## Runtime

Commands:

```powershell
docker compose -f code/docker-compose.yml build api
docker compose -f code/docker-compose.yml up -d api nginx
docker compose -f code/docker-compose.yml restart nginx
docker compose -f code/docker-compose.yml ps api nginx
```

Result:

```text
vp_api   code-api    Up 2 minutes (healthy)    0.0.0.0:8001->8000/tcp
vp_nginx code-nginx  Up 42 seconds (healthy)   0.0.0.0:80->8080/tcp, 0.0.0.0:443->8443/tcp
```

API logs showed Alembic migration check, application startup complete, OCR warmup complete, and health check `200 OK`.

## Backend Contract Tests

Command:

```powershell
docker compose -f code/docker-compose.yml -f code/docker-compose.test.yml run --rm --no-deps --entrypoint /app/.venv/bin/python api -m pytest tests/unit/test_support_compat_contract.py tests/unit/test_support_attachment_contract.py tests/unit/test_contract_foundation_schemas.py -q
```

Result:

```text
12 passed, 1 warning in 0.30s
```

## Live API Response Proof

```json
{
  "generated_at": "2026-05-23T07:31:42.2482759+02:00",
  "health": {
    "status": 200,
    "body": "{\"status\":\"ok\",\"version\":\"0.1.0\",\"db\":\"ok\",\"redis\":\"ok\"}"
  },
  "phone": "+237689998386",
  "otp_send": {
    "status": 200
  },
  "otp_verify": {
    "status": 200,
    "token_prefix": "eyJhbGciOiJI"
  },
  "canonical_current_thread": {
    "status": 200,
    "body": "{\"id\":\"0e74a05d-64ea-46e4-adc7-0ff41e3c0f0c\",\"session_id\":\"11a6881a-6677-44ef-b083-09e0a5c95b15\",\"status\":\"OPEN\",\"created_at\":\"2026-05-23T05:31:41.493617Z\"}"
  },
  "canonical_thread_messages": {
    "status": 200,
    "body": "[]"
  },
  "deprecated_messages_without_token": {
    "status": 404,
    "body": "{\"detail\":\"Not Found\",\"status_code\":404}"
  },
  "deprecated_messages_with_token": {
    "status": 404,
    "body": "{\"detail\":\"Not Found\",\"status_code\":404}"
  }
}
```

## Verdict

The deprecated stale-PWA compatibility route `GET /api/v1/support/threads/messages` is retired from the live API.

Canonical support routes still work:

- `GET /api/v1/support/threads/current` returns `200`.
- `GET /api/v1/support/threads/{thread_id}/messages` returns `200`.
