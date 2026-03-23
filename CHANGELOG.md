# Changelog

## [Unreleased]

### Weekly recap (2026-03-23 to 2026-03-29)

- No new commits or merged PRs recorded after 2026-03-22; this section will expand once changes land.

### Weekly recap (2026-03-16 to 2026-03-22)

- We strengthened the security foundations: tighter JWT/OTP settings, secret scanning, safer env handling with encryption hooks, and clearer production safeguards.
- We delivered a robust OTP flow end-to-end (SMS + email fallback), including session auditing, health checks, better expiry rules, and Redis-backed storage with rate limiting.
- We advanced the data layer with multiple Alembic migrations (core schema, address/AML/DWH, token revocations, OTP session fields).
- We improved platform reliability: Docker builds and health checks, Nginx/TLS fixes, port alignment, and clearer infra troubleshooting guidance.
- We raised observability and ops readiness: Sentry monitoring for frontends, Celery demo endpoints, and Flower monitoring configs.
- We expanded test coverage and stabilized CI with new auth/email OTP tests and CI environment fixes.
- We updated team documentation and delivery standards: testing strategy, best practices, ADRs, review/audit reports, and workflow templates.
