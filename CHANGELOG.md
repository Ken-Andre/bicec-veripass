# Changelog

## [Unreleased]

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

