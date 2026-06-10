# Development Guide

Updated: 2026-05-28

This guide is the day-to-day engineering entry point. It assumes Windows with Docker Desktop and PowerShell, because that is the primary local environment used by this project.

## Prerequisites

Required:

- Docker Desktop with WSL2 backend.
- Git.
- PowerShell.
- Bun for frontend development and tests.
- At least 16 GB RAM.

Useful:

- DBeaver or pgAdmin for PostgreSQL inspection.
- RedisInsight for Redis inspection.
- mkcert for trusted local TLS certs.
- Python only if running backend tools outside Docker.

## First Setup

From the repository root:

```powershell
copy code\.env.example code\.env
notepad code\.env
```

Set at least:

- `DB_PASSWORD`
- `JWT_SECRET`
- `AES_SECRET_KEY`
- `FLOWER_USER`
- `FLOWER_PASSWORD`
- `OTP_MODE=dev_local` for local development unless testing email/SMS.
- `OFFLINE_MODELS_DIR=./infra/models-offline` unless using another model directory.

Configure WSL2 before running OCR-heavy services:

```powershell
copy code\infra\.wslconfig.template $env:USERPROFILE\.wslconfig
notepad $env:USERPROFILE\.wslconfig
wsl --shutdown
```

Create external volumes without deleting existing data:

```powershell
.\code\scripts\ensure_docker_volumes.ps1
```

## Start The Stack

Full local stack:

```powershell
docker compose -f code/docker-compose.yml up -d api pwa backoffice postgres redis celery_ocr celery_notifications celery_beat mailpit nginx flower
docker compose -f code/docker-compose.yml ps
```

Do not use the `online-init` profile during normal demos. It is for model download/bootstrap only.

## Local URLs

| Purpose | URL |
| --- | --- |
| Mobile PWA through Nginx | `https://localhost/mobile/` |
| Backoffice through Nginx | `https://localhost/back-office/` |
| API docs through Nginx | `https://localhost/api/v1/docs` |
| Health through Nginx | `https://localhost/health` |
| Flower through Nginx | `https://localhost/flower/` |
| Mobile direct debug | `http://localhost:3000/mobile/` |
| Backoffice direct debug | `http://localhost:3001/` |
| API direct health | `http://localhost:8001/api/health` |
| API direct docs | `http://localhost:8001/api/v1/docs` |
| Mailpit | `http://localhost:8025/` |
| Flower direct | `http://localhost:5555/` |
| PostgreSQL host port | `localhost:15432` |
| Redis host port | `localhost:16379` |

## Verify The Stack

```powershell
Invoke-RestMethod http://localhost:8001/api/health
.\code\scripts\smoke_mvp_docker.ps1
```

Expected health status is `ok` when PostgreSQL and Redis are reachable.

## Seed Accounts

When `ENVIRONMENT=development`, seed data is created automatically on API startup. Demo accounts:

| Persona | Email | Role | Password |
| --- | --- | --- | --- |
| Jean Dupont | `jean@bicec.cm` | `JEAN` | `password123` |
| Thomas Martin | `thomas@bicec.cm` | `THOMAS` | `password123` |
| Sylvie Bernard | `sylvie@bicec.cm` | `SYLVIE` | `password123` |
| Admin IT | `admin@bicec.cm` | `ADMIN_IT` | `password123` |

If seed data is missing:

```powershell
docker compose -f code/docker-compose.yml exec -T api python scripts/seed_dev.py
```

Optional banking demo data:

```powershell
docker compose -f code/docker-compose.yml exec -T api python scripts/seed_banking.py
```

## Backend Development

Run tests inside the API container:

```powershell
docker compose -f code/docker-compose.yml exec -T api pytest
```

Run Alembic:

```powershell
docker compose -f code/docker-compose.yml exec -T api alembic current
docker compose -f code/docker-compose.yml exec -T api alembic upgrade head
```

Create a migration:

```powershell
docker compose -f code/docker-compose.yml exec -T api alembic revision --autogenerate -m "short description"
```

Rebuild/restart only the API:

```powershell
docker compose -f code/docker-compose.yml build api
docker compose -f code/docker-compose.yml up -d api
```

If you changed Celery task code, restart affected workers too:

```powershell
docker compose -f code/docker-compose.yml up -d celery_ocr celery_notifications celery_beat
```

## Mobile Development

```powershell
cd code\mobile
bun install
bun run dev
bun run test
bun run build
bun run test:e2e
```

Evidence run:

```powershell
$env:BASE_URL='https://localhost'
bun run test:evidence
```

