# Tasks Document: BICEC VeriPass Sovereign Digital KYC Platform

## Overview

This document breaks down the implementation of BICEC VeriPass into actionable tasks organized by sprint and epic. The implementation spans 14 sprints across 8 major epics, with 154 detailed issues from the complete backlog.

### Implementation Strategy

- **Approach**: Incremental delivery with working software at the end of each sprint
- **Sprint Duration**: 2 weeks per sprint (14 sprints = 28 weeks = ~7 months)
- **Team Structure**: 1-2 developers for MVP, expandable to 3-5 for production
- **Testing Strategy**: Dual approach (unit tests + property-based tests) with minimum 80% backend coverage
- **Deployment**: Docker Compose on single i3 node for MVP, Kubernetes migration in Phase 2

### Epic Summary

| Epic | Sprints | Issues | Focus Area |
|------|---------|--------|------------|
| Epic 1: Foundation & Infrastructure | 1-2 | 25 | Docker, DB, Auth, CI/CD |
| Epic 2: Capture Journey | 3-5 | 32 | PWA, Camera, OCR, Liveness |
| Epic 3: Address, NIU, Consent | 6-7 | 18 | Forms, GPS, Utility Bills |
| Epic 4: AI Engine Integration | 8-9 | 24 | PaddleOCR, GLM-OCR, Biometrics |
| Epic 5: Jean's Validation Desk | 10-11 | 22 | Back-Office, Queue, Inspector |
| Epic 6: Thomas's AML/CFT | 12 | 15 | Sanctions, PEP, Conflicts |
| Epic 7: Sylvie's Command Center | 13 | 12 | Analytics, Dashboards, SLA |
| Epic 8: Banking Discovery | 14 | 6 | Plans, Use-Cases, Feature Gates |
| Epic 9: Admin IT — Agent Lifecycle & System Admin | 14-15 | 10 | Agent CRUD, Agency CRUD, Config, Seed |

### Task Status Legend

- 🔴 **Blocked**: Cannot start due to dependencies
- 🟡 **Ready**: Dependencies met, can start
- 🟢 **In Progress**: Currently being worked on
- ✅ **Done**: Completed and tested
- ⚠️ **At Risk**: Behind schedule or technical issues



## Sprint 0: Infrastructure Foundation (Week 0)

**Goal**: Establish development environment, repository structure, and core infrastructure

**Duration**: 1 week (pre-Sprint 1 setup)

**Deliverables**: Working Docker Compose stack, database migrations, AI models validated

### Task 0.1: Repository and Project Structure

**ID**: INFRA-01  
**Priority**: Critical  
**Estimate**: 4 hours  
**Status**: 🟡 Ready  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Initialize monorepo with clear structure for backend, frontend, back-office, infrastructure, and documentation.

**Subtasks**:
- [ ] Create GitHub repository `bicec-veripass` (private)
- [ ] Initialize folder structure: `backend/`, `frontend/`, `backoffice/`, `infra/`, `docs/`, `scripts/`, `data/`
- [ ] Create `.gitignore` for Python, Node, Docker secrets
- [ ] Create `README.md` with architecture overview and quick start
- [ ] Configure branch protection: `main` (production), `develop` (integration), `feature/*` (development)
- [ ] Create `.env.example` with all required environment variables
- [ ] Add `CONTRIBUTING.md` with Conventional Commits conventions

**Acceptance Criteria**:
- `git clone` + `cp .env.example .env` provides clear starting point
- README includes architecture diagram and setup instructions
- Branch protection prevents direct commits to `main`

**Dependencies**: None

**References**:
- Requirements: N/A (infrastructure)
- Design: Architecture section

---

### Task 0.2: Docker Compose Stack

**ID**: INFRA-02  
**Priority**: Critical  
**Estimate**: 6 hours  
**Status**: 🟡 Ready  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Create complete Docker Compose stack with all services (Nginx, FastAPI, PWA, Back-Office, PostgreSQL, Redis, Celery).

**Subtasks**:
- [ ] Write `docker-compose.yml` with 8 services: nginx, fastapi, pwa, backoffice, postgres, redis, celery-worker, celery-beat
- [ ] Configure Nginx reverse proxy with TLS 1.3 (self-signed cert for dev)
- [ ] Create `Dockerfile` for FastAPI (python:3.11-slim, ONNX Runtime, PaddleOCR)
- [ ] Create `Dockerfile` for PWA (node:20-alpine, Vite build)
- [ ] Create `Dockerfile` for Back-Office (node:20-alpine, Vite build)
- [ ] Configure Docker volumes: `/data/documents`, `/data/models`, `/data/db`
- [ ] Create `.wslconfig` template with `memory=8GB`, `processors=4`
- [ ] Create `scripts/docker_prune.sh` (cleanup when disk >85%)
- [ ] Add health checks: postgres `pg_isready`, redis `redis-cli ping`, fastapi `/health`
- [ ] Document ports in README

**Acceptance Criteria**:
- `docker compose up` starts all services with green health checks in <90 seconds
- Nginx serves HTTPS on port 443
- All services accessible via reverse proxy

**Dependencies**: Task 0.1

**References**:
- Requirements: 29 (Docker Compose Infrastructure)
- Design: Architecture - High-Level Architecture



