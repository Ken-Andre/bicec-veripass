# Stage Final Delivery Tracker

Last updated: 2026-05-24 03:17 +02:00

> Scope warning: this tracker proves Day 1-3 stabilization slices only. It is not a final certification that every internship requirement is complete. See `docs/stage-final-truth-audit-2026-05-23.md` for the full gap matrix.

## Proof Status Model

`DONE` is allowed only when the row has the required source change, rebuilt/restarted live runtime proof when runtime behavior is involved, reproducible test result, and an artifact/API response path.

| Status | Meaning |
| --- | --- |
| SOURCE_READY | Code/config/tests exist, but live runtime or artifact proof is not complete. |
| LIVE_READY | Rebuilt/restarted service was verified through the live URL/API. |
| EVIDENCE_READY | Screenshots/videos/traces or API proof artifacts exist under `docs/test-evidence/latest/...`. |
| DONE | All proof required for that row is present. |

## Verified Commands

| Area | Command | Result |
| --- | --- | --- |
| Mobile unit tests | `bun run test` from `code/mobile` | `32 passed`, `192 passed` at 03:04 +02:00 after DAB locator and device/KYC race fix |
| Mobile typecheck | `bunx tsc -b --noEmit` from `code/mobile` | Passed at 03:04 +02:00 |
| OpenAPI JSON validation | `python -m json.tool openapi-spec.json > $null` | Passed |
| Backend contract/support/preferences tests | `docker compose -f code/docker-compose.yml -f code/docker-compose.test.yml run --rm --no-deps --entrypoint /app/.venv/bin/python api -m pytest tests/unit/test_notification_preferences_contract.py tests/unit/test_contract_foundation_schemas.py tests/unit/test_support_compat_contract.py tests/unit/test_support_attachment_contract.py -q` | `16 passed, 1 warning in 1.41s`; later support compat route was retired and reverified separately |
| Backoffice typecheck | `bunx tsc --noEmit` from `code/backoffice` | Passed |
| Backoffice E2E | `bunx playwright test --reporter=line` from `code/backoffice` | `13 passed (43.0s)` |
| API/PWA live rebuild | `docker compose -f code/docker-compose.yml build api pwa`; `docker compose -f code/docker-compose.yml up -d api pwa nginx`; `docker compose -f code/docker-compose.yml restart nginx`; final `docker compose -f code/docker-compose.yml build pwa` after Day 3 push/device client fixes | `vp_api` healthy; `vp_pwa` recreated and healthy; `vp_nginx` restarted after final PWA recreate at 22:57 +02:00 |
| Alembic linear head/live DB | `docker compose -f code/docker-compose.yml exec -T api /app/.venv/bin/alembic heads`; `docker compose -f code/docker-compose.yml exec -T api /app/.venv/bin/alembic current` | Both returned `026_notification_preferences (head)` |
| Mobile evidence | `BASE_URL=https://localhost bun run test:evidence` from `code/mobile` | `4 passed (26.7s)` after final PWA rebuild |
| Backoffice evidence | `BASE_URL=https://localhost bun run test:evidence` from `code/backoffice` | `2 passed (12.5s)` after adding the live approved dossier screenshot |
| Live public API smoke | `curl.exe -k` status checks against `https://localhost` | health `200`, support limits/current/compat unauth `401`, `/mobile/auth` `200`, `/mobile/support` `200`, `/back-office/login` `200`, logo `200`, Sentry health `200` |
| Live support limits/preference API | OTP signup/login via `Invoke-RestMethod`; live GET/PUT through `https://localhost/api/v1` | Support limits returned image `4 Mo`, PDF `6 Mo`, PDF pages `5`, message `4000`; preferences default `sms`, SMS update `200`, email without email `400` |
| Live Day 3 device/push API | OTP signup/login via `Invoke-RestMethod`; device registration; push create/list/delete through `https://localhost/api/v1` | Device tag `vp_dev_865d59e41f9942595733b6c561aadee9cecfa929c11aad56`; push subscription `1614bb99-f801-4dc8-aa4b-b304f3f45b02`; list before delete `1`, after delete `0` |
| Live authenticated support upload | OTP signup/login via `Invoke-RestMethod`, then multipart `curl.exe -k -F` to `/api/v1/support/threads/{thread_id}/attachments` after the 17:09 rebuild | `HTTP_STATUS:201`, `attachment_document_id=c41ce1ca-47fc-4844-885a-32ddc58ce100`, SHA-256 `743815b19badc9de3f2dcadd0539cb037319cf66a114f5f33da0de4f25c832be` |
| Backend device enforcement tests | `docker compose -f code/docker-compose.yml -f code/docker-compose.test.yml run --rm --no-deps --entrypoint /app/.venv/bin/python api -m pytest tests/unit/test_device_enforcement_contract.py tests/unit/test_contract_foundation_schemas.py -q` | `9 passed, 1 warning in 0.04s` |
| Live Day 3 device-tag enforcement API | Rebuilt/recreated API with `docker compose -f code/docker-compose.yml build api`; `docker compose -f code/docker-compose.yml up -d api nginx`; `docker compose -f code/docker-compose.yml restart nginx`; OTP auth + device register + protected route checks through `https://localhost/api/v1` | health `200`; device register `200`; banking/KYC without tag `428`; banking/KYC wrong tag `403`; banking/KYC registered tag `200` |
| Backend support compatibility retirement tests | `docker compose -f code/docker-compose.yml -f code/docker-compose.test.yml run --rm --no-deps --entrypoint /app/.venv/bin/python api -m pytest tests/unit/test_support_compat_contract.py tests/unit/test_support_attachment_contract.py tests/unit/test_contract_foundation_schemas.py -q` | `12 passed, 1 warning in 0.30s` |
| Live support compatibility retirement API | Rebuilt/recreated API with `docker compose -f code/docker-compose.yml build api`; `docker compose -f code/docker-compose.yml up -d api nginx`; `docker compose -f code/docker-compose.yml restart nginx`; OTP auth + support route checks through `https://localhost/api/v1` | health `200`; canonical current thread `200`; canonical thread messages `200`; deprecated `/support/threads/messages` with and without token `404` |
| Live KYC happy-path API acceptance | `python code\scripts\run_kyc_happy_path_acceptance.py --base-url https://localhost` | PASS at `2026-05-23T15:50:44Z`; used notebook CNI images plus generated one-page bill/support PDFs; OTP signup, device registration, CNI recto/verso upload, OCR review, liveness, address, consent, NIU, signature, readiness, submit, JEAN queue/open/auto-assign/info request, client support message/file, JEAN classification/approval, client final status `APPROVED` |
| Backoffice rebuild after dossier-detail UI fix | `bunx tsc --noEmit`; `docker compose -f code/docker-compose.yml build backoffice`; `docker compose -f code/docker-compose.yml up -d backoffice nginx`; `BASE_URL=https://localhost bun run test:evidence` | typecheck passed; image `code-backoffice` rebuilt; `vp_backoffice` recreated; evidence `2 passed` |
| Day 3 mobile live training demo | `BASE_URL=https://localhost bunx playwright test -c playwright.evidence.config.ts tests/e2e/live-client-demo.evidence.ts --project='Mobile Chrome' --reporter=line` from `code/mobile` | `1 passed (31.5s)` after rebuilding/recreating PWA and force-recreating nginx |
| Day 3 backoffice role training demo | `BASE_URL=https://localhost bunx playwright test -c playwright.evidence.config.ts src/test/e2e/role-training.evidence.ts --project=chromium --reporter=line` from `code/backoffice` | `5 passed (32.4s)` after rebuilding/recreating backoffice and force-recreating nginx |
| Day 3 log hygiene after final demos | `docker compose -f code/docker-compose.yml logs --since=2m nginx api \| Select-String ...` | No `placeholder.jpg`, no `500`, no `502`, no `428`, no `403 Forbidden`, no `ERROR`, no `Traceback`, no `No route to host` in the final verification window |