Key mobile files:

- `src/App.tsx`: routes.
- `src/contexts/AuthContext.tsx`: client auth.
- `src/contexts/KycContext.tsx`: KYC session state.
- `src/hooks/useKycFlow.tsx`: KYC route guard.
- `src/services/kycSyncService.ts`: offline replay.
- `src/views/kyc/*`: KYC screens.

## Backoffice Development

```powershell
cd code\backoffice
bun install
bun run dev
bun run test
bunx tsc --noEmit
bun run build
bun run test:e2e
```

Evidence run:

```powershell
$env:BASE_URL='https://localhost'
bun run test:evidence
```

Key backoffice files:

- `src/App.tsx`: role-protected routes.
- `src/contexts/AuthContext.tsx`: agent auth.
- `src/services/api-client.ts`: fetch helpers.
- `src/services/dossier-service.ts`: queue/review APIs.
- `src/services/aml-service.ts`: compliance APIs.
- `src/pages/validation/*`: Jean flow.
- `src/pages/compliance/*`: Thomas flow.
- `src/pages/command-center/*`: Sylvie flow.
- `src/pages/admin/*`: Admin IT flow.

## Common Change Recipes

### Add A Backend Endpoint

1. Add Pydantic request/response schemas.
2. Add service logic if the endpoint has business rules.
3. Add route to the owning module router.
4. Add tests.
5. Update frontend service/type if consumed by UI.
6. Update [API Contracts](./api-contracts.md).

### Add A Database Field

1. Update SQLAlchemy model.
2. Update Pydantic schema if exposed.
3. Create Alembic migration.
4. Add/update tests.
5. Verify `alembic upgrade head`.
6. Update [Data Models](./data-models.md).

### Change A KYC Step

1. Update mobile screen and route sequencing.
2. Update `useKycFlow` and `KycContext` reconciliation.
3. Update backend readiness/submission logic.
4. Update offline sync queue if the step can happen offline.
5. Add frontend and backend tests.
6. Run evidence flow if it affects the demo journey.

### Change A Backoffice Role

1. Update backend `require_agent_role` usage.
2. Update backoffice `App.tsx` route roles.
3. Update Sidebar/RoleRedirect if navigation changes.
4. Add role-based tests.
5. Update this guide and [Component Inventory](./component-inventory.md).

### Change OCR Behavior

1. Start in `code/backend/app/modules/kyc/service.py`.
2. Check `code/backend/app/services/ocr_service.py`.
3. If fallback changes, update `code/backend/app/tasks/ocr.py`.
4. Check Compose env values and worker memory limits.
5. Test with known CNI images and the KYC happy path.

## Test Map

| Area | Location | Command |
| --- | --- | --- |
| Backend unit/integration | `code/backend/tests` | `docker compose -f code/docker-compose.yml exec -T api pytest` |
| Mobile unit/components | `code/mobile/src/**/*.test.*` | `cd code/mobile; bun run test` |
| Mobile E2E | `code/mobile/tests/e2e` | `cd code/mobile; bun run test:e2e` |
| Mobile evidence | `code/mobile/playwright.evidence.config.ts` | `cd code/mobile; bun run test:evidence` |
| Backoffice unit/components | `code/backoffice/src/**/*.test.*` | `cd code/backoffice; bun run test` |
| Backoffice E2E | `code/backoffice/src/test/e2e` | `cd code/backoffice; bun run test:e2e` |
| Backoffice evidence | `code/backoffice/playwright.evidence.config.ts` | `cd code/backoffice; bun run test:evidence` |
| Docker smoke | `code/scripts/smoke_mvp_docker.ps1` | `.\code\scripts\smoke_mvp_docker.ps1` |

## Safety Rules

- Do not commit cleartext `.env`, `.env.pass`, or decrypted `new.env`.
- Do not run `docker compose down -v` on shared or long-lived environments.
- Do not delete `code_db_storage`, `code_documents_storage`, or `code_db_backups` unless explicitly asked.
- Do not run Docker prune with `--volumes`.
- Keep `OTP_MODE=dev_local` in local development unless testing delivery channels.
- Keep `OCR_ONLINE=false` unless explicitly testing Oracle Cloud OCR.
- Treat `docs/test-evidence/` as generated evidence; do not hand-edit screenshots or traces.

## Before Handing Work Off

Run the narrow checks for the area you changed, then run the smoke check if the stack is affected.

Minimum handoff note should include:

- What changed.
- Files changed.
- Tests run.
- Any tests not run and why.
- Any data migration or environment change required.
