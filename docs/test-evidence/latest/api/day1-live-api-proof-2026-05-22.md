# Day 1 Live API Proof

Timestamp: 2026-05-22 18:57 +02:00

Commands:

- `docker compose -f code/docker-compose.yml build api pwa`
- `docker compose -f code/docker-compose.yml up -d api pwa nginx`
- `docker compose -f code/docker-compose.yml restart nginx`
- `docker compose -f code/docker-compose.yml build pwa`
- `docker compose -f code/docker-compose.yml up -d pwa nginx`
- `docker compose -f code/docker-compose.yml restart nginx`
- `docker compose -f code/docker-compose.yml build pwa`
- `docker compose -f code/docker-compose.yml up -d pwa nginx`
- `docker compose -f code/docker-compose.yml restart nginx`
- `docker compose -f code/docker-compose.yml build pwa`
- `docker compose -f code/docker-compose.yml up -d pwa nginx`
- `docker compose -f code/docker-compose.yml restart nginx`
- `docker compose -f code/docker-compose.yml build api pwa`
- `docker compose -f code/docker-compose.yml up -d api pwa nginx`
- `docker compose -f code/docker-compose.yml restart nginx`
- `docker compose -f code/docker-compose.yml exec -T api /app/.venv/bin/alembic heads`
- `docker compose -f code/docker-compose.yml exec -T api /app/.venv/bin/alembic current`
- Python `urllib.request` live checks against `https://localhost` with TLS verification disabled for the local mkcert certificate.
- PowerShell `Invoke-RestMethod` + `curl.exe -k -F` authenticated support attachment upload through `https://localhost`.

Container state:

- `vp_api`: rebuilt/recreated again at 2026-05-22 17:08 +02:00 after notification preferences and support attachment limit changes, healthy, image `code-api`
- `vp_pwa`: rebuilt/recreated again at 2026-05-22 18:55 +02:00 after Settings and BottomNav visual fixes, healthy, image `code-pwa`
- `vp_nginx`: restarted after API/PWA recreate to clear stale upstream `502`
- Alembic: `heads` and `current` both returned `026_notification_preferences (head)`

Live responses after nginx restart:

| URL | Expected | Actual |
| --- | --- | --- |
| `https://localhost/api/health` | `200` | `200 {"status":"ok","version":"0.1.0","db":"ok","redis":"ok"}` |
| `https://localhost/api/v1/support/threads/current` without token | `401` | `401 {"detail":"Not authenticated","status_code":401}` |
| `https://localhost/api/v1/support/threads/messages` without token | `401`, not `404/502` | `401 {"detail":"Not authenticated","status_code":401}` |
| `https://localhost/api/v1/support/attachment-limits` without token | `401`, not `502` | `401 {"detail":"Not authenticated","status_code":401}` |
| `https://localhost/mobile/bicec_logo.jpg` | `200` | `200 image/jpeg bytes=6729` |
| `https://localhost/api/v1/sentry-proxy/health` | `200` | `200 {"status":"ok","service":"sentry-proxy"}` |
| `https://localhost/mobile/auth` | `200` | `200 HTML document` |
| `https://localhost/mobile/support` | `200` | `200 HTML document, protected client-side redirect when unauthenticated` |
| `https://localhost/back-office/login` | `200` | `200 HTML document` |

Authenticated support attachment upload:

- Signup/login proof: `POST /api/v1/auth/otp/send` returned `otp_debug`; `POST /api/v1/auth/otp/verify` returned a JWT access token.
- Thread proof after latest rebuild: `GET /api/v1/support/threads/current` with JWT returned `4ce77b59-094a-4063-ac50-9f43704856d5`.
- Upload proof after latest rebuild: `POST /api/v1/support/threads/4ce77b59-094a-4063-ac50-9f43704856d5/attachments` with one-page PDF, content `Live justificatif proof after Day 2 rebuild`, and client SHA-256 returned `HTTP_STATUS:201`.
- Returned attachment: `attachment_filename=veripass-support-proof-day2.pdf`, `attachment_document_id=c41ce1ca-47fc-4844-885a-32ddc58ce100`, `attachment_sha256=743815b19badc9de3f2dcadd0539cb037319cf66a114f5f33da0de4f25c832be`.

Authenticated support attachment limits:

- `GET /api/v1/support/attachment-limits` returned:
  - `image_max_size_mb=4`
  - `pdf_max_size_mb=6`
  - `pdf_max_pages=5`
  - `max_message_chars=4000`
  - `hard_max_size_mb=10`

Authenticated notification preferences:

- `GET /api/v1/notifications/preferences` for a phone-only test user returned `official_channel=sms`, `push_enabled=true`, `in_app_enabled=true`, `updated_at=null`.
- `PUT /api/v1/notifications/preferences` with `official_channel=sms` returned `200` and persisted `official_channel=sms`.
- `PUT /api/v1/notifications/preferences` with `official_channel=email` for the same phone-only user returned `400`, as expected because no verified email exists for that user.

PWA chunk check:

- `docker compose -f code/docker-compose.yml exec -T pwa sh -lc "grep -R '/support/threads/messages\|/support/threads/current' -n /usr/share/nginx/html/assets /usr/share/nginx/html/sw.js || true"`
- Rebuilt `SupportScreen-PS4MwtoK.js` contains `/support/threads/current` and `/support/threads/${thread.id}/messages`.
- No stale primary `/support/threads/messages` call is present in the rebuilt PWA assets or `sw.js`.
