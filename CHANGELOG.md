# Changelog

## [Unreleased]

### Weekly recap (2026-05-18 to 2026-05-24)

- Added major mobile enhancements: auth entry and guard flows, lock-screen/biometric and device auto-registration, push notifications, support chat attachments, and an offline ATM finder flow.
- Expanded backend capabilities with device-tag enforcement for banking/KYC routes, support attachment validation/upload endpoints, notification preferences APIs, AML alert detail endpoint, ATM data/model support, and better KYC session integrity/error handling.
- Upgraded backoffice with analytics pages using real API data and role-based views, ATM directory administration, support evidence visibility, command-center loading improvements, and assignment/audit-log behavior fixes.
- Added broad integration and evidence coverage across backend/mobile/backoffice, including KYC auth and ATM integration tests, service worker/support upload tests, and delivery/live-proof documentation updates.
- PR references: none recorded in commit history for this period.

### Weekly recap (2026-05-11 to 2026-05-17)

- Fixed authentication routing for users without a configured PIN, refreshed user state after OTP/PIN flows, and widened KYC review polling coverage to reduce stalled client states.
- Added OCR improvements for CNI processing, including parent-name extraction from card verso and stronger address-detection heuristics.
- Added sanctions staleness monitoring scaffolding and runtime configuration updates for OTP fallback email and service healthcheck compatibility.
- Added Oracle Cloud GLM-OCR deployment planning docs, backup automation scripts (Bash/PowerShell), and related environment configuration entries.
- Improved infrastructure build reliability and speed with apt retry logic, stable cache usage, bun cache mounts, and storage labeling/path updates.
- PR references: none recorded in commit history for this period.

### Weekly recap (2026-05-04 to 2026-05-10)

- Improved OCR and synthetic CNI generation quality with multiple coordinate/layout adjustments and extraction fixes (including reduced parent-name confusion).
- Added camera capture support and dataset-export updates for OCR workflows.
- Added KYC-side improvements for OCR document selection, extracted field handling, and session progression tracking (`ocr_review_confirmed`).
- Strengthened mobile update behavior by improving service-worker refresh/caching strategy to reduce stale frontend builds.
- Added troubleshooting documentation for Git worktree config issues.
- PR references: none recorded in commit history for this period.

### Weekly recap (2026-04-27 to 2026-05-03)

- Delivered major mobile UX and architecture upgrades: ScreenLayoutV2 rollout, dashboard/auth/KYC flow refactors, global layout integration, and performance code-splitting.
- Closed many blocking KYC/backoffice defects (routing, queue visibility, duplicate-session handling, OCR field population, timeline/status mapping, logging and API status propagation).
- Added OCR bill-processing templates, error-tracking hooks, and agent correction UI, while also introducing a banking module foundation (cards, transfers, transactions, savings).
- Expanded platform tooling with CI workflow automation and infrastructure/linting refreshes.
- PR references: none recorded in commit history for this period.

### Weekly recap (2026-04-20 to 2026-04-26)

- Advanced OCR/KYC core pipeline with PaddleX runtime support, positional parsing, HMAC document handles, extraction sanitization/enhancement, and threaded OCR execution.
- Expanded mobile capabilities with offline KYC synchronization, new KYC capture/review screens, dashboard updates, and stronger test coverage/mocks.
- Extended backoffice and backend features: live dashboard stats, support chat/file access, analytics service wiring, auth/session UX hardening, and soft-delete compliance support for users.
- Improved observability and operations with Sentry proxying, encrypted env tooling/scripts, and infrastructure configuration updates.
- PR references: none recorded in commit history for this period.

### Weekly recap (2026-04-14 to 2026-04-19)

