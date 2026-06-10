---
project_name: "bicec-veripass"
user_name: "Ken"
date: "2026-05-31"
status: "complete"
optimized_for_llm: true
sections_completed:
  - source_of_truth
  - current_scope
  - architecture
  - state_access_model
  - module_map
  - implementation_rules
  - testing_ops
  - obsolete_scope_warnings
rule_count: 73
---

# Project Context for AI Agents

Lean handoff context for downstream BMAD agents. Use this before implementing or reviewing code in BICEC VeriPass.

## Source Of Truth

- Trust order: current code under `code/` and Alembic migrations first, then canonical docs under `docs/`, then dated reports only as evidence snapshots.
- Start with `docs/documentation-authority.md`. It explicitly limits product scope and marks `_bmad-output/planning-artifacts/*`, `docs/agents_output/*`, many diagrams, prototype prompts, and scratch folders as historical.
- Do not use old BMAD planning artifacts as roadmap, architecture, or state-machine authority. They can explain history only.
- If docs disagree with implementation, inspect the owning code path and update canonical docs when the behavior is intentionally changed.
- Exact contracts can drift from `openapi-spec.json`; use runtime `/api/v1/openapi.json` or the FastAPI router/schema files when precision matters.
- Preserve generated/evidence areas unless explicitly tasked: `docs/test-evidence/`, logs, backups, screenshots, and large artifacts.

## Current Product Scope

- VeriPass is a sovereign digital KYC onboarding, verification, audit, and eligibility guardrail system for BICEC.
- Automation prepares the dossier; human backoffice validation makes approval decisions.
- VeriPass stores verified KYC state in its own PostgreSQL database and stores KYC files in Docker document volumes.
- Approved users may be handed off to BI PAY, BICEC Mobile-Banking, or BICEC Wallet by OS-aware app links, deep links, QR/landing fallback, or store redirects.
- Downstream app destinations must be configuration-driven; do not hard-code package IDs or unconfirmed store URLs in components.
- VeriPass is not a DGI integration, not a Sopra Amplitude integration, not an Axway/core-banking provisioning layer, and not a commitment to external transactional banking integration.

## Technology Stack And Versions

- Runtime: Docker Compose, Nginx TLS reverse proxy, PostgreSQL 17, Redis 7, Mailpit, Flower, external Docker volumes.
- Backend: Python >=3.11, FastAPI >=0.115, Pydantic v2, async SQLAlchemy >=2.0, asyncpg, Alembic, Redis, Celery >=5.3, SlowAPI, Sentry SDK, python-jose, passlib/bcrypt.
- OCR/biometrics: PaddleOCR >=2.8, PaddlePaddle >=2.6, OpenCV headless, GLM-OCR fallback via Celery, DeepFace >=0.0.89, tf-keras for TensorFlow 2.16+ compatibility.
- Mobile PWA: React 19.2, Vite 8, TypeScript 5.9, React Router 7, TanStack Query 5, Tailwind CSS 4, Workbox, MediaPipe tasks vision, Sentry 10.
- Backoffice SPA: React 19.2, Vite 5.4, TypeScript 5.9, React Router 6.30, TanStack Query 5, Recharts 3.8, Tailwind CSS 4, Sentry 10.
- Test tools: backend pytest/pytest-asyncio; frontend Vitest, Testing Library, Playwright evidence specs; Docker smoke script.

## Architecture Summary

- Public local paths through Nginx: `/mobile/`, `/back-office/`, `/api/`, `/api/v1/*`, `/health`, `/flower/`.
- Backend entry points: `code/backend/app/main.py`, `app/api/v1/router.py`, `app/core/config.py`, `app/core/security.py`, `app/core/celery_config.py`, `app/db/session.py`.
- API modules normally own `models.py`, `schemas.py`, `router.py`, and `service.py`; keep business rules out of frontend-only code.
- KYC documents are filesystem/volume objects under `/data/documents`; database rows keep relative paths, type, OCR metadata, size, and SHA-256 hash. Do not move large images into PostgreSQL BYTEA.
- Celery queues handle OCR fallback, notification delivery, sanctions sync, scheduled backup/check jobs, abandoned sessions, document expiry, and active-client screening.
- Nginx owns TLS, path routing, static SPA fallbacks, security headers, CSP, and extended OCR/liveness timeouts.
- Frontends are separate apps with separate token keys and API clients. Do not share mobile `vp_token` assumptions with backoffice `veripass_access_token`.

