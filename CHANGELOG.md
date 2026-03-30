# Changelog

## [Unreleased]

### Weekly recap (2026-03-23 to 2026-03-29)

- Hardened authentication with a new JWT service, updated auth router/utils, seed data, and refreshed login/navigation screens.
- Strengthened backups and ops: new backup configuration, maintenance gating with audit logging, and tighter OTP/Redis TTL/versioning defaults.
- Expanded observability by integrating Sentry across backend, backoffice, and mobile (with env templates) and removing test-only UI hooks.
- Secured KYC document handling via SHA-256–verified storage service.
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