---

### Task 0.3: Database Schema and Migrations

**ID**: INFRA-03  
**Priority**: Critical  
**Estimate**: 5 hours  
**Status**: 🔴 Blocked (needs Task 0.2)  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Create initial Alembic migrations for core database tables.

**Subtasks**:
- [ ] Initialize Alembic in `backend/`
- [ ] Migration `001_initial`: tables `users`, `kyc_sessions`, `documents`
- [ ] Migration `002_auth`: tables `agents`, `roles`
- [ ] Migration `003_audit`: table `audit_logs` (append-only, no DELETE grant)
- [ ] Migration `004_notifications`: table `notifications`
- [ ] Add CHECK constraint on `kyc_sessions.status` (18-state enum)
- [ ] Create indexes: `kyc_sessions.status`, `users.phone_number`, `audit_logs.timestamp`
- [ ] Create `scripts/seed_dev.py`: demo agents (Jean, Thomas, Sylvie, Admin IT) + 2 test sessions
- [ ] Create `scripts/seed_admin_it.sql`: initial Admin IT account for first deployment bootstrap
- [ ] Verify idempotence: `alembic upgrade head` twice produces no errors

**Acceptance Criteria**:
- `alembic upgrade head` completes in <30 seconds
- `\dt` in psql shows all tables
- Seed script creates 3 agents and 2 test sessions

**Dependencies**: Task 0.2 (Docker Compose with PostgreSQL)

**References**:
- Requirements: 30 (Database Schema and Migrations)
- Design: Data Models - Core Entities

---

### Task 0.4: AI Models Download and Validation

**ID**: INFRA-04  
**Priority**: Critical  
**Estimate**: 3 hours  
**Status**: 🟡 Ready  
**Assignee**: TBD  
**Epic**: Epic 4 - AI Engine

**Description**: Download and validate all AI models for on-premise processing.

**Subtasks**:
- [ ] Download PaddleOCR PP-OCRv5 (detection + recognition) to `/data/models/paddleocr/`
- [ ] Download GLM-OCR 0.9B ONNX quantized (int4/int8) to `/data/models/glm-ocr/` - verify SHA256 checksum
- [ ] Download MiniFASNet (anti-spoofing) to `/data/models/minifasnet/`
- [ ] Download FaceNet-512 (DeepFace) to `/data/models/deepface/`
- [ ] Write `scripts/validate_models.py`: test inference on dummy image, measure time
- [ ] Benchmark on i3 node: record actual processing times
- [ ] Document results in `docs/ai-benchmarks.md`

**Acceptance Criteria**:
- `python validate_models.py` validates 4/4 models with measured times
- PaddleOCR inference <5 seconds on test CNI image
- All models load without errors

**Dependencies**: None (can run in parallel with other tasks)

**References**:
- Requirements: 31 (AI Processing Performance)
- Design: Components - OCR Service, Biometrics Service

---

### Task 0.5: CNI Dataset Collection and Synthesis

**ID**: INFRA-05  
**Priority**: Critical  
**Estimate**: 4 hours  
**Status**: 🟡 Ready  
**Assignee**: TBD  
**Epic**: Epic 4 - AI Engine

**Description**: Collect real CNI samples and generate synthetic dataset for OCR training/testing.

**Subtasks**:
- [ ] Meet with BICEC supervisor - obtain formal approval for 15-30 anonymized CNI images
- [ ] Create `data/cni_samples/` with subdirs: `real/`, `synthetic/`, `annotated/`
- [ ] Write `scripts/generate_synthetic_cni.py`: 20 synthetic CNI images (MINREX template + Faker)
- [ ] Write `scripts/annotate_cni.py`: JSON annotations (bounding boxes + expected values)
- [ ] Format: `{"image": "...", "fields": {"nom": "...", "prenom": "...", "date_naissance": "...", "numero_cni": "..."}}`
- [ ] Create `data/glm_ocr_prompts/`: 3 few-shot prompts with annotated CNI examples
- [ ] Write `scripts/eval_ocr.py`: measure FER (Field Extraction Rate) on 20 test images
- [ ] Target: FER ≥80% on 6 CNI Recto fields

**Acceptance Criteria**:
- 20 annotated CNI images (real + synthetic)
- Baseline FER measured and documented
- GLM-OCR prompts validated with sample inference

**Dependencies**: None

**References**:
- Requirements: 4 (OCR Extraction and Review)
- Design: Components - OCR Service



---

### Task 0.6: Orange SMS API Integration

**ID**: INFRA-06  
**Priority**: High  
**Estimate**: 2 hours  
**Status**: 🟡 Ready  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Validate Orange Cameroon SMS API access and implement SMTP fallback.

**Subtasks**:
- [ ] Contact BICEC supervisor for Orange API sandbox credentials
- [ ] If available: test SMS send via `curl` before coding
- [ ] If unavailable: implement `notifications/sms_provider.py` abstract interface + SMTP fallback
- [ ] Document decision in `docs/adr/ADR-011-sms-otp-strategy.md`

**Acceptance Criteria**:
- SMS API credentials obtained OR fallback strategy documented
- Test SMS sent successfully OR SMTP fallback configured

**Dependencies**: None