## State And Access Model

- Source of truth: `code/backend/app/modules/kyc/schemas.py`; transition logic is mainly in `kyc/router.py` and `backoffice/router.py`.
- Current active lifecycle/access pairs: `DRAFT -> GUEST`, `PENDING_AGENT_REVIEW` or `PENDING_KYC -> RESTRICTED`, `PENDING_INFO -> RESTRICTED`, `APPROVED -> LIMITED_ACCESS`, `FRAUD_SUSPECT -> DISABLED`, `REJECTED` or `ABANDONED -> GUEST`, `LOCKED_LIVENESS -> RESTRICTED`.
- Submission transitions `DRAFT` or `PENDING_INFO` to `PENDING_AGENT_REVIEW`; `PENDING_INFO` is editable so the client can add complements and resubmit the same dossier.
- `PENDING_KYC` remains a legacy alias used by existing backend/frontend code and seed/evidence data; handle it for compatibility, but prefer `PENDING_AGENT_REVIEW` for new flow work.
- `SUBMITTED`, `PROCESSING`, and `ACCOUNT_CREATED` appear in schema/legacy/docs contexts. Do not expand them into a new product workflow without an explicit requirement and code changes.
- Backoffice decisions: `JEAN` can approve/reject/request info; `THOMAS` can flag fraud/request info and from fraud can reject; `SYLVIE` can approve/reject/request info/flag fraud; `ADMIN_IT` does not review dossiers.
- Approval requires resolving open AML statuses and may require explicit biometric override confirmation when risk flags exist.
- Sensitive mobile/banking write actions may require a registered `X-Device-Tag` once the user has active device registrations.

## Module Map

- Backend modules: `auth`, `kyc`, `backoffice`, `admin`, `aml`, `analytics`, `audit`, `banking`, `devices`, `notifications`, `support`. Empty or cache-only directories are not product modules.
- `auth`: mobile OTP/email/PIN/passkeys, agent login, token refresh and revocation, soft-delete behavior.
- `kyc`: sessions, document capture/upload, OCR review, liveness, address, NIU, consent, signature, readiness, submit, review status, ATMs.
- `backoffice`: queue, dossier detail, evidence file access, assignment, review decision, OCR correction, support thread handling, audit views.
- `aml`: AML alerts, NIU conflicts, agencies, document expiry, list import, batch jobs, global notifications.
- `banking`: local guarded product shell for account/cards/transfers/transactions/savings. It is not a real banking-core adapter.
- `analytics` and `audit`: role-aware metrics, DWH/event layer, audit listing, COBAC export.
- Mobile key files: `src/App.tsx`, `contexts/AuthContext.tsx`, `contexts/KycContext.tsx`, `hooks/useKycFlow.tsx`, `services/apiClient.ts`, `services/kycOfflineStore.ts`, `services/kycSyncService.ts`.
- Backoffice key files: `src/App.tsx`, `contexts/AuthContext.tsx`, `components/auth/ProtectedRoute.tsx`, `services/api-client.ts`, `services/dossier-service.ts`, `services/aml-service.ts`.

## Implementation Rules

