# Stage Final Delivery Tracker

Last updated: 2026-05-22

## Definition Of Done

A requirement can move to `DONE` only when all of these are true:

- Backend and frontend behavior are wired to the documented API contract.
- Database changes have a linear Alembic migration path; `alembic heads` returns one head.
- Reproducible tests pass from documented commands.
- Visual or API evidence is linked in this tracker.
- The owner has updated module docs when endpoints or behavior changed.

## Evidence Commands

| Area | Command | Expected evidence |
| --- | --- | --- |
| Backend contracts | `docker compose -f code/docker-compose.yml -f code/docker-compose.test.yml run --rm --no-deps --entrypoint /app/.venv/bin/python api -m pytest tests/unit/test_contract_foundation_schemas.py -q` | `5 passed, 1 cache warning` in one-off test container; live `vp_api` restart still required |
| Mobile unit tests | `bun run test` from `code/mobile` | Vitest output |
| Mobile typecheck | `bunx tsc -b --noEmit` from `code/mobile` | TypeScript output |
| Backoffice typecheck | `bunx tsc --noEmit` from `code/backoffice` | TypeScript output |
| Backoffice E2E | `bunx playwright test --reporter=line` from `code/backoffice` | `13 passed` |
| Visual evidence | `bun run test:evidence` from mobile/backoffice | Screenshots, traces, videos under `docs/test-evidence/latest/` |

## Day 0-1 Foundation

| Requirement | Status | Owner | Proof required | Evidence |
| --- | --- | --- | --- | --- |
| OpenAPI contract includes notifications, support, WebAuthn, and device tag endpoints | IN_PROGRESS | Senior reviewer | `openapi-spec.json` diff and API smoke response | Local `python -m json.tool openapi-spec.json` passed; file is ignored by `.gitignore` and must be force-added or generated in CI |
| Alembic migration path is linear | DONE | Senior reviewer | `alembic heads` returns one head | `docker compose -f code/docker-compose.yml -f code/docker-compose.test.yml run --rm --no-deps --entrypoint /app/.venv/bin/alembic api heads` -> `025_contract_foundations (head)` |
| Backend test deps are available without bloating production image | DONE | Senior reviewer | `docker-compose.test.yml` runs pytest in an API test image without changing the production container | Docker Desktop build completed in 10m05s; one-off test container `pytest tests/unit/test_contract_foundation_schemas.py -q` -> `5 passed, 1 warning in 0.04s`; live `vp_api` was not restarted |
| Acceptance seed creates pending, info-requested, and approved dossiers | IN_PROGRESS | Senior reviewer | Seed script output and API queries | `code/backend/app/db/seed_acceptance_scenario.py` added and `py_compile` passed; seed execution/API query proof still pending |
| Visual evidence configs capture screenshots, traces, and videos | DONE | Senior reviewer | Playwright evidence run artifacts | `code/mobile/playwright.evidence.config.ts` and `code/backoffice/playwright.evidence.config.ts` added with stable `docs/test-evidence/latest/...` output |
| Mobile AGENTS endpoint table matches real APIs | DONE | Senior reviewer | Doc diff | `code/mobile/AGENTS.md` updated to real notifications/support endpoints |

## Delivery Matrix

| Requirement | Status | Owner | Priority | Proof required | Evidence |
| --- | --- | --- | --- | --- | --- |
| Forgot PIN route is reachable | DONE | Dev A | P0 | Mobile route test/typecheck | `/auth/forgot-pin` route registered; mobile full Vitest `166 tests` passed; mobile typecheck passed |
| WebAuthn backend registration/auth returns JWT | IN_PROGRESS | Dev A | P0 | Backend API tests + mocked mobile tests + manual biometric video | Backend/mobile wiring added; mocked mobile test passed; cryptographic WebAuthn verification and manual biometric video still pending |
| Notification list/read/subscription APIs exist | IN_PROGRESS | Dev B | P0 | Backend tests and mobile UI test | API/router/schema added; mobile full Vitest `166 tests` passed; backend persistence API tests still pending |
| Client support thread/messages API and UI exist | IN_PROGRESS | Dev C | P0 | Backend tests and mobile UI test | API/router/schema and mobile UI added; mobile full Vitest `166 tests` passed; backend API tests still pending |
| Support attachment upload is size/type/hash checked | IN_PROGRESS | Dev C | P1 | Backend API test + visual upload evidence | Upload endpoint added with type/size/SHA-256 enforcement; backend API test and visual proof still pending |
| Backend access tiers protect banking APIs | IN_PROGRESS | Dev D | P0 | Negative/positive API tests | Banking write guards added; negative/positive API tests still pending |
| Device tag registration and request convention exist | IN_PROGRESS | Dev D | P0 | API test and header evidence | `/devices/register`, `X-Device-Tag`, `X-Device-Fingerprint` convention added; API/header evidence still pending |
| Analytics backoffice route is registered and status queries are current | IN_PROGRESS | Dev E | P0 | Backoffice typecheck/E2E and API response after live API rebuild/restart | `/analytics` route registered in source; lifecycle status queries updated in source; backoffice `tsc --noEmit` passed; Playwright E2E `13 passed` against existing API container, so live API rebuild/restart proof is still pending |
| Mock analytics pages are replaced by live data | PLANNED | Dev E | P1 | Backoffice E2E and API fixtures | Pending |

## Evidence Folders

Store acceptance artifacts under:

- `docs/test-evidence/latest/mobile/`
- `docs/test-evidence/latest/backoffice/`
- `docs/test-evidence/latest/api/`

Manual biometric evidence must be stored as `docs/test-evidence/latest/mobile/webauthn-real-device-demo.md` with the device/browser, date, tester, and video filename.