**References**:
- Requirements: 1 (Client Authentication and Registration), 27 (Notification Strategy)
- Design: External Integrations - Orange Cameroon SMS API

---

### Task 0.7: GitHub Configuration

**ID**: INFRA-07  
**Priority**: High  
**Estimate**: 2 hours  
**Status**: 🔴 Blocked (needs Task 0.1)  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Configure GitHub repository with labels, milestones, and project board.

**Subtasks**:
- [ ] Create 50+ labels (colors defined in roadmap)
- [ ] Create 8 milestones (M0-M7 with target dates)
- [ ] Configure branch protection on `main`: require PR review, require CI passing, no force push
- [ ] Configure branch protection on `develop`: require CI passing
- [ ] Create GitHub Project board "VeriPass Sprint Board" with columns: Backlog / In Progress / Review / Done
- [ ] Enable GitHub Issues with templates (bug report, feature request, user story)

**Acceptance Criteria**:
- All labels and milestones created
- Branch protection prevents direct commits
- Project board ready for sprint planning

**Dependencies**: Task 0.1 (Repository created)

**References**: N/A (project management)

---

## Sprint 1: Authentication & Core Backend (Weeks 1-2)

**Goal**: Implement authentication for Marie (OTP/PIN) and back-office users (email/password), establish FastAPI modular structure

**Duration**: 2 weeks

**Deliverables**: Working authentication flows, JWT service, RBAC, health endpoint

### Task 1.1: FastAPI Modular Structure

**ID**: AUTH-01  
**Priority**: Critical  
**Estimate**: 4 hours  
**Status**: 🔴 Blocked (needs Task 0.2, 0.3)  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Create FastAPI application with modular structure and health endpoint.

**Subtasks**:
- [ ] Create structure `backend/app/`: `main.py`, `core/`, `api/v1/`, `models/`, `schemas/`, `services/`, `workers/`
- [ ] Configure FastAPI with `APIRouter` per module: auth, kyc, backoffice, aml, analytics, admin, notifications
- [ ] Implement `GET /health` → `{"status": "ok", "db": "ok", "redis": "ok", "version": "0.1.0"}`
- [ ] Configure JSON structured logging (python-json-logger) with `correlation_id`
- [ ] Configure CORS (origins: localhost:3000, localhost:3001)
- [ ] Implement middleware `correlation_id` (UUID injected on each request)
- [ ] Generate OpenAPI docs on `/docs` (Swagger UI)
- [ ] Write 3 pytest tests: health OK, health DB down, health Redis down

**Acceptance Criteria**:
- `GET /health` returns 200 with service status
- OpenAPI docs accessible at `/docs`
- All tests pass

**Dependencies**: Task 0.2 (Docker Compose), Task 0.3 (Database)

**References**:
- Requirements: 37 (Logging and Observability)
- Design: Components - FastAPI Modular Monolith

---

### Task 1.2: JWT Service Implementation

**ID**: AUTH-02  
**Priority**: Critical  
**Estimate**: 3 hours  
**Status**: 🔴 Blocked (needs Task 1.1)  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Implement JWT token generation and verification with refresh tokens.

**Subtasks**:
- [ ] Implement `services/auth/jwt_service.py`: `create_access_token(sub, role, expires=24h)`, `create_refresh_token(sub, expires=7d)`
- [ ] Implement `verify_token(token)` → payload or HTTPException 401
- [ ] Store refresh tokens in Redis (TTL=7d) with pattern `refresh:{user_id}:{jti}`
- [ ] Implement `POST /auth/refresh` → new access token if refresh valid
- [ ] Implement `POST /auth/logout` → invalidate refresh token in Redis
- [ ] Write tests: token valid, expired, falsified, refresh valid, refresh revoked

**Acceptance Criteria**:
- JWT tokens generated with HS256 algorithm
- Refresh token flow works correctly
- All security tests pass

**Dependencies**: Task 1.1 (FastAPI structure)

**References**:
- Requirements: 1.6 (JWT Issuance), 33.9 (JWT tokens)
- Design: Components - Authentication Flow
- Property: 4 (JWT Issuance on Successful Authentication)



---

### Task 1.3: OTP Authentication for Marie

**ID**: AUTH-03  
**Priority**: Critical  
**Estimate**: 6 hours  
**Status**: 🔴 Blocked (needs Task 1.2)  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Implement OTP-based authentication for client users (Marie) with SMS delivery and PIN setup.

**Subtasks**:
- [ ] Backend `POST /auth/otp/send`: validate phone format (+237XXXXXXXXX), generate 6-digit OTP, store in Redis `otp:{phone}` TTL=5min (bcrypt hash), call SMS provider
- [ ] Backend `POST /auth/otp/verify`: compare hash, create `users` record if new, create `kyc_session` status=DRAFT, return JWT
- [ ] Implement rate limiting: 3 attempts max per 5 minutes per IP + per phone (Redis counter)
- [ ] Implement anti-replay: delete OTP from Redis immediately after successful use
- [ ] Backend `POST /auth/pin/setup`: store PIN hashed with Argon2 in `users.pin_hash`
- [ ] Backend `POST /auth/pin/verify`: verify PIN, return JWT
- [ ] PWA React: screen "Phone Number" + screen "OTP 6 digits" + screen "Create PIN 4 digits"
- [ ] PWA: handle errors (invalid code, expired, account locked)
- [ ] Audit log events: `AUTH_OTP_SENT`, `AUTH_OTP_VERIFIED`, `AUTH_OTP_FAILED`, `AUTH_PIN_SET`
- [ ] E2E test (Playwright): complete OTP → PIN setup flow