- Built out the initial OCR stack and experimentation toolkit: OCR utilities, GLM-OCR migration to CLI subprocess flow, Marimo notebooks, and expanded OCR extraction fields for ID processing.
- Delivered foundational KYC/auth platform increments across backend and PWA/backoffice flows, including capture screens, processing modules, and supporting infra/services/tests.
- Added OCR endpoint and testing-path adjustments (including auth handling changes for upload testing) plus dependency/ignore updates.
- PR references: [#322](https://github.com/Ken-Andre/bicec-veripass/pull/322).

### Weekly recap (2026-04-07 to 2026-04-13)

- Closed multiple security findings from PR checks and code review, including clear-text data handling risks, sensitive logging exposure, and fragile JWT decoding logic.
- Hardened authentication and session handling by removing unsafe client-side token parsing and relying on authoritative backend identity endpoints.
- Stabilized CI pipelines by fixing test collection blockers and import issues, including safer lazy initialization for document storage in CI environments.
- Completed a large backend code quality pass with Ruff: auto-fixes, lint cleanup, and formatting updates across migrations, services, routers, and test suites.
- Improved KYC backend reliability (router and storage paths) to reduce runtime and environment-related failures.
- Applied frontend hardening on mobile and backoffice to remove impure renders and improve type stability in key auth, KYC, analytics, and shared UI components.
- Reduced technical debt across core modules and tests, improving maintainability and lowering regression risk before the next feature cycle.
### Weekly recap (2026-03-30 to 2026-04-05)

- Completed the full mobile authentication journey: email/SMS sign-in, OTP verification, PIN setup and login, biometric login (passkeys[not tested yet]), forgot PIN recovery, and auto-lock after inactivity to prevent unauthorized access.
- Draft the complete mobile identity verification (KYC) flow from start to finish: consent, CNI document capture, face liveness check (fraud prevention), address entry, NIU validation, and final review — backed by a rebuilt KYC backend API.
- Added an AML/CFT (anti-money laundering) system: alert management, NIU conflict detection, automated PEP/sanctions list sync, and a compliance dashboard for the backoffice.
- Added a new audit module that tracks every action in the system for COBAC regulatory compliance, with a system logs page for administrators.
- Added analytics pages to the backoffice: KYC funnel conversion tracking and OCR quality monitoring.
- Added multiple new backoffice pages: validation queue, evidence viewer, compliance dashboard, agency management, and AML alert details.
- Added reusable shared components (confidence bars, image viewer with zoom, address comparison tool) to speed up document review by operators.
- Added automated background jobs (Celery) for compliance tasks: abandoned KYC detection, sanctions freshness checks, and weekly PEP list sync.
- Added comprehensive backend test suites and Docker/Infrastructure improvements.
- Added design assets for authentication and onboarding screens.

### Weekly recap (2026-03-23 to 2026-03-29)

- Hardened authentication with a new JWT service, updated auth router/utils, seed data, and refreshed login/navigation screens.
- Strengthened backups and ops: new backup configuration, maintenance gating with audit logging, and tighter OTP/Redis TTL/versioning defaults.
- Expanded observability by integrating Sentry across backend, backoffice, and mobile (with env templates) and removing test-only UI hooks.
- Secured KYC document handling via SHA-256 verified storage service.
- Added backend tests covering auth schemas, health endpoints, and OTP scenarios.
- PR references: none recorded in commit history for this period.

### Weekly recap (2026-03-16 to 2026-03-22)

- We strengthened the security foundations: tighter JWT/OTP settings, secret scanning, safer env handling with encryption hooks, and clearer production safeguards.
- We delivered a robust OTP flow end-to-end (SMS + email fallback), including session auditing, health checks, better expiry rules, and Redis-backed storage with rate limiting.
- We advanced the data layer with multiple Alembic migrations (core schema, address/AML/DWH, token revocations, OTP session fields).
- We improved platform reliability: Docker builds and health checks, Nginx/TLS fixes, port alignment, and clearer infra troubleshooting guidance.
- We raised observability and ops readiness: Sentry monitoring for frontends, Celery demo endpoints, and Flower monitoring configs.
- We expanded test coverage and stabilized CI with new auth/email OTP tests and CI environment fixes.
- We updated team documentation and delivery standards: testing strategy, best practices, ADRs, review/audit reports, and workflow templates.
## [0.1.7] - 2026-03-16

### Changed
- No code changes this week; no commits have landed after 2026-03-15 (last merge: PR [#198](https://github.com/Ken-Andre/bicec-veripass/pull/198)).

## [0.1.6] - 2026-03-15

### Added
- Backoffice SPA (React/Vite) with auth, RBAC routing, UI components, and Playwright/Vitest coverage for core flows ([#196](https://github.com/Ken-Andre/bicec-veripass/pull/196)).
- Mobile PWA skeleton with service worker registration and refreshed mobile build assets for offline readiness ([#194](https://github.com/Ken-Andre/bicec-veripass/pull/194)).
- Nginx reverse proxy and FastAPI backend bootstrap with TLS 1.3 and security headers to front the platform services ([#198](https://github.com/Ken-Andre/bicec-veripass/pull/198)).

### Fixed
- Hardened Nginx routing and `/health` headers, plus TLS and deployment configuration regressions ([#198](https://github.com/Ken-Andre/bicec-veripass/pull/198)).
- Resolved backoffice TypeScript errors and generator markup issues after the initial SPA build ([#196](https://github.com/Ken-Andre/bicec-veripass/pull/196)).
- Cleaned PWA service worker registration and removed unused mobile code to stabilize offline behavior ([#194](https://github.com/Ken-Andre/bicec-veripass/pull/194)).