- Backend endpoints live under `/api/v1` unless intentionally documented otherwise; clients send/accept `X-Correlation-ID`, and authenticated calls use `Authorization: Bearer <access_token>`.
- File upload endpoints use multipart form data; OCR and liveness paths may need longer timeouts and should respect Nginx/backend timeout assumptions.
- Change order for DB/API work: SQLAlchemy model, Pydantic schema, Alembic migration, tests, frontend types/services, canonical docs.
- Change order for KYC step work: mobile route/screen, `useKycFlow`, `KycContext`, offline sync handling, backend readiness/submission logic, tests/evidence.
- Change order for role work: backend `require_agent_role` usage, backoffice route roles, sidebar/redirect behavior, role tests, docs.
- Keep OCR changes coordinated across `kyc/service.py`, `services/ocr_service.py`, `tasks/ocr.py`, Compose env vars, worker memory limits, and known CNI test images.
- Keep offshore/online OCR disabled by default. `OCR_ONLINE=true` is only for explicit cloud OCR testing with complete encrypted Oracle Cloud config.
- Keep local/demo OTP on `OTP_MODE=dev_local`; production rejects this mode and placeholder JWT/CORS settings.
- Use frontend TypeScript strict settings: no unused locals/params, no fallthrough switch cases, no unchecked side-effect imports, bundler module resolution, `@/*` path alias.
- Use existing frontend primitives, service wrappers, TanStack Query patterns, lazy route maps, lucide icons, and local API clients instead of adding a new UI kit or shared cross-app token layer.
- When backend response fields change, update the affected frontend TypeScript types and services in the owning app.
- Support attachments and KYC documents must preserve validation, hash metadata, and volume storage semantics.
- Do not commit or expose cleartext `.env`, `.env.pass`, decrypted `new.env`, secrets, private certs, or real customer data.

## Testing And Ops Pointers

- Backend tests: `docker compose -f code/docker-compose.yml exec -T api pytest`.
- Backend migrations: run `alembic current` and `alembic upgrade head` inside the API container.
- Mobile checks: from `code/mobile`, run `bun run test`, `bun run build`, and targeted `bun run test:e2e` or `bun run test:evidence`.
- Backoffice checks: from `code/backoffice`, run `bun run test`, `bunx tsc --noEmit`, `bun run build`, and targeted `bun run test:e2e` or `bun run test:evidence`.
- Stack smoke: `.\code\scripts\smoke_mvp_docker.ps1`; health endpoints are `http://localhost:8001/api/health` and `https://localhost/health`.
- Main local URLs: `https://localhost/mobile/`, `https://localhost/back-office/`, `https://localhost/api/v1/docs`, `https://localhost/flower/`, `http://localhost:8025/`.
- Restart affected Celery workers when task code or imports change; rebuild API/workers when dependencies or image-level files change.
- Do not run `docker compose down -v`, delete `code_db_storage`, `code_documents_storage`, or `code_db_backups`, or prune Docker volumes unless the user explicitly asks for destructive reset.
- Evidence files under `docs/test-evidence/latest/*` are generated proof. Rerun the relevant evidence command instead of hand-editing screenshots/traces.

## Obsolete Scope Warnings

- Treat `_bmad-output/planning-artifacts/*` as historical even when file names look authoritative.
- Treat `docs/diagrams/*`, `docs/agents_output/*`, `docs/stitch-prompts.md`, `docs/consultant-integration-prompt.md`, and `docs/integration-analysis-gatekeeper.md` as historical/prototype context unless a current canonical doc or code path confirms the claim.
- Do not reintroduce DGI, Sopra Amplitude, Axway provisioning, core-banking account creation, or transactional banking integration from old diagrams, reports, table labels, or demo batch names.
- Do not use old states like `READY_FOR_OPS`, `PROVISIONING`, `OPS_ERROR`, or `VALIDATED_PENDING_AGENCY` as implemented workflow states. Some frontend mock/demo files still mention them and should not drive new behavior.
- Do not assume a Flutter mobile app. The implemented mobile app is a React/Vite PWA.
- Do not turn historical "Phase 2" or backlog text into roadmap commitments without a new issue, ADR, or explicit requirement.

## Usage Guidelines

- Agents: read this file before implementation, then inspect the specific owning files before editing.
- Agents: prefer the narrower current code path over broad historical architecture when resolving ambiguity.
- Maintainers: keep this file lean; update it when source-of-truth docs, KYC state/access rules, stack versions, or module boundaries change.

Last Updated: 2026-05-31