**Acceptance Criteria**:
- OTP sent via SMS (or SMTP fallback)
- OTP expires after 5 minutes
- Rate limiting blocks after 3 failed attempts
- PIN stored securely (never plaintext)
- E2E test passes

**Dependencies**: Task 1.2 (JWT Service), Task 0.6 (SMS API)

**References**:
- Requirements: 1 (Client Authentication and Registration)
- Design: Components - Authentication Flow
- Properties: 1 (OTP Anti-Replay), 2 (OTP TTL), 3 (Rate Limiting), 5 (PIN Storage)

---

### Task 1.4: Back-Office Authentication

**ID**: AUTH-04  
**Priority**: Critical  
**Estimate**: 4 hours  
**Status**: 🔴 Blocked (needs Task 1.2)  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Implement email/password authentication for back-office users (Jean, Thomas, Sylvie, Admin IT).

**Subtasks**:
- [ ] Backend `POST /auth/bo/login`: Email + Password → bcrypt verify → JWT with `role` claim
- [ ] RBAC middleware: decorator `@require_role(["AGENT", "SUPERVISOR", "MANAGER", "ADMIN_IT"])` on endpoints (strict per-role isolation)
- [ ] Lockout: 5 failed attempts → `agents.locked_until = now() + 15min`
- [ ] Back-Office React: login page email/password, redirect by role (Jean→Validation, Thomas→AML, Sylvie→Command Center, Admin IT→`/admin`), handle token expiry
- [ ] Seed data: Jean (AGENT), Thomas (SUPERVISOR/AML), Sylvie (MANAGER), Admin IT (ADMIN_IT) with hashed passwords
- [ ] Tests: login valid, wrong password, account locked, access denied by role (including Admin IT isolation)

**Acceptance Criteria**:
- All 4 back-office roles can log in with email/password
- Account locks after 5 failed attempts
- Role-based access control enforced — each role isolated to its own endpoints
- Admin IT redirected to `/admin`, cannot access Jean/Thomas/Sylvie endpoints
- All tests pass

**Dependencies**: Task 1.2 (JWT Service)

**References**:
- Requirements: 28 (Back-Office Authentication and RBAC)
- Design: Components - Back-Office Authentication & RBAC

---

### Task 1.5: RBAC Permission Matrix

**ID**: AUTH-05  
**Priority**: High  
**Estimate**: 3 hours  
**Status**: 🔴 Blocked (needs Task 1.4)  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Define complete RBAC permission matrix and implement enforcement.

**Subtasks**:
- [ ] Define permission matrix in `core/permissions.py`
- [ ] Roles: `CLIENT`, `AGENT_KYC`, `SUPERVISOR_AML`, `OPERATIONS_MANAGER`, `ADMIN`
- [ ] Document permissions per endpoint in `docs/rbac-matrix.md`
- [ ] Write tests: each role cannot access other roles' endpoints

**Acceptance Criteria**:
- Permission matrix documented
- RBAC enforced on all endpoints
- Tests verify role isolation

**Dependencies**: Task 1.4 (Back-Office Auth)

**References**:
- Requirements: 28.11, 28.12 (RBAC enforcement)
- Design: Components - Back-Office Authentication & RBAC

---

### Task 1.6: Property-Based Tests for Authentication

**ID**: AUTH-06  
**Priority**: High  
**Estimate**: 4 hours  
**Status**: 🔴 Blocked (needs Task 1.3, 1.4)  
**Assignee**: TBD  
**Epic**: Epic 1 - Foundation

**Description**: Implement property-based tests for authentication properties using Hypothesis.

**Subtasks**:
- [ ] Property 1: OTP Anti-Replay Protection (100 iterations)
- [ ] Property 2: OTP TTL Enforcement (100 iterations)
- [ ] Property 3: Rate Limiting After Failed OTP Attempts (100 iterations)
- [ ] Property 4: JWT Issuance on Successful Authentication (100 iterations)
- [ ] Property 5: PIN Storage Security (100 iterations)
- [ ] Tag all tests: `Feature: bicec-veripass-complete-implementation, Property {N}: {description}`
- [ ] Configure Hypothesis profile for CI: `--hypothesis-profile=ci`

**Acceptance Criteria**:
- All 5 authentication properties pass with 100 iterations
- Tests tagged correctly for traceability
- CI pipeline runs property tests

**Dependencies**: Task 1.3 (OTP Auth), Task 1.4 (Back-Office Auth)

**References**:
- Design: Testing Strategy - Property-Based Testing
- Properties: 1-5 (Authentication and Session Management)



---

## Sprint 2: PWA Foundation & Session Management (Weeks 3-4)

**Goal**: Build PWA shell with offline support, session management, and camera access

**Duration**: 2 weeks

**Deliverables**: PWA with Service Worker, IndexedDB session storage, camera interface