## Day 1 Stabilization

| Requirement | Status | Owner | Proof | Evidence |
| --- | --- | --- | --- | --- |
| Unauthenticated mobile protected routes land on `/auth`, not `/auth/phone` | DONE | Senior reviewer | `AuthGuard` redirects protected routes to `/auth`; full mobile tests passed; live `/mobile/support` serves app and Playwright confirms redirect | `docs/test-evidence/latest/mobile/screens/protected-route-auth-redirect.png` |
| Auth entry is clear without replacing the existing welcome page | DONE | Senior reviewer | `/` remains the public welcome/onboarding screen; `/auth` is the protected-route auth choice entry with explicit login/signup actions | `docs/test-evidence/latest/mobile/screens/auth-choice.png`, `docs/test-evidence/latest/mobile/screens/login-route.png` |
| Auth fallback paths use `/auth` | DONE | Senior reviewer | `AuthContext`, lock, PIN login, OTP and email OTP fallback paths use `/auth`; full mobile tests passed | Covered by auth evidence screenshots and mobile unit suite |
| Support API compatibility route served stale PWA clients during rollout | DONE | Senior reviewer | Temporary route protected stale clients during Day 1; after service-worker refresh proof, it was retired on Day 3 | Historical proof: `docs/test-evidence/latest/api/day1-live-api-proof-2026-05-22.md`; retirement proof: `docs/test-evidence/latest/api/day3-support-compat-retirement-proof-2026-05-23.md` |
| OpenAPI support contract matches implemented routes | DONE | Senior reviewer | `openapi-spec.json` documents `/support/attachment-limits`, `/support/threads/{thread_id}/attachments`, `attachment_filename`, and `attachment_document_id`; JSON validation passed | `openapi-spec.json`; backend contract tests `9 passed` |
| PWA support screen uses canonical current-thread endpoint | DONE | Senior reviewer | Rebuilt PWA support flow loads `/support/threads/current` then `/support/threads/{thread_id}/messages`; evidence run has zero 5xx responses | `docs/test-evidence/latest/mobile/screens/support-screen.png` |
| Client can send requested supporting file from support chat | DONE | Dev C / Senior reviewer | Mobile UI supports PDF/JPG/PNG attachment, optional message, optimistic send, file chip, and backend multipart endpoint creates support message + `Document(COMPLEMENTARY)` + notification | `docs/test-evidence/latest/mobile/screens/support-attachment-selected.png`, `docs/test-evidence/latest/mobile/screens/support-attachment-sent.png`; live API proof `HTTP_STATUS:201` |
| Attachment limits are visible and enforced | DONE | Dev C / Senior reviewer | UI shows `JPG/PNG 4 Mo max - PDF 6 Mo, 5 pages max` and `0/4000`; client rejects bad type, image over 4 Mo, PDF over 6 Mo, PDF over 5 pages; backend enforces the same plus hard API cap `10 Mo`, bad type `415`, hash mismatch `409` | `code/mobile/src/views/dashboard/SupportScreen.test.tsx`; `code/backend/tests/unit/test_support_attachment_contract.py`; support screenshots; live support limits API |
| Backoffice can see support attachment metadata | DONE | Dev C / Senior reviewer | Backoffice support message schema/router expose attachment path/SHA-256; evidence viewer renders attached client file metadata | `bunx tsc --noEmit`; `bunx playwright test --reporter=line` |
| Service worker stale-client handling is visible | DONE | Senior reviewer | `useServiceWorker` exposes update state and evidence trigger; banner has `Nouvelle version disponible`, `Plus tard`, and `Recharger`; PWA rebuilt and served live | `docs/test-evidence/latest/mobile/screens/service-worker-update-banner.png`; mobile evidence `4 passed` |
| Browser 502 cleanup through public nginx | DONE | Senior reviewer | After rebuild/restart, public checks return `200/401` instead of `502`; nginx restarted after PWA recreate | `docs/test-evidence/latest/api/day1-live-api-proof-2026-05-22.md` |
| Visual evidence config produces real artifacts | DONE | Senior reviewer | Evidence configs run only `*.evidence.ts`, one worker, video/screenshot/trace enabled; both `.last-run.json` files show `status: passed` | `docs/test-evidence/latest/mobile/`, `docs/test-evidence/latest/backoffice/` |
| Backoffice validation path remains truthful | DONE | Senior reviewer | No fake unit coverage claimed; `bunx tsc --noEmit` passed; `bunx playwright test --reporter=line` -> `13 passed` | `docs/test-evidence/latest/backoffice/screens/login.png`, `docs/test-evidence/latest/backoffice/screens/dashboard.png` |

