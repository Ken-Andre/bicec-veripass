# Source Tree Analysis

Updated: 2026-05-28

This document explains where code lives and what a maintainer should edit for common changes.

## Top-Level Tree

```text
bicec-veripass/
|-- code/                         Main implemented application
|   |-- backend/                   FastAPI, SQLAlchemy, Celery, Alembic
|   |-- mobile/                    React/Vite mobile PWA
|   |-- backoffice/                React/Vite backoffice SPA
|   |-- infra/                     Nginx, TLS, offline model mounts
|   |-- scripts/                   Ops and evidence scripts
|   |-- docs/                      Code-local operational docs
|   |-- db/                        PostgreSQL init SQL
|   |-- docker-compose.yml         Local MVP runtime stack
|   `-- .env.example               Main environment template
|-- docs/                          Project handover docs, ADRs, diagrams, evidence
|-- _bmad-output/planning-artifacts/ PRD, architecture, UX, epics, backlog
|-- .github/                       GitHub workflows/templates if present
|-- scripts/                       Repo-level helper scripts
`-- package.json                   Root tooling metadata, not the app runtime
```

## Backend Tree

```text
code/backend/
|-- app/
|   |-- main.py                    FastAPI app startup and router registration
|   |-- api/v1/router.py           Aggregates module routers under /api/v1
|   |-- api/v1/ocr.py              Direct OCR utility/test endpoints
|   |-- api/v1/sentry_proxy.py     Same-origin Sentry envelope proxy
|   |-- core/
|   |   |-- config.py              Settings, env validation, defaults
|   |   |-- security.py            JWT, bcrypt, current user/agent, RBAC
|   |   |-- celery_config.py       Celery includes and beat schedule
|   |   |-- redis.py               Redis connection helpers
|   |   |-- rate_limit.py          SlowAPI limiter
|   |   |-- logging.py             Structured logging
|   |   `-- exceptions.py          FastAPI exception handlers
|   |-- db/
|   |   |-- session.py             Async SQLAlchemy engine/session
|   |   |-- base.py                Model metadata imports
|   |   |-- seed_data.py           Development agent/agency seed data
|   |   `-- seed_*.py              Scenario/demo seed data
|   |-- modules/
|   |   |-- auth/                  OTP, PIN, passkeys, agent auth, tokens
|   |   |-- kyc/                   Client KYC journey, documents, OCR, liveness
|   |   |-- backoffice/            Queue, dossier review, assignment, support
|   |   |-- aml/                   Alerts, conflicts, agencies, batch jobs
|   |   |-- analytics/             Dashboard and operational metrics
|   |   |-- audit/                 Audit logs and COBAC export
|   |   |-- admin/                 Agent administration
|   |   |-- banking/               Account/cards/transfers/savings preview
|   |   |-- devices/               Device-tag registration/enforcement
|   |   |-- notifications/         Preferences, push subscriptions, inbox
|   |   `-- support/               Client support messages and attachments
|   |-- services/
|   |   |-- ocr_service.py         OCR preprocessing and helpers
|   |   |-- glm_utils.py           GLM-OCR utility layer
|   |   `-- iso20022_service.py    Transfer XML generation
|   `-- tasks/
|       |-- maintenance.py         Backups and disk checks
|       |-- ocr.py                 GLM fallback/cloud OCR
|       |-- kyc.py                 KYC scheduled operations
|       `-- sanctions.py           PEP/sanctions sync
|-- alembic/
|   `-- versions/                  Schema migrations
|-- tests/                         Backend integration/unit tests
|-- Dockerfile                     API/worker image
|-- entrypoint.sh                  Startup, migrations, server
|-- pyproject.toml                 Dependencies and pytest config
`-- uv.lock                        Locked Python dependencies
```

## Backend Editing Guide