### Task 2.1: PWA Project Setup

**ID**: PWA-01  
**Priority**: Critical  
**Estimate**: 3 hours  
**Status**: 🔴 Blocked (needs Task 0.2)  
**Assignee**: TBD  
**Epic**: Epic 2 - Capture Journey

**Description**: Initialize React PWA project with Vite, TypeScript, and PWA manifest.

**Subtasks**:
- [ ] Create `frontend/` with Vite + React + TypeScript
- [ ] Install dependencies: React Router, Axios, Zustand (state), TanStack Query
- [ ] Configure PWA manifest: name, icons, theme color, display mode
- [ ] Configure Service Worker with Workbox
- [ ] Create app shell: navigation, layout, loading states
- [ ] Configure Axios interceptors: JWT bearer token, correlation ID
- [ ] Create `src/api/` client with typed endpoints
- [ ] Configure environment variables: `VITE_API_URL`

**Acceptance Criteria**:
- PWA installable on mobile devices
- Service Worker caches app shell
- API client configured with auth headers

**Dependencies**: Task 0.2 (Docker Compose)

**References**:
- Requirements: 32 (PWA Performance and Size Constraints)
- Design: Components - PWA (Marie's Client Interface)

---

### Task 2.2: IndexedDB Session Storage

**ID**: PWA-02  
**Priority**: Critical  
**Estimate**: 4 hours  
**Status**: 🔴 Blocked (needs Task 2.1)  
**Assignee**: TBD  
**Epic**: Epic 2 - Capture Journey

**Description**: Implement encrypted session storage in IndexedDB for offline resilience.

**Subtasks**:
- [ ] Create `src/services/storage.ts`: IndexedDB wrapper with Dexie.js
- [ ] Implement `encryptSessionState(data)` using Web Crypto API (AES-GCM)
- [ ] Implement `decryptSessionState(encrypted)` 
- [ ] Store session data: `{sessionId, step, documents, ocrFields, timestamp}`
- [ ] Implement `saveSession(session)`, `loadSession(sessionId)`, `clearSession(sessionId)`
- [ ] Implement automatic sync when network restored
- [ ] Write property-based test: encrypt → decrypt round-trip (100 iterations)

**Acceptance Criteria**:
- Session state persists across app restarts
- Data encrypted before storage
- Round-trip property test passes

**Dependencies**: Task 2.1 (PWA Setup)

**References**:
- Requirements: 5 (Session Resumption and Offline Resilience), 33.8 (IndexedDB encryption)
- Design: Components - PWA Document Capture Module
- Property: 6 (Session Resumption Performance)

---

### Task 2.3: Camera Access and MediaPipe Integration

**ID**: PWA-03  
**Priority**: Critical  
**Estimate**: 6 hours  
**Status**: 🔴 Blocked (needs Task 2.1)  
**Assignee**: TBD  
**Epic**: Epic 2 - Capture Journey

**Description**: Implement camera interface with MediaPipe WASM for real-time quality gates.

**Subtasks**:
- [ ] Install MediaPipe WASM: `@mediapipe/tasks-vision`
- [ ] Create `src/components/CameraCapture.tsx`: camera interface with getUserMedia
- [ ] Implement real-time frame processing at 15 FPS
- [ ] Implement blur detection (Laplacian variance)
- [ ] Implement glare detection (histogram analysis)
- [ ] Implement alignment detection (edge detection + perspective transform)
- [ ] Display visual guidance overlays (green = good, yellow = adjust, red = poor)
- [ ] Implement auto-capture when all quality gates pass
- [ ] Handle camera permissions and errors
- [ ] Test on Android 8.0 device: verify 15 FPS minimum

**Acceptance Criteria**:
- Camera activates with getUserMedia
- Quality gates provide real-time feedback
- Auto-capture triggers when quality thresholds met
- Performance: 15 FPS on Android 8.0

**Dependencies**: Task 2.1 (PWA Setup)

**References**:
- Requirements: 2 (CNI Document Capture with Quality Gates)
- Design: Components - PWA Document Capture Module
- Property: 12 (Auto-Capture Trigger), 67 (MediaPipe Frame Processing Rate)

---

### Task 2.4: Session State Machine

**ID**: PWA-04  
**Priority**: High  
**Estimate**: 4 hours  
**Status**: 🔴 Blocked (needs Task 2.2)  
**Assignee**: TBD  
**Epic**: Epic 2 - Capture Journey

**Description**: Implement client-side state machine for KYC session workflow.

**Subtasks**:
- [ ] Create `src/state/sessionMachine.ts` using XState
- [ ] Define states: DRAFT, CNI_RECTO, CNI_VERSO, LIVENESS, ADDRESS, NIU, CONSENT, SUBMITTED
- [ ] Define transitions with guards (e.g., cannot go to LIVENESS without both CNI sides)
- [ ] Implement state persistence in IndexedDB
- [ ] Implement state restoration on app load
- [ ] Create `useSessionState()` hook for components
- [ ] Write tests for all state transitions

**Acceptance Criteria**:
- State machine enforces correct workflow order
- State persists across app restarts
- All transition tests pass

**Dependencies**: Task 2.2 (IndexedDB Storage)

**References**:
- Requirements: 39 (Session State Machine and Lifecycle)
- Design: Data Models - State Machine

---

### Task 2.5: Offline Queue and Sync

**ID**: PWA-05  
**Priority**: High  
**Estimate**: 3 hours  
**Status**: 🔴 Blocked (needs Task 2.2)  
**Assignee**: TBD  
**Epic**: Epic 2 - Capture Journey

**Description**: Implement offline operation queue with automatic sync on network restoration.

**Subtasks**:
- [ ] Create `src/services/syncQueue.ts`: queue for pending operations
- [ ] Implement `queueOperation(type, payload)`: store in IndexedDB
- [ ] Implement network status detection: `navigator.onLine` + ping endpoint
- [ ] Implement automatic sync on network restoration
- [ ] Implement retry with exponential backoff (3 attempts)
- [ ] Display sync status to user: "Synchronisation en cours..."
- [ ] Write tests: offline → online transition triggers sync

**Acceptance Criteria**:
- Operations queued when offline
- Automatic sync on network restoration within 2 seconds
- User sees sync status

**Dependencies**: Task 2.2 (IndexedDB Storage)

**References**:
- Requirements: 5 (Session Resumption and Offline Resilience)
- Property: 6 (Session Resumption Performance)



---

## Sprint 3-5: Document Capture & OCR (Weeks 5-10)

**Goal**: Complete document capture flow (CNI, liveness, utility bill) with OCR extraction

**Key Tasks**:
- CNI Recto/Verso capture with quality validation
- Liveness verification with strike lockout mechanism
- OCR extraction (PaddleOCR + GLM-OCR fallback)
- OCR review screen with confidence badges
- Document upload with SHA-256 verification
- Property tests for OCR and biometric processing

**Total Issues**: 32 tasks from backlog

**Critical Path**: OCR Service → Biometric Service → Confidence Score Calculation

---

## Sprint 6-7: Address, NIU, and Consent (Weeks 11-14)

**Goal**: Complete address entry, NIU declaration, and digital consent

**Key Tasks**:
- Progressive address dropdowns (Ville → Commune → Quartier → Lieu-dit)
- GPS capture with privacy notice
- Utility bill upload and GLM-OCR extraction
- Agency routing based on utility zone
- NIU attestation upload vs manual declaration
- Limited access gating for declarative NIU
- Digital consent with 3 checkboxes
- Dossier submission and status transition to PENDING_KYC

**Total Issues**: 18 tasks from backlog

**Critical Path**: Address Data → Utility Bill OCR → Agency Assignment → Consent → Submission

---

## Sprint 8-9: AI Engine Integration (Weeks 15-18)

**Goal**: Integrate all AI services with performance optimization

**Key Tasks**:
- PaddleOCR service with <5s target
- GLM-OCR fallback service with <30s target
- DeepFace face matching service
- MiniFASNet liveness detection
- Global confidence score calculation (weighted: OCR 40%, liveness 30%, face match 20%, coherence 10%)
- Duplicate detection with pg_trgm fuzzy matching
- Biometric template encryption (AES-256)
- Performance benchmarking and optimization
- Property tests for all AI services

**Total Issues**: 24 tasks from backlog

**Critical Path**: Model Optimization → Service Integration → Performance Validation

---

## Sprint 10-11: Jean's Validation Desk (Weeks 19-22)

**Goal**: Build back-office validation interface for KYC agents

**Key Tasks**:
- Agent queue with priority sorting (SLA → confidence → FIFO)
- Evidence Inspector with side-by-side viewer
- Pan/zoom on high-resolution images
- Face matching panel (selfie vs CNI photo)
- OCR field review with confidence highlighting
- Decision actions: Approve, Reject, Request Info
- Load balancing (Smooth WRR + Least Connections)
- Agent availability management
- Audit logging for all agent actions
- E2E tests for validation workflow

**Total Issues**: 22 tasks from backlog

**Critical Path**: Queue System → Evidence Inspector → Decision Actions → Audit Trail

---

## Sprint 12: Thomas's AML/CFT Supervision (Weeks 23-24)

**Goal**: Implement AML screening and compliance workflows

**Key Tasks**:
- PEP/Sanctions list sync (weekly batch from OpenSanctions, UN, EU, OFAC)
- Fuzzy matching with pg_trgm (threshold 75%)
- AML alerts queue for Thomas
- Side-by-side profile comparison
- False positive clearance with mandatory justification
- Identity conflict resolver for duplicates
- Sanctions match confirmation with account freeze
- Agency CRUD management
- Amplitude provisioning batch monitor
- Audit logging for all AML actions

**Total Issues**: 15 tasks from backlog

**Critical Path**: Sanctions Sync → Fuzzy Matching → Alert Review → Conflict Resolution

---

## Sprint 13: Sylvie's Command Center (Weeks 25-26)

**Goal**: Build operational dashboards and analytics

**Key Tasks**:
- Operational health dashboard (R/Y/G tiles)
- Funnel analytics with drop-off visualization
- Agent performance metrics
- SLA violation alerts with escalation
- Star schema data warehouse (fact + dimension tables)
- Real-time metrics API endpoints
- COBAC compliance pack export (ZIP with PDF + images + JSON)
- Audit log integrity verification
- CSV/JSON export functionality
- Dashboard performance optimization (<3s for 90-day queries)

**Total Issues**: 12 tasks from backlog

**Critical Path**: Data Warehouse → Metrics Calculation → Dashboard UI → Export Functions

---

## Sprint 14: Banking Discovery & Polish (Weeks 27-28)

**Goal**: Add banking plan preview and final polish

**Key Tasks**:
- Banking plans comparison (Standard, Premium, Ultra)
- Use-case personalization chips
- Access level-based feature gating
- Notification polling (15s foreground, 60s background)
- SMS fallback for failed in-app notifications
- Accessibility audit (WCAG 2.1 Level AA)
- Performance optimization (Lighthouse scores)
- Security audit and penetration testing
- Load testing (5 concurrent sessions)
- Production deployment preparation

**Total Issues**: 6 tasks from backlog

**Critical Path**: Feature Gates → Notifications → Accessibility → Performance → Security



---

## Testing Tasks (Continuous Throughout Sprints)

### Unit Testing

**Coverage Target**: 80% backend, 70% frontend

**Key Test Suites**:
- Authentication: OTP, PIN, JWT, RBAC (Sprint 1)
- OCR Service: PaddleOCR, GLM-OCR, field extraction (Sprint 3-5)
- Biometrics: Face matching, liveness detection (Sprint 8-9)
- State Machine: All 18 states and transitions (Sprint 2-7)
- Audit Service: SHA-256 hashing, append-only (Sprint 10-13)
- Analytics: Funnel calculations, SLA metrics (Sprint 13)

**Tools**: pytest (backend), Vitest + React Testing Library (frontend)

---

### Property-Based Testing

**Coverage Target**: 74 properties from design document

**Key Property Suites**:
- Authentication (Properties 1-6): OTP, JWT, PIN, Session (Sprint 1)
- Document Processing (Properties 7-12): Encryption, hashing, quality gates (Sprint 3-5)
- OCR & AI (Properties 13-24): Confidence scores, biometrics (Sprint 8-9)
- State Machine (Properties 25-33): Transitions, access levels (Sprint 2-7)
- Audit (Properties 34-39): Immutability, integrity, compliance (Sprint 10-13)
- Performance (Properties 40-43, 65-69): Response times, resource limits (Sprint 13-14)
- Security (Properties 44-47): Encryption, TLS, key rotation (Sprint 1, 8-9)
- Data Sovereignty (Properties 48-49): No external calls, local storage (Sprint 8-9)
- Rate Limiting (Properties 50-53): OTP, login, API, IP blocking (Sprint 1)
- Parser (Properties 54-55): ISO 20022 round-trip, XSD validation (Sprint 12)

**Tools**: Hypothesis (Python), fast-check (TypeScript)

**Configuration**: Minimum 100 iterations per property test

---

### Integration Testing

**Coverage Target**: All API endpoints

**Key Integration Suites**:
- Complete KYC submission flow (Sprint 5)
- Agent validation workflow (Sprint 11)
- AML screening and conflict resolution (Sprint 12)
- Analytics queries and exports (Sprint 13)
- Amplitude provisioning (Sprint 12)

**Tools**: pytest with FastAPI TestClient, pytest-postgresql, fakeredis

---

### End-to-End Testing

**Coverage Target**: Critical user journeys

**Key E2E Suites**:
- Marie's complete onboarding (Sprint 5)
- Jean's dossier validation (Sprint 11)
- Thomas's AML alert resolution (Sprint 12)
- Sylvie's dashboard interactions (Sprint 13)

**Tools**: Playwright for browser automation

**Environment**: Docker Compose test stack

---

### Load Testing

**Coverage Target**: Performance under concurrent load

**Key Load Tests**:
- 5 concurrent onboarding sessions (Sprint 9)
- Agent queue with 100+ dossiers (Sprint 11)
- Analytics dashboard with 1000+ records (Sprint 13)

**Tools**: Locust, pytest-benchmark

**Targets**:
- OCR: <5s per document
- Biometrics: <10s combined
- Total AI: <15s
- Dashboard queries: <3s for 90 days
- Health endpoint: <500ms

---

## Deployment and DevOps Tasks

### CI/CD Pipeline

**Tasks**:
- GitHub Actions workflow for automated testing
- Docker image builds and registry push
- Alembic migration automation
- Environment-specific configurations (dev, staging, prod)
- Rollback procedures

**Tools**: GitHub Actions, Docker Registry, Alembic

---

### Monitoring and Observability

**Tasks**:
- Structured JSON logging configuration
- Log aggregation and retention (30 days)
- Health check endpoints
- Performance metrics collection
- Error tracking and alerting

**Tools**: Python json-logger, PostgreSQL logs, Redis monitoring

---

### Security Hardening

**Tasks**:
- TLS 1.3 certificate management
- Secret rotation procedures (JWT keys every 90 days)
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting configuration
- IP blocking automation
- Penetration testing

**Tools**: OpenSSL, Nginx security modules, Redis rate limiting

---

### Backup and Disaster Recovery

**Tasks**:
- PostgreSQL backup automation (daily, weekly, monthly)
- Document volume backup procedures
- Backup retention policies (7 days, 4 weeks, 12 months)
- Restore testing procedures
- Disaster recovery runbook

**Tools**: pg_dump, tar, cron

---

## Risk Management

### High-Risk Items

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| GLM-OCR ONNX compatibility issues | 2 days lost | Validate in Sprint 0, fallback to PaddleOCR only | AI Engineer |
| Orange SMS API unavailable | Blocks OTP flow | SMTP fallback implemented in Sprint 0 | Backend Dev |
| i3 node insufficient for 5 concurrent sessions | Performance degradation | Benchmark in Sprint 0, optimize in Sprint 9 | DevOps |
| CNI dataset insufficient for OCR training | Low accuracy | Synthetic generation + BICEC samples in Sprint 0 | AI Engineer |
| Amplitude API integration delays | Blocks provisioning | Mock responses for testing, parallel track | Integration Lead |

### Technical Debt

**Planned Debt**:
- Modular monolith (acceptable for MVP, extract to microservices in Phase 2)
- Polling notifications (acceptable for MVP, push notifications in Phase 2)
- Single i3 node (acceptable for pilot, Kubernetes in Phase 2)
- Weekly sanctions sync (acceptable for MVP, daily sync in Phase 2)

**Debt Tracking**: Document in `docs/technical-debt.md` with priority and remediation plan

---

## Definition of Done

### Task Level

- [ ] Code written and reviewed
- [ ] Unit tests written and passing (≥80% backend, ≥70% frontend)
- [ ] Property tests written and passing (100 iterations minimum)
- [ ] Integration tests written and passing
- [ ] Documentation updated (API docs, README, ADRs)
- [ ] No critical security vulnerabilities
- [ ] Performance targets met
- [ ] Accessibility requirements met (WCAG 2.1 Level AA)

### Sprint Level

- [ ] All sprint tasks completed
- [ ] E2E tests passing for sprint deliverables
- [ ] Sprint demo completed
- [ ] Sprint retrospective completed
- [ ] Backlog groomed for next sprint
- [ ] Technical debt documented

### Epic Level

- [ ] All epic tasks completed
- [ ] Epic acceptance criteria met
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] User acceptance testing completed
- [ ] Production deployment plan reviewed