## Day 2 Started

| Requirement | Status | Owner | Proof | Evidence |
| --- | --- | --- | --- | --- |
| Client chooses official communication channel in settings | DONE | Dev B / Senior reviewer | Backend `GET/PUT /api/v1/notifications/preferences`, migration `026_notification_preferences`, mobile Settings UI SMS/Email selector, full mobile suite passed, backend contract tests passed, live API proof default/update/reject cases passed | `docs/test-evidence/latest/mobile/screens/settings-official-channel.png`, `docs/test-evidence/latest/mobile/screens/settings-official-channel-email.png`, `docs/test-evidence/latest/api/day1-live-api-proof-2026-05-22.md` |
| Dashboard bottom navigation does not visually overlap settings content | DONE | Senior reviewer | BottomNav is opaque and Settings has bottom padding; focused Settings test passed; final PWA evidence regenerated after rebuild | `docs/test-evidence/latest/mobile/screens/settings-official-channel.png` |
| Push preference persists with notification preferences | DONE | Dev B / Senior reviewer | Settings push toggle persists `push_enabled`; client disables browser subscription, deactivates matching backend subscription, and does not hang if service worker readiness stalls; full mobile suite/evidence passed; live push lifecycle create/list/delete passed | `docs/test-evidence/latest/mobile/screens/settings-push-disabled.png`; `docs/test-evidence/latest/api/day3-live-api-proof-2026-05-22.md` |

