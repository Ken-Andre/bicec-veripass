# Day 1 Live API Proof

Timestamp: 2026-05-22 15:32 +02:00

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
- Python `urllib.request` live checks against `https://localhost` with TLS verification disabled for the local mkcert certificate.
- PowerShell `Invoke-RestMethod` + `curl.exe -k -F` authenticated support attachment upload through `https://localhost`.

Container state:

- `vp_api`: recreated 2026-05-22, healthy, image `code-api`
- `vp_pwa`: rebuilt/recreated again at 2026-05-22 15:30 +02:00 after support attachment UI and service-worker update evidence hook, healthy, image `code-pwa`
- `vp_nginx`: restarted after API/PWA recreate to clear stale upstream `502`

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
- Thread proof: `GET /api/v1/support/threads/current` with JWT returned `ed63bacb-fc1d-4934-bf55-970d34bcd1e4`.
- Upload proof: `POST /api/v1/support/threads/ed63bacb-fc1d-4934-bf55-970d34bcd1e4/attachments` with multipart PDF, content `Live justificatif proof`, and client SHA-256 returned `HTTP_STATUS:201`.
- Returned attachment: `attachment_filename=veripass-support-proof.pdf`, `attachment_document_id=3701da4e-0daf-41ee-9142-1fbc3f5ec630`, `attachment_sha256=f4d4cd420198e71b4150c817726c69adee428cfc90066ecb3a477b83eacc926a`.

PWA chunk check:

- `docker compose -f code/docker-compose.yml exec -T pwa sh -lc "grep -R '/support/threads/messages\|/support/threads/current' -n /usr/share/nginx/html/assets /usr/share/nginx/html/sw.js || true"`
- Rebuilt `SupportScreen-PS4MwtoK.js` contains `/support/threads/current` and `/support/threads/${thread.id}/messages`.
- No stale primary `/support/threads/messages` call is present in the rebuilt PWA assets or `sw.js`.