---

## Dependencies and Blockers

### External Dependencies

- Orange Cameroon SMS API credentials (Sprint 0)
- BICEC CNI sample images (Sprint 0)
- Sopra Amplitude API access (Sprint 12)
- BICEC supervisor approvals (ongoing)

### Technical Dependencies

- Docker Desktop + WSL2 (Sprint 0)
- PostgreSQL 16 (Sprint 0)
- Redis 7 (Sprint 0)
- Node.js 20 (Sprint 1)
- Python 3.11 (Sprint 1)

### Team Dependencies

- AI Engineer for model optimization (Sprint 8-9)
- UX Designer for accessibility audit (Sprint 14)
- Security Engineer for penetration testing (Sprint 14)
- BICEC stakeholders for UAT (Sprint 14)

---

## Success Metrics

### Technical Metrics

- Code coverage: ≥80% backend, ≥70% frontend
- Property test coverage: 74/74 properties passing
- Performance: All targets met (OCR <5s, biometrics <10s, etc.)
- Accessibility: WCAG 2.1 Level AA compliance
- Security: Zero critical vulnerabilities
- Uptime: 99% during pilot

### Business Metrics

- KYC processing time: 14 days → 24-48 hours
- Client satisfaction: ≥4.5/5 stars
- Agent efficiency: 10+ dossiers validated per day
- Fraud detection: ≥95% accuracy
- Compliance: 100% audit trail coverage