## Day 3 Started

| Requirement | Status | Owner | Proof | Evidence |
| --- | --- | --- | --- | --- |
| Mobile registers privacy-reduced device tag and sends it on API calls | DONE | Dev D / Senior reviewer | Mobile builds a local seed + reduced metadata hash, registers `/devices/register` with `X-Device-Fingerprint`, stores returned `vp_device_tag`, and `apiClient`/multipart fetch include `X-Device-Tag`; live API proof returned a deterministic `vp_dev_...` tag | `code/mobile/src/services/deviceRegistrationService.test.ts`; `docs/test-evidence/latest/api/day3-live-api-proof-2026-05-22.md` |
| Push subscription lifecycle is linked to device tag | DONE | Dev B / Senior reviewer | Mobile stores server subscription id on enable, lists/deletes the matching active subscription on disable, and sends `device_tag`; live API proof create/list/delete passed | `code/mobile/src/services/pushNotificationService.test.ts`; `docs/test-evidence/latest/api/day3-live-api-proof-2026-05-22.md` |
| Server-side device-tag enforcement on high-risk routes | DONE | Dev D / Senior reviewer | `require_registered_device` is applied to banking and KYC routes; backend contract tests passed; rebuilt live API blocks missing/wrong tags and allows registered tags | `docs/test-evidence/latest/api/day3-device-enforcement-proof-2026-05-23.md` |
| KYC A-to-Z happy path is proven through live API | DONE | Senior reviewer | Host-run acceptance script exercises the public `https://localhost/api/v1` stack with real notebook CNI images and a unique client; all 29 recorded API steps passed; final client status is `APPROVED` | `docs/test-evidence/latest/kyc-happy-path/README.md`, `docs/test-evidence/latest/kyc-happy-path/kyc-happy-path-live-api-proof.json`, `docs/test-evidence/latest/kyc-happy-path/input-images/` |
| JEAN can visually open the live approved dossier | DONE | Senior reviewer | Backoffice bundle rebuilt after fixing the approved-dossier assignment banner; Playwright logs in as JEAN, opens the live accepted dossier from the API proof, verifies status `APPROVED`, and captures the dossier with CNI image, OCR fields, biometrics, timeline, support attachment, and final approval trail | `docs/test-evidence/latest/backoffice/screens/kyc-happy-path-approved-dossier.png` |
| Client live demo covers login, support upload, notifications, and offline DAB locator | DONE | Senior reviewer | Rebuilt PWA, force-recreated nginx, and ran mobile Playwright against `https://localhost`; demo logs in with OTP/PIN, uploads a one-page PDF support proof, opens notifications, and uses offline DAB proximity sorting. Final API/nginx logs show no 500/502/428 during the verification window. | `docs/test-evidence/latest/mobile/screens/live-client-welcome.png`, `docs/test-evidence/latest/mobile/screens/live-client-support-upload-sent.png`, `docs/test-evidence/latest/mobile/screens/live-client-notifications.png`, `docs/test-evidence/latest/mobile/screens/live-client-atm-finder.png`, videos/traces under `docs/test-evidence/latest/mobile/_playwright/` |
| Offline DAB locator is available with status-gated catalogue | DONE | Senior reviewer | `atmLocator` exposes a basic offline catalogue for early users and the full catalogue after submitted/reviewed KYC; distance ranking is one O(n) pass plus sort; unit tests and live mobile evidence passed. | `code/mobile/src/services/atmLocator.test.ts`; `docs/test-evidence/latest/mobile/screens/live-client-atm-finder.png` |
| Backoffice role training covers JEAN, THOMAS, SYLVIE, and ADMIN_IT | DONE | Senior reviewer | Rebuilt backoffice, force-recreated nginx, and ran role-training Playwright against live `https://localhost`; JEAN validation, THOMAS compliance/analytics, SYLVIE command center/analytics, ADMIN_IT admin, and JEAN approved dossier all passed. | `docs/test-evidence/latest/backoffice/screens/role-jean-validation.png`, `docs/test-evidence/latest/backoffice/screens/role-thomas-compliance.png`, `docs/test-evidence/latest/backoffice/screens/role-sylvie-command-center.png`, `docs/test-evidence/latest/backoffice/screens/role-admin-it.png`, videos/traces under `docs/test-evidence/latest/backoffice/_playwright/` |
| SYLVIE Command Center load distribution uses read-only operational endpoint | DONE | Senior reviewer | Added `/api/v1/backoffice/agents/load` for SYLVIE/Admin read-only load snapshots instead of calling `/admin/agents`; live endpoint returned 200 for SYLVIE and role-training evidence passed. | `code/backend/app/modules/backoffice/router.py`; `code/backoffice/src/pages/command-center/CommandCenterPage.tsx`; `docs/test-evidence/latest/backoffice/screens/role-sylvie-command-center.png` |
| Mobile KYC reconciliation waits for device registration | DONE | Senior reviewer | `KycContext` now waits for `ensureDeviceRegistered()` before `/kyc/session/current`; final mobile demo logs show `devices/register` 200 before KYC session 200 and no 428 in the final verification window. | `code/mobile/src/contexts/KycContext.tsx`; final log hygiene command in Verified Commands |
| Evidence output no longer deletes screenshot folders | DONE | Senior reviewer | Playwright evidence `outputDir` moved into `_playwright` for mobile/backoffice so screenshots under `screens/` persist across suites; Day 1 and role/client evidence were regenerated. | `code/mobile/playwright.evidence.config.ts`; `code/backoffice/playwright.evidence.config.ts`; `docs/test-evidence/latest/mobile/screens/`; `docs/test-evidence/latest/backoffice/screens/` |

