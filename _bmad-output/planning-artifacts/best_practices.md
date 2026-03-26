### 📘 Project Best Practices

#### 1. Project Purpose
BICEC VeriPass is a KYC/onboarding platform that provides a FastAPI backend, a mobile PWA front-end, and backoffice tooling for human review. Core responsibilities include OTP-based authentication, document capture + OCR, liveness checks, KYC session state management, and agent workflows.

#### 2. Project Structure
- Top-level
  - code/ — primary application code and infra
    - backend/ — FastAPI backend service
      - app/
        - core/ — shared infrastructure (config, logging, email, sms, redis helpers, security)
        - modules/ — domain modules (auth, kyc, etc.)
        - api/ routers and entrypoints
        - celery.py / tasks/ — asynchronous workers
        - db/ — DB session and models
        - main.py — FastAPI app startup
    - backoffice/ — backoffice frontend (separate app)
    - mobile/ — mobile / PWA client
    - docker-compose.yml, .env.example — environment and local orchestration
  - docs/ — documentation and ADRs
  - infra/ — infra scripts/templates
  - tests/ (recommended) — tests (unit/integration)
- Roles of key files
  - code/backend/app/core/config.py — pydantic Settings for environment config
  - code/backend/app/core/email.py — SMTP/email client wrapper
  - code/backend/app/modules/auth/* — auth flows, OTP, tokens, auditing
  - docker-compose.yml — local dev infra (uses mailpit for dev SMTP)
  - .env.example — canonical environment variables for local/dev

Separation of concerns
- infra vs domain: core contains reusable infra (email, SMS, redis clients), modules contain business logic (auth, kyc).
- Async vs sync: network IO (HTTP, Redis, DB) is async inside FastAPI; Celery tasks may be synchronous wrappers around async flows.

#### 3. Test Strategy
- Preferred frameworks (historical / recommended)
  - Backend: pytest + pytest-asyncio for async endpoints
  - Unit tests: isolated functions, utilities (hashing, state machine)
  - Integration tests: FastAPI TestClient or pytest-asyncio using a test DB and fake Redis (fakeredis)
  - E2E: Playwright (PWA flows) and Playwright/Playwright Test for browser flows
- Organization
  - tests/unit/, tests/integration/, tests/api/, tests/e2e/
  - conftest.py to provide fixtures for DB, Redis, and Celery (eager) configuration
- Mocks & fixtures
  - Use pytest fixtures to provide test DB (pytest-postgresql or SQLite in-memory with migrations)
  - Use fakeredis or a Redis docker container for integration; mock external services (Orange SMS, SMTP) with HTTP mocks or local mailpit server
  - For Celery tasks, run with eager mode in tests (CELERY_TASK_ALWAYS_EAGER) or spawn worker in test harness
- When to write which test
  - Unit tests: pure business logic, validators, hashing, token generation
  - Integration tests: endpoints + DB + Redis side effects
  - E2E: full onboarding journeys, liveness + OCR pipeline, agent backoffice flows
- Coverage guidance
  - Prioritize critical flows (auth, KYC state transitions, OCR pipeline) for higher coverage
  - Add smoke tests for infra availability (DB/Redis/OTP systems)

#### 4. Code Style
- Language & idioms
  - Python 3.10+ typing: use typing (Optional, Annotated) consistently. Prefer explicit return types on functions.
  - Async patterns: use async/await for I/O. Avoid blocking calls inside async endpoints—use threadpools or run background tasks via Celery.
  - Use Pydantic Settings for config and validation. Use model_config / from_attributes to map SQLAlchemy models to Pydantic.
- Pydantic notes
  - Confirm pydantic version: changes in the repo use Annotated+StringConstraints which is pydantic v2 syntax. If your environment uses pydantic v1, revert to Field(..., regex=...) or upgrade pydantic to v2.
- Naming conventions
  - Files: snake_case.py
  - Classes: PascalCase
  - Functions & variables: snake_case
  - Constants: UPPER_SNAKE_CASE
  - DB models: singular PascalCase (User, KYCSession, OTPSession)
- Comments & docs
  - Docstrings for public functions / endpoints: describe purpose, inputs, outputs and side effects.
  - Inline comments to explain why (not what) for non-obvious decisions (security, TTL choices).
- Error & exception handling
  - Validate inputs early (Pydantic)
  - Return precise HTTP errors with FastAPI HTTPException for expected failures.
  - For DB/Redis write operations: use try/except to rollback on failure and avoid silent partial commits.
  - Log exceptions with context (correlation id / request id) and avoid logging secrets or raw OTPs in production logs.

#### 5. Common Patterns
- Configuration
  - Centralized Settings via pydantic BaseSettings (config.py). Use .env for local dev; ensure secrets are read from secure store in prod.
- Rate limiting & TTLs
  - Rate limiter usage (app.core.rate_limit) with config in Settings. Respect TTL constants (REDIS_*_TTL) for OTPs, locks and rate-limit counters.
- OTP handling
  - Recommended single source of truth: OTPs should either be stored & verified in Redis (fast, ephemeral) or in Postgres (audited), but not both without synchronization.
  - Hash OTPs before storing. Include salt/version metadata to allow safe verification and rotation.
- KYC session state machine
  - KYCSession entity holds progressive states (DRAFT, PENDING_INFO, LOCKED_LIVENESS, etc.) and last_step_completed. Always update via transactional DB operations and audit state transitions.
- Celery tasks
  - Keep tasks idempotent. Avoid creating new asyncio event loops inside a task — prefer synchronous helpers or use asyncio.run() when necessary.
  - Use retry/backoff semantics in task decorators for network calls.
  - For async functions invoked by Celery, either make the Celery task asynchronous (if celery supports it in your worker) or run async code via asyncio.run() with careful exception handling and guaranteed loop.close().
- Observability
  - Central logger in core.logging. Add structured logging on key events (OTP send attempts, KYC state changes, OCR start/finish).
  - Add metrics for OTP success/fail, SMS fallback usage, KYC state transitions, and Celery task failures.

#### 6. Do's and Don'ts
- ✅ Do:
  - Keep a single source of truth for ephemeral auth tokens (Redis recommended for OTPs).
  - Use pydantic Settings to manage environment variables and .env.example to document variables.
  - Use mailpit for local SMTP testing (docker-compose provides a mailpit service).
  - Add TTLs for all ephemeral data in Redis and verify TTLs match security policies (OTP_EXPIRE, rate limits).
  - Validate pydantic version compatibility when changing validator patterns (StringConstraints).
  - Add DB commits and rollbacks explicitly; refresh objects after commit where needed.
  - Add tests for OTP flows, including SMS failure → email fallback → failure cases.
  - Avoid embedding raw primary DB IDs in JWT claims; prefer opaque session tokens or HMAC/UUIDs mapped to DB rows.
- ❌ Don’t:
  - Don’t rely on dev-only OTP_MODE ("dev_local") in production; config enforces this but double-check CI/CD.
  - Don’t create event loops inside long-running worker threads without strict lifecycle management.
  - Don’t leave Postgres OTPSession rows orphaned if Redis remains the primary verification source.
  - Don’t log secrets (OTP codes, full tokens, client secrets) in production logs.
  - Don’t change Pydantic v1 -> v2 syntax without updating runtime dependencies and running tests.

#### 7. Tools & Dependencies
- Key libraries
  - FastAPI — web framework (async)
  - SQLAlchemy + asyncpg — DB + async
  - Pydantic (v2 recommended if using Annotated + StringConstraints)
  - Celery — background tasks
  - Redis — ephemeral storage and rate limiting
  - aiosmtplib — async SMTP client
  - mailpit (dev) — local SMTP sink (docker-compose included)
  - pytest, pytest-asyncio, fakeredis — testing
  - Playwright — E2E testing for the PWA
- Recommended dev tools
  - ruff, black, isort for code style
  - pre-commit hooks for formatting & simple lint checks
  - CI: run linters + pytest --cov and fail on critical regressions
- Setup (local dev)
  - Copy .env.example -> .env and set required secrets locally
  - docker-compose up --build to start DB / Redis / mailpit / services
  - Use docker-compose logs -f <service> for debugging
  - Run tests: pytest (use fixtures that set up test DB and fakeredis)

#### 8. Other Notes (important for LLMs and contributors)
- OTP storage & verification:
  - Decide one canonical verification flow. If Redis is primary, keep Postgres OTPSession only for auditing but do not rely on it for verification; record only non-sensitive metadata or store hashed OTP with salt/version and a retention policy + cleanup job.
  - If Postgres is used to verify, ensure verify endpoint uses DB lookup, compares hashes safely (use constant-time compare), and removes/marks sessions upon successful verification.
- JWT claims:
  - Avoid including raw DB identifiers as session_id in JWT; prefer an ephemeral session token or sign/namespace IDs before embedding them. If using session id in token, map and validate it server-side for every request.
- Pydantic compatibility:
  - The repo has moved towards Annotated/StringConstraints (pydantic v2). Confirm the project's pydantic version in pyproject/requirements and run tests under that interpreter.
- Celery & asyncio:
  - Do not construct event loops per task unless fully controlled. Prefer celery tasks that call synchronous wrappers or use asyncio.run() with a try/finally to ensure the loop is closed and exceptions are propagated to Celery (so retries happen).
- Observability & audits:
  - Audit critical actions (OTP created/sent/verified, KYC state changes) but avoid storing OTP plaintext. Provide an audit log table with action type and minimal metadata (user_id, timestamp, channel, success/failure, request_ip).
- Security constraints:
  - Enforce OTP expiry and rate limiting in both Redis and application logic. OTP_RATE_LIMIT and REDIS_TTLs should be aligned with ADRs and configuration constants in config.py.
- CI/CD:
  - Ensure CI installs pinned dependencies and runs the full test suite under the correct Python version.
  - Gate PRs with linters and tests to prevent mismatched library API (e.g., pydantic v1/v2 issues).

---

Adopt these practices as living guidance: update with ADRs, security reviews, and postmortems. Keep tests and CI green; prefer small, well-tested, and well-documented increments for changes touching auth, OTP, and KYC flows.