### User Metrics

- Marie: Complete onboarding in <15 minutes
- Jean: Validate dossier in <10 minutes
- Thomas: Resolve AML alert in <5 minutes
- Sylvie: Generate compliance report in <30 seconds

---

## Next Steps

1. **Sprint 0 Kickoff**: Complete infrastructure setup (Week 0)
2. **Sprint Planning**: Groom backlog and assign tasks (Week 1)
3. **Daily Standups**: 15-minute sync every morning
4. **Sprint Reviews**: Demo working software every 2 weeks
5. **Sprint Retrospectives**: Continuous improvement
6. **Stakeholder Updates**: Weekly progress reports to BICEC

---

## References

### Requirements Document
- [requirements.md](.kiro/specs/bicec-veripass-complete-implementation/requirements.md)
- 44 detailed requirements with acceptance criteria
- Covers all 8 epics and 4 personas

### Design Document
- [design.md](.kiro/specs/bicec-veripass-complete-implementation/design.md)
- Complete architecture and data models
- 74 correctness properties
- Testing strategy and error handling

### Complete Backlog
- [bicec-veripass-complete-backlog.md](_bmad-output/planning-artifacts/bicec-veripass-complete-backlog.md)
- 154 detailed issues across 14 sprints
- Subtasks and acceptance criteria for each issue

### Architecture Documentation
- [architecture-bicec-veripass.md](_bmad-output/planning-artifacts/archive/architecture-bicec-veripass.md)
- C4 diagrams, ERD, state machines
- Sequence diagrams and API contracts

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-07  
**Status**: Ready for Sprint Planning  
**Next Milestone**: Sprint 0 Complete (Week 0)