## Current Evidence Artifacts

| Artifact | Path |
| --- | --- |
| Mobile auth choice screenshot | `docs/test-evidence/latest/mobile/screens/auth-choice.png` |
| Mobile login route screenshot | `docs/test-evidence/latest/mobile/screens/login-route.png` |
| Mobile protected route redirect screenshot | `docs/test-evidence/latest/mobile/screens/protected-route-auth-redirect.png` |
| Mobile service-worker update banner | `docs/test-evidence/latest/mobile/screens/service-worker-update-banner.png` |
| Mobile support initial screenshot | `docs/test-evidence/latest/mobile/screens/support-screen.png` |
| Mobile support file selected screenshot | `docs/test-evidence/latest/mobile/screens/support-attachment-selected.png` |
| Mobile support file sent screenshot | `docs/test-evidence/latest/mobile/screens/support-attachment-sent.png` |
| Mobile notifications screenshot | `docs/test-evidence/latest/mobile/screens/notifications-screen.png` |
| Mobile official channel settings screenshot | `docs/test-evidence/latest/mobile/screens/settings-official-channel.png` |
| Mobile official channel email selected screenshot | `docs/test-evidence/latest/mobile/screens/settings-official-channel-email.png` |
| Mobile push disabled screenshot | `docs/test-evidence/latest/mobile/screens/settings-push-disabled.png` |
| Mobile traces/videos/report | `docs/test-evidence/latest/mobile/`, `docs/test-evidence/latest/mobile-html-report/index.html` |
| Live API proof | `docs/test-evidence/latest/api/day1-live-api-proof-2026-05-22.md` |
| Day 3 live API proof | `docs/test-evidence/latest/api/day3-live-api-proof-2026-05-22.md` |
| Day 3 device enforcement proof | `docs/test-evidence/latest/api/day3-device-enforcement-proof-2026-05-23.md` |
| Day 3 support compatibility retirement proof | `docs/test-evidence/latest/api/day3-support-compat-retirement-proof-2026-05-23.md` |
| KYC happy-path live API proof | `docs/test-evidence/latest/kyc-happy-path/README.md` |
| KYC happy-path source images | `docs/test-evidence/latest/kyc-happy-path/input-images/` |
| Backoffice live approved KYC dossier screenshot | `docs/test-evidence/latest/backoffice/screens/kyc-happy-path-approved-dossier.png` |
| Stage final truth audit | `docs/stage-final-truth-audit-2026-05-23.md` |
| Backoffice login screenshot | `docs/test-evidence/latest/backoffice/screens/login.png` |
| Backoffice dashboard screenshot | `docs/test-evidence/latest/backoffice/screens/dashboard.png` |
| Backoffice traces/videos/report | `docs/test-evidence/latest/backoffice/`, `docs/test-evidence/latest/backoffice-html-report/index.html` |

## Manual Outside This Run

| Requirement | Status | Reason |
| --- | --- | --- |
| Manual real biometric proof | SOURCE_READY | Automated WebAuthn UI proof can be mocked, but real Face ID/Touch ID still requires the manual device video the product owner will capture. |

## Post-Stabilization Cleanup

| Item | Status | Reason |
| --- | --- | --- |
| Remove deprecated `/support/threads/messages` compatibility route | DONE | Route removed from backend router; contract test asserts absence; live rebuilt API returns `404` for the deprecated route while canonical support routes return `200`. Evidence: `docs/test-evidence/latest/api/day3-support-compat-retirement-proof-2026-05-23.md`. |
