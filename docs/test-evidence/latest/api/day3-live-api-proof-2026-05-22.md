# Day 3 Live API Proof

Timestamp: 2026-05-22 22:58 +02:00

Commands:

- `bun run test` from `code/mobile`
- `bunx tsc -b --noEmit` from `code/mobile`
- `docker compose -f code/docker-compose.yml build pwa`
- `docker compose -f code/docker-compose.yml up -d pwa nginx`
- `docker compose -f code/docker-compose.yml restart nginx`
- `BASE_URL=https://localhost bun run test:evidence` from `code/mobile`
- PowerShell `Invoke-RestMethod` live checks against `https://localhost/api/v1`

Container state:

- `vp_api`: healthy, image `code-api`
- `vp_pwa`: rebuilt/recreated at 2026-05-22 22:57 +02:00, healthy, image `code-pwa`
- `vp_nginx`: restarted after PWA recreate

Mobile test results:

- Full Vitest suite: `29 passed`, `180 passed`
- Typecheck: passed
- Evidence suite: `4 passed (26.7s)`

Live device registration proof:

- Test user phone: `+237679947186`
- `POST /api/v1/devices/register` with `X-Device-Fingerprint` returned:
  - `device_id=0c16fb5c-51af-4004-8d0b-4b107c1d1ee8`
  - `device_tag=vp_dev_865d59e41f9942595733b6c561aadee9cecfa929c11aad56`
- Subsequent live push calls were sent with `X-Device-Tag=vp_dev_865d59e41f9942595733b6c561aadee9cecfa929c11aad56`.

Live push subscription lifecycle proof:

- `POST /api/v1/notifications/subscriptions` with the device tag returned:
  - `push_subscription_id=1614bb99-f801-4dc8-aa4b-b304f3f45b02`
  - `device_tag=vp_dev_865d59e41f9942595733b6c561aadee9cecfa929c11aad56`
- `GET /api/v1/notifications/subscriptions` before delete returned `1` active subscription.
- `DELETE /api/v1/notifications/subscriptions/1614bb99-f801-4dc8-aa4b-b304f3f45b02` returned `204`.
- `GET /api/v1/notifications/subscriptions` after delete returned `0` active subscriptions.

Visual evidence:

- `docs/test-evidence/latest/mobile/screens/settings-official-channel.png`
- `docs/test-evidence/latest/mobile/screens/settings-official-channel-email.png`
- `docs/test-evidence/latest/mobile/screens/settings-push-disabled.png`