| If you need to change... | Start in... | Also check... |
| --- | --- | --- |
| Mobile login/OTP/PIN/passkeys | `modules/auth/router.py` | `modules/auth/schemas.py`, `modules/auth/tasks.py`, `core/security.py`, mobile auth views |
| KYC document capture | `modules/kyc/router.py` | `modules/kyc/storage.py`, `modules/kyc/service.py`, mobile KYC screens |
| OCR extraction behavior | `modules/kyc/service.py` | `services/ocr_service.py`, `tasks/ocr.py`, env variables in Compose |
| Liveness/face matching | `modules/kyc/service.py` | `modules/kyc/router.py`, mobile `LivenessScreen.tsx` |
| KYC submission readiness | `modules/kyc/router.py` | `modules/kyc/schemas.py`, mobile `ReviewScreen.tsx` |
| Backoffice queue/review | `modules/backoffice/router.py` | `modules/backoffice/schemas.py`, backoffice dossier pages |
| Agent roles/RBAC | `core/security.py` | `modules/auth/models.py`, `modules/backoffice/router.py`, backoffice routes |
| AML alert logic | `modules/aml/service.py` | `modules/aml/router.py`, `modules/kyc/models.py` |
| Analytics cards | `modules/analytics/service.py` | `modules/analytics/router.py`, backoffice analytics pages |
| DB table/field | `modules/*/models.py` | Alembic migration, schemas, tests |
| Celery schedule | `core/celery_config.py` | task implementation and Compose worker queue |
| Backup behavior | `tasks/maintenance.py` | `code/scripts/backup_*`, Compose volumes/env |

## Mobile PWA Tree

