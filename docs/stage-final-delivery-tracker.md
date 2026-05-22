# Stage Final Delivery Tracker

Last updated: 2026-05-22 12:15 +02:00

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
| Mobile unit tests | `bun run test` from `code/mobile` | `26 passed`, `170 passed` |
| Mobile typecheck | `bunx tsc -b --noEmit` from `code/mobile` | Passed |
| Backend contract tests | `docker compose -f code/docker-compose.yml -f code/docker-compose.test.yml run --rm --no-deps --entrypoint /app/.venv/bin/python api -m pytest tests/unit/test_contract_foundation_schemas.py tests/unit/test_support_compat_contract.py -q` | `6 passed, 1 warning in 0.24s` |
| Backoffice typecheck | `bunx tsc --noEmit` from `code/backoffice` | Passed |
| Backoffice E2E | `bunx playwright test --reporter=line` from `code/backoffice` | `13 passed (50.3s)` |
| Live rebuild | `docker compose -f code/docker-compose.yml build api pwa` then `docker compose -f code/docker-compose.yml up -d api pwa nginx`; later `docker compose -f code/docker-compose.yml build pwa` and `up -d pwa nginx` after banner fix | `vp_api` and `vp_pwa` recreated; `vp_api` healthy; `vp_pwa` rebuilt again at 12:13 +02:00 |
| Nginx refresh after recreate | `docker compose -f code/docker-compose.yml restart nginx` | Required to clear public `502` after API/PWA recreate |
| Mobile evidence | `BASE_URL=https://localhost bun run test:evidence` from `code/mobile` | `3 passed (9.8s)` after final PWA rebuild |
| Backoffice evidence | `BASE_URL=https://localhost bun run test:evidence` from `code/backoffice` | `1 passed (7.7s)` |

## Day 1 Stabilization

| Requirement | Status | Owner | Proof | Evidence |
| --- | --- | --- | --- | --- |
| Unauthenticated mobile protected routes land on `/auth`, not `/auth/phone` | DONE | Senior reviewer | `AuthGuard` added; `bun run test` -> `170 passed`; live `/mobile/auth` -> `200` | `docs/test-evidence/latest/mobile/screens/protected-route-auth-redirect.png` |
| `/auth` presents explicit login/signup choices | DONE | Senior reviewer | `AuthEntryScreen` added; evidence run against `https://localhost/mobile/auth` passed | `docs/test-evidence/latest/mobile/screens/auth-choice.png`, `docs/test-evidence/latest/mobile/screens/login-route.png` |
| Auth fallback paths use `/auth` | SOURCE_READY | Senior reviewer | Updated `AuthContext`, `LockScreen`, `PinLoginScreen`, `OtpVerifyScreen`, `EmailOtpVerifyScreen`; unit tests passed | Runtime proof covered by `/auth` evidence; no separate visual row needed |
| Support API compatibility route exists for stale PWA clients | DONE | Senior reviewer | Live `GET https://localhost/api/v1/support/threads/messages` without token -> `401`, not `404/502`; backend contract tests passed | `docs/test-evidence/latest/api/day1-live-api-proof-2026-05-22.md`; canonical PWA chunk uses `/support/threads/current` |
| PWA support screen uses canonical current-thread endpoint | DONE | Senior reviewer | `grep` inside rebuilt `vp_pwa` found `/support/threads/current` in `SupportScreen-PS4MwtoK.js` and no `/support/threads/messages` primary path | `docker compose ... exec pwa grep -R '/support/threads/messages\|/support/threads/current' ...` |
| Service worker stale-client handling is visible | LIVE_READY | Senior reviewer | `useServiceWorker` exposes visible reload banner and hourly update check; PWA rebuilt | Needs a forced SW update scenario before `DONE` |
| Initial online load does not show false "Connexion rétablie" banner | DONE | Senior reviewer | `OfflineBanner` now initializes previous online state from current state; `bun run test` -> `170 passed`; PWA rebuilt and mobile evidence rerun | `docs/test-evidence/latest/mobile/screens/auth-choice.png` |
| Browser 502 cleanup through public nginx | DONE | Senior reviewer | Initial public checks returned `502`; after `docker compose ... restart nginx`, live checks passed: health `200`, support current `401`, support compat `401`, logo `200`, Sentry health `200`, `/mobile/auth` `200` | `docs/test-evidence/latest/api/day1-live-api-proof-2026-05-22.md` |
| Visual evidence config produces real artifacts | DONE | Senior reviewer | Evidence configs run only `*.evidence.ts`, one worker, video/screenshot/trace enabled; both `.last-run.json` files show `status: passed` | `docs/test-evidence/latest/mobile/`, `docs/test-evidence/latest/backoffice/`, `docs/test-evidence/latest/mobile-html-report/index.html`, `docs/test-evidence/latest/backoffice-html-report/index.html` |
| Backoffice validation path remains truthful | DONE | Senior reviewer | No fake unit coverage claimed; `bunx tsc --noEmit` passed; `bunx playwright test --reporter=line` -> `13 passed` | Backoffice visual proof: `docs/test-evidence/latest/backoffice/screens/login.png`, `docs/test-evidence/latest/backoffice/screens/dashboard.png` |

## Current Evidence Artifacts

| Artifact | Path |
| --- | --- |
| Mobile auth choice screenshot | `docs/test-evidence/latest/mobile/screens/auth-choice.png` |
| Mobile login route screenshot | `docs/test-evidence/latest/mobile/screens/login-route.png` |
| Mobile protected route redirect screenshot | `docs/test-evidence/latest/mobile/screens/protected-route-auth-redirect.png` |
| Mobile support screenshot | `docs/test-evidence/latest/mobile/screens/support-screen.png` |
| Mobile notifications screenshot | `docs/test-evidence/latest/mobile/screens/notifications-screen.png` |
| Mobile traces/videos/report | `docs/test-evidence/latest/mobile/`, `docs/test-evidence/latest/mobile-html-report/index.html` |
| Live API proof | `docs/test-evidence/latest/api/day1-live-api-proof-2026-05-22.md` |
| Backoffice login screenshot | `docs/test-evidence/latest/backoffice/screens/login.png` |
| Backoffice dashboard screenshot | `docs/test-evidence/latest/backoffice/screens/dashboard.png` |
| Backoffice traces/videos/report | `docs/test-evidence/latest/backoffice/`, `docs/test-evidence/latest/backoffice-html-report/index.html` |

## Still Not DONE

| Requirement | Status | Reason |
| --- | --- | --- |
| Forced service-worker update UX | LIVE_READY | Code and live build exist, but no captured update-trigger scenario yet. |
| Manual real biometric proof | SOURCE_READY | Automated WebAuthn UI proof can be mocked, but real Face ID/Touch ID still requires manual device video. |
| Full final-stage attachment acceptance | IN_PROGRESS | File attachment implementation exists in earlier work, but this tracker row still needs live upload evidence before final acceptance. |
| Long-term support compatibility route removal | PLANNED | `/support/threads/messages` is intentionally temporary and deprecated. |