```text
code/mobile/
|-- src/
|   |-- App.tsx                    Route map and providers
|   |-- main.tsx                   React entry point
|   |-- contexts/
|   |   |-- AuthContext.tsx        Client session, token, lock handling
|   |   |-- KycContext.tsx         KYC state hydration/reconciliation
|   |   `-- LanguageContext.tsx    i18n state and translations
|   |-- views/
|   |   |-- auth/                  Auth, OTP, PIN, lock, biometric opt-in
|   |   |-- kyc/                   KYC step screens
|   |   |-- dashboard/             Banking preview/dashboard screens
|   |   |-- settings/              Account settings/delete
|   |   `-- HomePage.tsx           Landing/auth decision screen
|   |-- components/
|   |   |-- ui/                    Reusable UI primitives
|   |   |-- BottomNav.tsx          Dashboard navigation
|   |   |-- DashboardLayout.tsx    Dashboard shell
|   |   |-- KycHydrationGate.tsx   Waits for backend KYC state
|   |   `-- KycResumeBanner.tsx    Resume prompt
|   |-- hooks/
|   |   |-- useKycFlow.tsx         Step guard and route reconciliation
|   |   |-- useConnectivity.ts     Network/offline state
|   |   `-- use-service-worker.ts  PWA update prompt
|   |-- services/
|   |   |-- apiClient.ts           Fetch wrapper, token/device/correlation headers
|   |   |-- kycOfflineStore.ts     IndexedDB queue
|   |   |-- kycSyncService.ts      Offline replay and submission blockers
|   |   |-- deviceRegistrationService.ts
|   |   |-- passkeyService.ts
|   |   |-- pushNotificationService.ts
|   |   `-- sentry.ts
|   `-- types/index.ts             Shared client-side domain types
|-- tests/e2e/                     Playwright mobile flows/evidence
|-- Dockerfile                     Bun build + Nginx static image
|-- package.json                   Scripts and dependencies
`-- vite.config.ts                 Vite config
```

## Mobile Editing Guide

| If you need to change... | Start in... | Also check... |
| --- | --- | --- |
| Route or screen sequence | `src/App.tsx` | `hooks/useKycFlow.tsx`, tests |
| Auth state | `contexts/AuthContext.tsx` | `services/apiClient.ts`, backend auth router |
| KYC state hydration | `contexts/KycContext.tsx` | `hooks/useKycFlow.tsx`, backend session endpoints |
| Offline KYC replay | `services/kycOfflineStore.ts`, `kycSyncService.ts` | affected KYC screens and tests |
| CNI capture | `views/kyc/CniCaptureScreen.tsx` | backend `/kyc/capture/cni` |
| Liveness UX | `views/kyc/LivenessScreen.tsx` | backend liveness endpoint and biometric service |
| Dashboard cards/transfers/savings | `views/dashboard/*` | backend `banking` module |
| Notifications | `views/dashboard/NotificationsScreen.tsx` | backend `notifications` module |
| Support chat | `views/dashboard/SupportScreen.tsx` | backend `support` module |

## Backoffice Tree

```text
code/backoffice/
|-- src/
|   |-- App.tsx                    Role-protected route map
|   |-- main.tsx                   React entry point
|   |-- contexts/
|   |   |-- AuthContext.tsx        Agent auth and refresh handling
|   |   `-- ToastContext.tsx       Toast notifications
|   |-- components/
|   |   |-- auth/                  ProtectedRoute and RoleRedirect
|   |   |-- layout/                MainLayout, Header, Sidebar
|   |   |-- shared/                Dossier/evidence UI widgets
|   |   `-- ui/                    Reusable UI primitives
|   |-- pages/
|   |   |-- validation/            Jean queue and evidence viewer
|   |   |-- compliance/            Thomas AML/conflict pages
|   |   |-- command-center/        Sylvie command center
|   |   |-- analytics/             Role-shared analytics
|   |   |-- admin/                 Admin IT agents, ATMs, audit
|   |   |-- LoginPage.tsx
|   |   |-- ProfilePage.tsx
|   |   `-- UnauthorizedPage.tsx
|   |-- services/
|   |   |-- api-client.ts          Fetch helpers
|   |   |-- dossier-service.ts     Queue/dossier/review APIs
|   |   |-- aml-service.ts         Compliance APIs
|   |   `-- sentry.ts
|   |-- hooks/
|   |   |-- useQueryHooks.ts       React Query wrappers
|   |   `-- usePagination.ts
|   |-- types/                     Auth, KYC, AML, audit types
|   `-- lib/                       State machine, utilities, export helpers
|-- src/test/e2e/                  Playwright evidence specs
|-- Dockerfile                     Bun build + Nginx static image
|-- package.json                   Scripts and dependencies
`-- vite.config.ts                 Vite config
```

## Backoffice Editing Guide

| If you need to change... | Start in... | Also check... |
| --- | --- | --- |
| Role route access | `src/App.tsx` | `components/auth/ProtectedRoute.tsx`, backend RBAC |
| Agent login/session | `contexts/AuthContext.tsx` | backend `/auth/agent/*` endpoints |
| Validation queue | `pages/validation/ValidationQueuePage.tsx` | `services/dossier-service.ts`, backend backoffice router |
| Dossier evidence viewer | `pages/validation/EvidenceViewerPage.tsx` | shared evidence components, backend file endpoints |
| AML dashboard | `pages/compliance/*` | `services/aml-service.ts`, backend AML module |
| Analytics | `pages/analytics/AnalyticsPage.tsx` | backend analytics service |
| Command center | `pages/command-center/CommandCenterPage.tsx` | `/backoffice/agents/load` endpoint |
| Admin agents/ATMs | `pages/admin/AdminPage.tsx` | backend admin and KYC ATM endpoints |
| COBAC export/audit | `pages/admin/SystemLogsPage.tsx` | backend audit module |

## Infrastructure And Scripts

```text
code/infra/
|-- nginx/
|   |-- nginx.conf                 Public routing, TLS, CSP, rate limits
|   |-- security_headers.conf      Shared security headers
|   |-- ssl/                       Local certs
|   `-- Dockerfile
|-- .wslconfig.template            Windows/WSL memory guidance
`-- models-offline/                Local model directory when present

code/scripts/
|-- ensure_docker_volumes.*        Create missing external volumes
|-- smoke_mvp_docker.ps1           Main MVP smoke check
|-- encrypt-all-envs.*             Encrypt env files
|-- decrypt-all-envs.*             Decrypt env files into new.env
|-- backup_db.sh                   Database backup helper
|-- restore_db.sh                  Database restore helper
|-- backup-docker-images.*         Docker image archive helper
|-- docker_prune.*                 Non-volume Docker cleanup
|-- prepare-offline-models.ps1     Offline model preparation
`-- run_kyc_happy_path_acceptance.py Evidence/acceptance helper
```

## Generated Or Heavy Areas

Treat these as generated, large, or evidence-heavy:

- `docs/test-evidence/`
- `logs/`
- `artifacts/`
- `code/backups/`
- `paddleocr_test/`
- `veripass-images.tar`
- screenshots in the repository root

Do not clean them up unless the user explicitly asks. Some evidence files are intentionally preserved for final delivery.
