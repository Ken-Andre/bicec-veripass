---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture-bicec-veripass.md"
  - "_bmad-output/planning-artifacts/ux-design-specification-v2.md"
---

# bicec-veripass - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **bicec-veripass**, decomposing the requirements from the PRD, UX Design Spec v2, and Architecture document into implementable stories.

The system is a sovereign digital KYC onboarding platform for BICEC (Cameroon), with these primary actors:
- **Marie** — the client performing KYC onboarding via PWA
- **Jean** — the KYC validation agent reviewing dossiers in the back-office
- **Thomas** — the AML/Compliance supervisor
- **Sylvie** — the operations manager overseeing the Command Center
- **Admin IT** — the system administrator managing agent lifecycle, branch assignments, and system configuration

**Stack:** PWA React/TypeScript + FastAPI (Python) + PostgreSQL + Redis + Celery + Docker Compose — 100% on-premise, open-source.

---

## Requirements Inventory

### Functional Requirements

FR1: Users register/authenticate via OTP (SMS or Email), then set up a local PIN/Biometrics for recurring access.
FR2: The system enforces Recto AND Verso capture for CNI (mandatory). Supports Passport (alternative) and NIU Attestation.
FR3: The app guides capture (auto-crop, blur detection, glare check) and rejects poor-quality images client-side before upload.
FR4: Users perform a real-time "Liveness" video selfie with adaptive visual guidance (smile, turn left, etc.).
FR5: Users see OCR extraction results (fields + confidence) for immediate confirmation.
FR6: Progressive Sync allows resuming interrupted sessions without data loss (encrypted local cache via IndexedDB + Service Worker).
FR7: After 3 failed liveness/biometric checks, the app locks the session with a graceful message and a "Recommencer" option that purges session cache.
FR8: Users can explicitly select a "Physical Branch" option if they prefer manual onboarding or want to start over.
FR9: Address input uses progressive dropdowns: Ville → Commune → Quartier → Lieu-dit.
FR10: Users can optionally use a "Utiliser ma position actuelle" button to auto-populate GPS coordinates.
FR11: When GPS is used, the system displays a privacy notice. If GPS distance > X km from selected Quartier, show a warning (don't block).
FR12: Users choose Either ENEO Or CAMWATER (toggle) to upload as proof of address.
FR13: System extracts bill date and agency name using GLM-OCR. Uses utility agency zone to assign dossier to the nearest BICEC agency.
FR14: Users can upload the NIU Attestation OR manually declare the NIU number.
FR15: For manual NIU, the system validates format (Regex) and flags the dossier as "NIU Declarative."
FR16: "Declarative NIU" triggers a LIMITED_ACCESS account status. Durable state until Jean's manual validation transition to FULL_ACCESS.
FR17: Users must explicitly check 3 distinct checkboxes to accept: (1) CGU, (2) Privacy Policy, and (3) Data Processing Consent.
FR18: Users authorize the contract submission digitally on the touchscreen (timestamped & stored).
FR19: Wet signature (3x on paper) is performed ONLY during in-branch physical activation (out of mobile scope).
FR20: Local OCR extracts structured fields from CNI (Recto/Verso) and utility bills.
FR21: The system computes a single dossier-level confidence score (OCR + liveness + face match + coherence) for prioritization.
FR22: Face matching performs 1:1 matching (Selfie vs. CNI Photo) and outputs a score.
FR23: Liveness/anti-spoofing outputs a score and flags suspicious captures.
FR24: The system assigns confidence per OCR field and raises flags for human review.
FR25: The system checks for potential duplicates in the local database and raises a "possible duplicate" flag.
FR26: Agents view a prioritized queue based on FIFO, priority flags, and global confidence scores.
FR26b: The system distributes dossiers intelligently to agents based on capacity (2-10 dossiers/agent), availability, and current load (Smooth WRR + Least Connections).
FR27: Agents compare High-Res Originals (Recto, Verso, Bill) side-by-side with extracted data.
FR29: Agents can Approve, Reject (with reason), or Request Info (Push Notification sent to user).
FR31: Thomas reviews active alerts against PEP and Sanction lists, with side-by-side profile matching. Actions require logged justifications.
FR32: Thomas handles identity collisions by linking new dossiers to existing client records or rejecting them as fraud.
FR33: Thomas manages Agency CRUD operations and monitors automated Amplitude batch provisioning statuses.
FR34: Managers view Red/Yellow/Green health status of queues and services.
FR35: Analytics on drop-off rates across the Marie journey.
FR36: Immutable SHA-256 log of every action, including who viewed what and when.
FR37: Strict Role-Based Access Control for all internal personas.
FR38: One-click export of a full compliance dossier (PDF + JSON + Images) for COBAC audits.
FR39: Plan Personalization — Premium/Standard/Ultra tier presentation with feature comparisons (frontend-only demo).
FR40: Use-Case Personalization — Selection interface for Everyday needs / Global spending / Investments (frontend-only).
FR41: Account Management Dashboard — Home screen UI with Main account, Pockets, Savings, Linked Accounts (frontend-only).
FR42: Account Detail View — account header, action buttons (Add money, Withdraw), goal tracking, recurring transfers (frontend-only).
FR43: Recurring Transfers UI — schedule modal with date picker and frequency selector (frontend-only).
FR44: Cards Management — Online shopping card, virtual card, ATM finder (frontend-only).
FR45: Gating Logic & Account Status — PENDING/RESTRICTED, LIMITED_ACCESS, FULL_ACCESS, DISABLED states drive UI unlock behavior.
FR46: Notification Strategy — SMS for OTP only; all status updates use polling-based in-app notifications + Orange SMS fallback.
FR47: Purpose of Frontend Demos — educate users, reduce abandonment, test UI/UX for future backend integration.

### NonFunctional Requirements

NFR1: Total AI processing must be <15 seconds (OCR <5s, Liveness <10s) on the 12GB i3 benchmark node.
NFR2: Capture guidance must operate at >15 FPS on mid-range Android 8.0 devices.
NFR3: Total app size must be <40MB (Target: <20MB for initial download). Cold start time must be <4 seconds.
NFR4: Back-office access uses Email/Password (no AD for MVP). Passwords hashed using bcrypt/Argon2.
NFR5: 100% of biometric templates and CNI images must be encrypted using AES-256 inside Docker volumes.
NFR6: The system must operate with no external service calls for core AI functions (100% data sovereignty).
NFR7: All communication between the PWA and FastAPI must use TLS 1.3.
NFR8: App must resume an "In-Progress" session within <2 seconds of signal return using local encrypted cache.
NFR9: System must trigger a Docker Prune if disk usage exceeds 85% of the 200GB partition. Daily local DB backup before cleanup.
NFR10: All system logs must be in standard JSON format.
NFR11: MVP node must support 5 concurrent active onboarding sessions without CPU/RAM throttling.
NFR12: Interface must support French and English with regional terminology (NIU, ENEO).
NFR13: Analytics Infrastructure — Real-time funnel tracking, dimensional data warehouse (PostgreSQL star schema), CSV/JSON exports.
NFR14: Data Governance — minimization, 10-year encrypted storage for KYC docs (COBAC), 3-year analytics retention, role-based access logs.

### Additional Requirements

**From Architecture (ADRs):**
- **ADR-001**: PWA React/TypeScript (Vite + Service Worker) — replaces Flutter. `getUserMedia` + WebRTC for camera, MediaPipe WASM for liveness pre-check, Playwright for E2E tests.
- **ADR-002**: Monolithic modular backend (FastAPI modules: `auth/`, `kyc/`, `backoffice/`, `aml/`, `analytics/`, `admin/`, `notifications/`) deployed via Docker Compose.
- **ADR-003**: Hybrid OCR — PaddleOCR PP-OCRv5 primary (CPU-only, <1s/image), GLM-OCR 0.9B fallback via Celery queue (10-30s async).
- **ADR-004**: Notification strategy — polling `GET /notifications?since={ts}` (foreground: 15-30s, background: 60-120s) + Orange SMS fallback (no Firebase).
- **ADR-005**: Orange Cameroon SMS API for OTP.
- **ADR-006**: Filesystem Docker volume for images (not PostgreSQL BYTEA). PostgreSQL stores paths, SHA-256, metadata only.
- **ADR-007**: PEP/Sanctions screening on local PostgreSQL tables (OpenSanctions/UN/EU/OFAC). Weekly cron sync.
- **ADR-008**: Service Worker offline — app shell + IndexedDB session metadata + temporary encrypted image cache.
- **ADR-009**: Back-office auth — Email/Password + bcrypt/Argon2 + JWT with expiry.
- **ADR-010**: Celery + Redis — workers per queue (glm_ocr_jobs, notifications, provisioning_batch, sanctions_sync).
- Nginx reverse proxy for TLS 1.3 termination, rate limiting, and routing.
- Docker Compose with RAM capping via `.wslconfig` (8GB WSL2 limit). Daily prune scripts.
- KYC State Machine: DRAFT → PENDING_KYC → COMPLIANCE_REVIEW → READY_FOR_OPS → PROVISIONING → ACTIVATED_FULL (with many intermediate/terminal states).
- Sopra Banking Amplitude integration via Axway API Manager on BICEC intranet (ISO 20022 provisioning).
- Star schema PostgreSQL DWH for thesis analytics (funnel events, OCR observability, agent load-balancing, AML screening metrics).

**From UX Design Spec v2:**
- Responsive design for PWA — mobile-first; back-office "Desk-First" 1920x1080.
- Accessibility — French/English, vibrant illustrated guidance for lower digital literacy.
- "Zoom + Compare" requirement — mandatory side-by-side high-res evidence viewer in back-office.
- Digital consent pattern — 3 checkboxes + timestamp (no wet signature in mobile flow).
- CNI capture guidance — auto-crop, blur detection, glare check before upload.

### FR Coverage Map

FR1: Epic 1 — OTP registration, PIN setup, JWT session management
FR2: Epic 2 — CNI Recto/Verso mandatory capture flow
FR3: Epic 2 — Client-side MediaPipe quality gate before upload
FR4: Epic 2 — Liveness selfie with adaptive guidance
FR5: Epic 2 — OCR confidence review screen
FR6: Epic 2 — Progressive sync / session resumption (Service Worker + IndexedDB)
FR7: Epic 2 — 3-strike liveness lockout + "Recommencer" with cache purge
FR8: Epic 2 — Physical branch fallback option
FR9: Epic 3 — Address cascade dropdowns
FR10: Epic 3 — Optional GPS auto-fill
FR11: Epic 3 — GPS privacy notice + coherence warning
FR12: Epic 3 — ENEO/CAMWATER utility bill toggle upload
FR13: Epic 3 — GLM-OCR bill extraction + agency zone dossier routing
FR14: Epic 3 — NIU upload or manual declaration
FR15: Epic 3 — NIU format validation (Regex) + "NIU Declarative" flag
FR16: Epic 3 — LIMITED_ACCESS gating logic
FR17: Epic 3 — Consent checkboxes (CGU, Privacy, Data Processing)
FR18: Epic 3 — Digital consent timestamp stored
FR19: Out of mobile scope — in-branch wet signature only
FR20: Epic 4 — PaddleOCR/GLM-OCR local extraction service
FR21: Epic 4 — Dossier-level global confidence score computation
FR22: Epic 4 — DeepFace 1:1 face matching
FR23: Epic 4 — MiniFASNet liveness/anti-spoofing scoring
FR24: Epic 4 — Per-field confidence + review flags
FR25: Epic 4 — Duplicate detection on local DB
FR26: Epic 5 — Jean's dossier queue with FIFO + confidence prioritization
FR26b: Epic 5 — Agent load balancing (Smooth WRR + Least Connections)
FR27: Epic 5 — Side-by-side "Zoom + Compare" evidence viewer
FR29: Epic 5 — Approve / Reject / Request Info actions + audit log
FR31: Epic 6 — Thomas's AML alert review (fuzzy PEP/Sanctions matching + justification)
FR32: Epic 6 — Identity collision resolution (Conflict Resolver)
FR33: Epic 6 — Agency CRUD + Amplitude batch provisioning monitoring
FR34: Epic 7 — Sylvie's SLA dashboard (R/Y/G)
FR35: Epic 7 — Funnel drop-off analytics
FR36: Epic 7 — SHA-256 immutable audit log
FR37: Epic 1, 5, 6, 7 — RBAC for all personas
FR38: Epic 7 — COBAC compliance pack export (PDF + JSON + Images)
FR39-FR47: Epic 8 — Client Relationship & Banking Discovery frontend demos

---

## Epic List

### Epic 1: Foundation — Project Infrastructure & Authentication
Enable the team to deploy the complete project skeleton and allow all users (Marie, Jean, Thomas, Sylvie, Admin IT) to securely authenticate.
**FRs covered:** FR1, FR37
**NFRs addressed:** NFR4, NFR7, NFR9, NFR10

### Epic 2: Marie's Resilient KYC Capture Journey
Enable Marie to complete the document and biometric capture steps from her mobile device, including resilient offline resumption and the liveness 3-strike lockout.
**FRs covered:** FR2, FR3, FR4, FR5, FR6, FR7, FR8
**NFRs addressed:** NFR1, NFR2, NFR3, NFR6, NFR7, NFR8

### Epic 3: Address, NIU, Utility Bill & Legal Consent
Enable Marie to provide her proof of address, NIU status, and give explicit digital consent before submitting her dossier.
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18
**NFRs addressed:** NFR6, NFR12

### Epic 4: Sovereign AI Engine — OCR, Biometrics & Dossier Scoring
Enable the backend to process uploaded documents with OCR, perform face matching and liveness analysis, compute a global confidence score, and detect duplicates.
**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25
**NFRs addressed:** NFR1, NFR5, NFR6

### Epic 5: Jean's KYC Validation Desk
Enable Jean to efficiently review, inspect, and decide on submitted dossiers through a prioritized queue, a side-by-side evidence viewer, and a complete decision audit trail.
**FRs covered:** FR26, FR26b, FR27, FR29
**NFRs addressed:** NFR4, NFR7

### Epic 6: Thomas's AML/CFT Compliance & Administration
Enable Thomas to screen dossiers against PEP/Sanctions lists, resolve identity conflicts, manage agencies, and monitor Amplitude batch provisioning.
**FRs covered:** FR31, FR32, FR33
**NFRs addressed:** NFR4, NFR14

### Epic 7: Sylvie's Command Center, Audit & Compliance Export
Enable Sylvie to monitor operational health via a R/Y/G dashboard, analyze funnel drop-offs, review the immutable audit log, and export compliance packs for COBAC audits.
**FRs covered:** FR34, FR35, FR36, FR37, FR38
**NFRs addressed:** NFR13, NFR14

### Epic 8: Client Relationship & Banking Discovery (Frontend-Only)
Enable Marie to explore BICEC's banking value proposition through plan personalization, use-case selection, and account management UI shells, with status-driven gating logic.
**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47
**NFRs addressed:** NFR3, NFR12

### Epic 9: Admin IT — Agent Lifecycle & System Administration
Enable Admin IT to manage the complete lifecycle of back-office agents (create, assign to branch, deactivate, reset passwords), manage agency configuration, and configure system parameters, so that Jean, Thomas, and Sylvie can be onboarded before any KYC processing begins.
**FRs covered:** R45, R46 (Requirements 45 and 46)
**NFRs addressed:** NFR4, NFR14

---

## Epic 1: Foundation — Project Infrastructure & Authentication

**Goal:** Establish the complete project skeleton (Docker Compose, database schema, CI-ready monorepo), deploy it locally, and implement secure authentication for all personas so that every subsequent epic has a working foundation to build upon.

### Story 1.1: Docker Compose Infrastructure Setup

As a **developer**,
I want a fully configured Docker Compose environment,
So that all services (Nginx, FastAPI, PostgreSQL, Redis, Celery, PWA, Back-Office) start with a single command and are accessible locally.

**Acceptance Criteria:**

**Given** the repository is cloned on a Windows machine with Docker Desktop
**When** `docker compose up` is executed
**Then** Nginx is reachable on port 443 (TLS 1.3 self-signed cert for dev), FastAPI on port 8000 (via Nginx), PWA on port 3000 (via Nginx), Back-Office on port 3001 (via Nginx), PostgreSQL on port 5432, Redis on port 6379
**And** all containers pass their health checks within 60 seconds
**And** WSL2 RAM is capped at 8GB via `.wslconfig`
**And** a `docker_prune.sh` script exists that prunes build cache/logs when disk > 85%

---

### Story 1.2: PostgreSQL Schema — Core Tables

As a **developer**,
I want the core database tables (users, kyc_sessions, documents, ocr_fields, notifications, audit_logs) created via Alembic migrations,
So that all subsequent epics have a consistent and versioned schema to work against.

**Acceptance Criteria:**

**Given** the PostgreSQL container is running
**When** `alembic upgrade head` is executed
**Then** the following tables exist: `users`, `kyc_sessions`, `documents`, `ocr_fields`, `biometric_results`, `notifications`, `audit_logs`, `agents`, `roles`
**And** `kyc_sessions.status` column accepts only the canonical values: `DRAFT | PENDING_KYC | PENDING_INFO | COMPLIANCE_REVIEW | READY_FOR_OPS | PROVISIONING | OPS_ERROR | OPS_CORRECTION | VALIDATED_PENDING_AGENCY | ACTIVATED_LIMITED | ACTIVATED_PRE_FULL | ACTIVATED_FULL | EXPIRY_WARNING | PENDING_RESUBMIT | MONITORED | REJECTED | DISABLED | ABANDONED`
**And** `kyc_sessions.access_level` accepts: `RESTRICTED | PENDING_ACTIVATION | LIMITED_ACCESS | PRE_FULL_ACCESS | FULL_ACCESS | BLOCKED`
**And** all tables have `created_at` and `updated_at` timestamps
**And** migration is idempotent (re-running does not produce errors)

---

### Story 1.3: Mobile OTP Authentication (Marie)

As **Marie (client)**,
I want to register and authenticate via SMS or Email OTP, then set up a PIN for subsequent logins,
So that I can securely access the onboarding application without remembering a password.

**Acceptance Criteria:**

**Given** Marie opens the PWA for the first time
**When** she enters her phone number and requests an OTP
**Then** an SMS is sent via Orange Cameroon SMS API within 10 seconds
**And** the OTP is stored in Redis with a 5-minute TTL and deleted immediately after successful verification (anti-replay)
**And** upon correct OTP entry, Marie receives a JWT access token and a kyc_session is created with status=DRAFT

**Given** Marie returns to the app with an existing session
**When** she enters her PIN
**Then** she is granted access without a new OTP being sent

**Given** Marie enters an incorrect OTP 3 times
**When** the 3rd incorrect attempt is submitted
**Then** the app displays "Code invalide. Veuillez réessayer ou renvoyer un code." and rate-limits further attempts for 60 seconds

---

### Story 1.4: Back-Office Authentication (Jean, Thomas, Sylvie, Admin IT)

As a **back-office user (Jean / Thomas / Sylvie / Admin IT)**,
I want to log in with my Email and Password,
So that I can securely access the back-office portal with my role-specific permissions.

**Acceptance Criteria:**

**Given** an agent navigates to the back-office login page
**When** they enter a valid Email and Password
**Then** they receive a JWT token and are redirected to their role-specific dashboard (Jean → Validation Desk, Thomas → AML/Compliance, Sylvie → Command Center, Admin IT → `/admin`)

**Given** an agent enters incorrect credentials 5 times
**When** the 5th failed attempt is submitted
**Then** the account is temporarily locked for 15 minutes and a warning is displayed

**Given** a back-office JWT expires
**When** the agent makes an API request
**Then** the API returns 401 and the front-end redirects to the login page

**And** passwords are hashed using bcrypt/Argon2 (never stored in plain text)
**And** RBAC is enforced at API level — Jean cannot access Thomas's, Sylvie's, or Admin IT's endpoints
**And** Admin IT cannot access Jean's validation, Thomas's AML, or Sylvie's metrics endpoints

---

## Epic 2: Marie's Resilient KYC Capture Journey

**Goal:** Enable Marie to complete the complete document and biometric capture sequence — CNI Recto/Verso, liveness selfie, and OCR review — with client-side quality gates, resilient session resumption (Service Worker + IndexedDB), and a graceful 3-strike lockout mechanism.

### Story 2.1: CNI Recto Capture with Client-Side Quality Gate

As **Marie**,
I want to photograph the front of my national identity card with real-time guidance and quality feedback,
So that I can submit a high-quality image on the first attempt.

**Acceptance Criteria:**

**Given** Marie is on the CNI Recto capture screen
**When** she points her camera at her CNI
**Then** the PWA uses MediaPipe WASM to assess frame quality at >15 FPS
**And** visual guidance indicators (blur, glare, alignment rectangle) are displayed in real-time
**And** only frames that pass the blur/glare threshold trigger an auto-capture

**Given** a valid CNI Recto image is captured
**When** Marie confirms the capture
**Then** the image is stored temporarily in IndexedDB (encrypted) and uploaded to `POST /kyc/capture/cni {side: RECTO}` via multipart
**And** the API saves the image to the Docker filesystem volume at `/data/documents/{session_id}/cni_recto.jpg`
**And** a SHA-256 hash is computed and stored in the `documents` table alongside the file path

---

### Story 2.2: CNI Verso Capture

As **Marie**,
I want to photograph the back of my national identity card,
So that the system has the complete CNI document required for regulatory compliance.

**Acceptance Criteria:**

**Given** Marie has successfully captured CNI Recto
**When** she is shown the CNI Verso capture screen
**Then** the same MediaPipe quality gate logic applies as in Story 2.1
**And** the image is uploaded to `POST /kyc/capture/cni {side: VERSO}`
**And** API stores at `/data/documents/{session_id}/cni_verso.jpg` with SHA-256 in `documents` table
**And** the KYC session step progress is updated to reflect both sides captured

---

### Story 2.3: Liveness Selfie with 3-Strike Lockout

As **Marie**,
I want to complete a liveness selfie test with real-time adaptive guidance,
So that the system can verify I am physically present and not using a photo or mask.

**Acceptance Criteria:**

**Given** Marie is on the Liveness capture screen
**When** she follows the on-screen gesture prompts (smile, turn left, blink)
**Then** MediaPipe WASM provides real-time landmark detection feedback
**And** the captured video/frame is uploaded to `POST /kyc/capture/liveness`
**And** MiniFASNet anti-spoofing score and DeepFace face matching score are returned async via Celery

**Given** Marie fails the liveness check 3 consecutive times within the same session
**When** the 3rd failure is recorded
**Then** the session transitions to status=LOCKED_LIVENESS
**And** a 60-second cooldown timer is displayed
**And** Marie is shown: "Désolé pour la gêne, mais pour des raisons techniques/de sécurité, nous sommes obligés de terminer cette session. Ne vous inquiétez pas, vous avez toujours la possibilité d'aller dans une agence locale proche de chez vous, ou de recommencer dès le début."
**And** buttons "Recommencer" and "Aller en agence" are displayed
**And** clicking "Recommencer" purges IndexedDB session cache and creates a fresh session

---

### Story 2.4: OCR Extraction Review Screen

As **Marie**,
I want to review the OCR-extracted fields from my CNI before submitting,
So that I can correct any extraction errors to ensure my dossier is accurate.

**Acceptance Criteria:**

**Given** the OCR service has processed Marie's CNI images
**When** Marie is shown the Review screen
**Then** all extracted fields (Nom, Prénom, Date de Naissance, Numéro CNI, Date de Délivrance, Lieu) are displayed with a confidence badge (green ≥85%, orange 60-84%, red <60%)
**And** Marie can tap any field to manually override the value
**And** corrected values are flagged as `human_corrected=true` in `ocr_fields` table
**And** confirming the review calls `POST /kyc/ocr/confirm {corrected_fields}` and updates the session step

---

### Story 2.5: Session Resumption After Network Loss

As **Marie**,
I want the app to automatically resume my KYC session when my connection is restored,
So that a network interruption (e.g., ENEO blackout) does not force me to restart from scratch.

**Acceptance Criteria:**

**Given** Marie has completed at least one capture step
**When** the PWA's Service Worker detects the session is in IndexedDB and network is restored
**Then** the app displays "Reprise de votre session... Nous avons sauvegardé votre progression." within <2 seconds
**And** the PWA resumes at the last incomplete step, uploading any locally cached images not yet confirmed by the server
**And** upon server confirmation (HTTP 200 + SHA-256 match), the local encrypted copy in IndexedDB is purged
**And** the full app shell (HTML/JS/CSS/icons) is served from the Service Worker cache when offline

---

## Epic 3: Address, NIU, Utility Bill & Legal Consent

**Goal:** Enable Marie to provide her proof of address (utility bill extraction), declare or upload her NIU, and give legally-valid digital consent before submitting her complete dossier.

### Story 3.1: Address Entry with Progressive Cascade Dropdowns

As **Marie**,
I want to enter my address using guided dropdown menus,
So that my address is consistently structured for BICEC's agency routing system.

**Acceptance Criteria:**

**Given** Marie is on the Address entry screen
**When** she selects a Ville
**Then** the Commune dropdown is populated based on the selected Ville
**And** selecting a Commune populates the Quartier dropdown
**And** selecting a Quartier populates the Lieu-dit dropdown
**And** the selected values are stored in the kyc_session's address fields

**Given** Marie taps "Utiliser ma position actuelle"
**When** the browser Geolocation API returns coordinates
**Then** the coordinates are stored encrypted in the session
**And** a privacy notice is displayed: "Nous collectons votre position GPS pour vérifier votre adresse à des fins de conformité KYC. Ces données sont chiffrées et ne sont jamais partagées."
**And** if the GPS distance is >X km from the selected Quartier centroid, a non-blocking warning banner is shown

---

### Story 3.2: Utility Bill Upload & GLM-OCR Extraction

As **Marie**,
I want to upload an ENEO or CAMWATER utility bill as proof of address,
So that my address can be validated by a certified source.

**Acceptance Criteria:**

**Given** Marie is on the Proof of Address screen
**When** she toggles between ENEO and CAMWATER and uploads a bill photo
**Then** the image is uploaded to `POST /kyc/capture/utility_bill {utility_type: ENEO|CAMWATER}`
**And** the API queues a Celery task for GLM-OCR extraction (bill date, agency name)
**And** when extraction is complete, Marie sees the extracted date and agency name for review/correction
**And** the utility agency zone is used to assign the dossier to the nearest BICEC agency (stored in `kyc_sessions.assigned_agency_id`)

---

### Story 3.3: NIU Declaration or Upload

As **Marie**,
I want to either upload my NIU Attestation certificate or manually type my NIU number,
So that my tax identity can be verified as required for full account access.

**Acceptance Criteria:**

**Given** Marie is on the NIU screen
**When** she selects "Upload NIU Attestation" and uploads a document
**Then** the image is stored and flagged as `niu_type=DOCUMENT`

**Given** Marie selects "Déclarer mon NIU manuellement" and types a number
**When** she submits the NIU
**Then** the system validates the format via Regex (Cameroonian NIU format)
**And** if valid, the session is flagged `niu_declarative=true`
**And** if invalid, an inline error "Format NIU invalide (ex: M0XX12345678A)" is displayed

**Given** Marie has declared NIU manually
**Then** the session `access_level` is set to `LIMITED_ACCESS` upon account activation
**And** a note is added to the dossier visible to Jean: "⚠️ NIU Déclaratif — Vérification Jean requise"

---

### Story 3.4: Digital Consent & Dossier Submission

As **Marie**,
I want to explicitly consent to the Terms of Service, Privacy Policy, and Data Processing, then submit my complete dossier,
So that I have given legally-valid consent and my KYC process is formally initiated.

**Acceptance Criteria:**

**Given** Marie is on the Consent screen
**When** she views the three consent items
**Then** three separate checkboxes are displayed: "J'accepte les Conditions Générales d'Utilisation", "J'accepte la Politique de Confidentialité", "J'accepte le traitement de mes données biométriques (Loi 2024-017)"
**And** the "Soumettre mon dossier" button is disabled until all three are checked

**Given** all three checkboxes are checked and Marie taps "Soumettre mon dossier"
**When** the submission is processed by `POST /kyc/submit`
**Then** a timestamp and IP address are recorded in the `audit_logs` table as the consent event
**And** the kyc_session status transitions from DRAFT to PENDING_KYC
**And** Marie sees a "Dossier Soumis avec Succès" screen with a dossier reference number and an estimated review time

---

## Epic 4: Sovereign AI Engine — OCR, Biometrics & Dossier Scoring

**Goal:** Enable the backend to process submitted documents with local OCR, perform biometric face matching and liveness analysis, compute a global dossier confidence score, and detect potential identity duplicates — all within the on-premise sovereign AI infrastructure.

### Story 4.1: PaddleOCR Primary CNI Extraction Service

As a **system**,
I want to extract structured fields from CNI Recto/Verso images using PaddleOCR PP-OCRv5,
So that agents and clients have accurate identity data without manual re-entry.

**Acceptance Criteria:**

**Given** a CNI image is submitted to the OCR service
**When** PaddleOCR processes the image
**Then** it extracts: Nom, Prénom, Date de Naissance, Numéro CNI, Date de Délivrance, Lieu
**And** a confidence score per field is returned
**And** if all fields have confidence ≥85%, results are returned immediately (target <5s on i3)
**And** if any field has confidence <85%, a Celery task is queued for GLM-OCR fallback
**And** results (raw JSON + per-field confidence) are stored in `ocr_fields` table

---

### Story 4.2: GLM-OCR Fallback & Bill Semantic Extraction

As a **system**,
I want to use GLM-OCR as a fallback for low-confidence CNI fields and as the primary engine for utility bill extraction,
So that semantic and unstructured documents are handled accurately.

**Acceptance Criteria:**

**Given** a Celery task is received in the `glm_ocr_jobs` queue
**When** the GLM-OCR worker processes the document
**Then** it runs sequentially (concurrency=1) to avoid CPU saturation on i3
**And** the result is returned within 10-30 seconds (async acceptable for back-office review)
**And** for utility bills, it extracts: date de facturation, nom de l'agence ENEO/CAMWATER
**And** results are upserted in `ocr_fields` with `engine=GLM`

---

### Story 4.3: Biometric Face Matching & Liveness Scoring

As a **system**,
I want to compare the liveness selfie against the CNI photo and compute an anti-spoofing score,
So that the biometric integrity of each KYC dossier is validated.

**Acceptance Criteria:**

**Given** both a CNI Recto image and a liveness selfie are stored for a session
**When** the biometrics service processes them
**Then** DeepFace performs 1:1 face matching and returns a similarity score
**And** MiniFASNet returns an anti-spoofing/liveness score
**And** scores are stored in `biometric_results` table
**And** if liveness score < threshold (configurable), the attempt is flagged as a failure and the strike counter incremented
**And** if face match score < threshold, a `LOW_FACE_MATCH` flag is added to the dossier

---

### Story 4.4: Global Dossier Confidence Score & Duplicate Detection

As a **system**,
I want to compute a single dossier-level confidence score and check for duplicate identities,
So that Jean can prioritize his review queue and Thomas is alerted to potential identity collisions.

**Acceptance Criteria:**

**Given** OCR and biometric processing are complete for a dossier
**When** the scoring service runs
**Then** it computes a single weighted confidence score (OCR accuracy + liveness score + face match + coherence checks)
**And** the score is stored in `kyc_sessions.global_confidence_score`
**And** the system queries existing `users` records for potential name/DOB/NIU matches using `pg_trgm` fuzzy matching
**And** if a match score exceeds the configured threshold, the dossier is flagged `duplicate_suspected=true` and Thomas is notified
**And** the dossier appears in Jean's queue prioritized by confidence score (lowest score = highest priority review)

---

## Epic 5: Jean's KYC Validation Desk

**Goal:** Enable Jean to efficiently manage his validation workload through a prioritized dossier queue, inspect complete evidence packages side-by-side, and render decisions that are fully audited.

### Story 5.1: Jean's Prioritized Dossier Queue

As **Jean (KYC Agent)**,
I want to see a list of dossiers awaiting my review, sorted by priority and confidence score,
So that I can focus on the most urgent or risky cases first.

**Acceptance Criteria:**

**Given** Jean logs into the back-office
**When** he navigates to the Validation Desk
**Then** he sees a queue of dossiers with status=PENDING_KYC sorted by: (1) escalated SLA flags first, (2) lowest global_confidence_score, (3) FIFO
**And** each row shows: client name, submission time, confidence score badge, NIU type (DOCUMENT/DECLARATIVE), duplicate flag, assigned agency
**And** the queue auto-refreshes every 30 seconds
**And** load balancing limits Jean's active dossiers to between 2 and 10 at a time (Smooth WRR + Least Connections algorithm)

---

### Story 5.2: Side-by-Side Evidence Inspector ("Zoom + Compare")

As **Jean**,
I want to inspect a dossier with high-resolution document images displayed side-by-side with extracted OCR fields,
So that I can accurately validate identity data and detect fraud with full evidentiary context.

**Acceptance Criteria:**

**Given** Jean opens a specific dossier from his queue
**When** the Inspection view loads
**Then** CNI Recto, CNI Verso, utility bill, and liveness selfie are displayed as high-resolution images with pan/zoom capability
**And** extracted OCR fields are displayed in a panel adjacent to the document images
**And** a face matching panel shows the selfie vs. CNI photo side-by-side with the similarity score
**And** flagged low-confidence fields are highlighted in orange/red
**And** the `audit_logs` records a `DOSSIER_VIEWED` event with Jean's ID, timestamp, and IP

---

### Story 5.3: Jean's Decision Actions (Approve / Reject / Request Info)

As **Jean**,
I want to approve, reject, or request additional information on a dossier,
So that the KYC lifecycle can progress and Marie is kept informed.

**Acceptance Criteria:**

**Given** Jean has reviewed a dossier
**When** he clicks "Approuver"
**Then** the kyc_session status transitions to READY_FOR_OPS
**And** an audit log event `DOSSIER_APPROVED` is recorded with Jean's ID, timestamp, and IP
**And** Marie receives an in-app notification: "Votre dossier a été approuvé par notre équipe. La prochaine étape est l'activation."

**Given** Jean clicks "Rejeter" and selects a rejection reason
**When** the decision is submitted
**Then** the status transitions to REJECTED
**And** Marie receives an in-app notification with the rejection reason
**And** an audit log event `DOSSIER_REJECTED` is recorded

**Given** Jean clicks "Demander Info" and types a specific request
**When** the request is submitted
**Then** the status transitions to PENDING_INFO
**And** Marie receives an in-app notification detailing what document or information is needed

---

## Epic 6: Thomas's AML/CFT Compliance & Administration

**Goal:** Enable Thomas to screen dossiers against PEP/Sanctions lists, resolve identity collisions, manage agencies, and oversee Amplitude batch provisioning — all within the on-premise compliance infrastructure.

### Story 6.1: PEP/Sanctions List Seeding & Weekly Sync

As a **system administrator (Thomas)**,
I want PEP and sanctions lists (UN, EU, OFAC) to be loaded into the local database and refreshed weekly,
So that AML screening operates on up-to-date data without external service calls.

**Acceptance Criteria:**

**Given** the `sanctions_sync_worker` Celery task is triggered (cron or manually)
**When** it runs
**Then** it downloads the latest lists from OpenSanctions/UN/EU/OFAC (HTTPS batch download)
**And** normalizes and upserts records into the `pep_sanctions` PostgreSQL table
**And** a sync log entry is created in `audit_logs`
**And** the process completes within 10 minutes on the i3 machine
**And** Thomas can manually trigger a re-sync from the admin panel

---

### Story 6.2: AML Alert Review & PEP Screening

As **Thomas**,
I want to review dossiers flagged for potential PEP or sanctions matches,
So that I can clear false positives or confirm matches with full audit accountability.

**Acceptance Criteria:**

**Given** a dossier has been automatically flagged `aml_alert=true` (triggered by pg_trgm fuzzy match)
**When** the status is COMPLIANCE_REVIEW
**Then** Thomas sees the dossier in his AML Alerts queue with a match score and the matched entry details
**And** a side-by-side panel shows the client profile vs. the PEP/Sanctions entry (name, DOB, country, programs)

**Given** Thomas reviews the alert and determines it's a false positive
**When** he clicks "Effacer (Faux Positif)" and enters a mandatory justification
**Then** the dossier status returns to PENDING_KYC for Jean's continued review
**And** an audit event `AML_CLEARED` is recorded with Thomas's ID, justification, and timestamp

**Given** Thomas confirms a real sanctions match
**When** he clicks "Confirmer Match — Geler le compte" with a justification
**Then** the kyc_session status transitions to DISABLED
**And** an audit event `AML_CONFIRMED_FREEZE` is recorded

---

### Story 6.3: Identity Conflict Resolution (Conflict Resolver)

As **Thomas**,
I want to handle cases where a new dossier appears to be a duplicate of an existing client,
So that identity fraud and "Reincarnation" collisions are resolved with a documented audit trail.

**Acceptance Criteria:**

**Given** a dossier has been flagged `duplicate_suspected=true`
**When** Thomas opens the Conflict Resolver
**Then** he sees the new dossier and the suspected existing client record side-by-side
**And** he can choose: "Confirmer comme même personne (Lier)" or "Rejeter comme fraude"
**And** each action requires a mandatory justification comment
**And** the decision is recorded in `audit_logs` with complete event details

---

### Story 6.4: Agency Management & Amplitude Provisioning Monitor

As **Thomas**,
I want to manage BICEC agency records and monitor the status of Amplitude provisioning batches,
So that operational continuity is maintained and any provisioning failures are quickly acted upon.

**Acceptance Criteria:**

**Given** Thomas is on the Admin panel
**When** he views the Agencies section
**Then** he can Create, Read, Update, Deactivate agencies (CRUD) with: agency name, region, zone coordinates, max agent capacity

**Given** a dossier has status=READY_FOR_OPS
**When** Thomas launches the Amplitude provisioning batch
**Then** a Celery task is queued in `provisioning_batch` queue and the status transitions to PROVISIONING
**And** if Amplitude responds within 5 minutes with success, the status transitions to VALIDATED_PENDING_AGENCY
**And** if Amplitude times out (>5 min), the status transitions to OPS_ERROR and Thomas is alerted
**And** Thomas can retry the batch from the OPS_ERROR state

---

## Epic 7: Sylvie's Command Center, Audit & Compliance Export

**Goal:** Enable Sylvie to monitor operational health in real-time (R/Y/G dashboard), analyze conversion funnel drop-offs, access the tamper-evident audit log, and export complete COBAC compliance packs.

### Story 7.1: SLA & Operational Health Dashboard (R/Y/G)

As **Sylvie (Operations Manager)**,
I want to see a color-coded R/Y/G dashboard showing queue health, SLA compliance, and system metrics at a glance,
So that I can take proactive action before SLA violations escalate.

**Acceptance Criteria:**

**Given** Sylvie opens the Command Center
**When** the dashboard loads
**Then** she sees status tiles for: Agent Queue SLA (% within 2h validation target), Liveness Failure Rate, Duplicate Alert Rate, Amplitude Batch Success Rate, System Health (FastAPI, DB, Redis)
**And** each tile is colored GREEN (<threshold), YELLOW (approaching threshold), RED (threshold exceeded)
**And** the dashboard refreshes every 30 seconds and responds to queries within < 3 seconds even with 1,000+ dossiers
**And** Sylvie can escalate any flagged dossier with one click, triggering a priority re-assignment to Jean

---

### Story 7.2: Funnel Drop-Off Analytics

As **Sylvie**,
I want to view analytics on where clients are abandoning the onboarding journey,
So that I can identify UX or technical bottlenecks and drive targeted improvements.

**Acceptance Criteria:**

**Given** Sylvie opens the Funnel Analytics view
**When** the report loads
**Then** she sees conversion rates at each step: Inscription → CNI Recto → CNI Verso → Liveness → Adresse → NIU → Consentement → Soumis → Approuvé → Activé
**And** she can filter by date range and agency
**And** the data is sourced from the `kyc_step_events` analytics table (updated on each step completion)
**And** a time-to-completion histogram shows average duration per step for bottleneck identification

---

### Story 7.3: Immutable SHA-256 Audit Log Viewer

As **Sylvie**,
I want to search and view the complete audit log of every system action,
So that I can demonstrate full traceability for COBAC auditors.

**Acceptance Criteria:**

**Given** Sylvie opens the Audit Log section
**When** she searches by dossier ID, agent name, date range, or event type
**Then** she sees a chronological list of audit events with: event type, actor (user/agent ID), timestamp, IP address, SHA-256 hash of the event payload
**And** the log is append-only (no delete endpoint exists at DB or API level)
**And** each event's SHA-256 hash can be verified against the stored payload
**And** events include: DOSSIER_VIEWED, DOSSIER_APPROVED, DOSSIER_REJECTED, AML_CLEARED, AML_CONFIRMED_FREEZE, CONSENT_SIGNED, SESSION_RESUMED, etc.

---

### Story 7.4: COBAC Compliance Pack Export

As **Sylvie**,
I want to export a complete compliance dossier package for any client with one click,
So that I can respond to COBAC audit requests quickly and completely.

**Acceptance Criteria:**

**Given** Sylvie selects a dossier and clicks "Exporter le Pack Conformité"
**When** the export is generated
**Then** a downloadable archive is produced containing: a PDF summary (client identity, OCR fields, biometric scores, agent decisions, dates), all original high-res images (CNI Recto, Verso, selfie, utility bill), a JSON audit trail for the dossier
**And** the export is generated within 30 seconds
**And** the export action itself is recorded in `audit_logs`

---

## Epic 8: Client Relationship & Banking Discovery (Frontend-Only)

**Goal:** Enable Marie to explore BICEC's banking offering through polished UI demos of plan personalization, use-case selection, and account management, with status-driven gating that reflects her current KYC validation state.

### Story 8.1: Plan Personalization Screen (Standard / Premium / Ultra)

As **Marie (client)**,
I want to see a comparison of BICEC's banking plans with their features and rates,
So that I can understand the value proposition during my KYC validation wait period.

**Acceptance Criteria:**

**Given** Marie has submitted her dossier and her status is PENDING_KYC or ACTIVATED_*
**When** she opens the Plans section
**Then** she sees a swipeable tab interface with Standard, Premium, and Ultra plans
**And** each plan shows: savings interest rate (e.g., Ultra 4.75%), transaction fees, available features
**And** a "Start trial" or "Skip" CTA is displayed
**And** this is a frontend-only demo — no backend banking operation is performed

---

### Story 8.2: Use-Case Personalization Selection

As **Marie**,
I want to select the banking use cases that are relevant to my life (Everyday / Global / Investments),
So that BICEC can tailor my onboarding messaging and demonstrate relevant features.

**Acceptance Criteria:**

**Given** Marie is on the Use-Case selection screen
**When** she selects use-case chips/tags
**Then** her selections are stored locally (IndexedDB or session state)
**And** the choices are saved to the server (`PATCH /kyc/session/preferences {use_cases: [...]}`) upon submission
**And** the screen provides Everyday needs, Global spending, and Investments categories with descriptive chips

---

### Story 8.3: Account Management Dashboard & Status-Based Gating

As **Marie**,
I want to explore my account dashboard with features unlocked or locked based on my KYC validation status,
So that I understand which features are available now and which are unlocked after validation.

**Acceptance Criteria:**

**Given** Marie's `access_level` is RESTRICTED
**When** she opens the Home screen
**Then** all banking feature tiles show a "⏳ Votre compte est en cours de validation" locked state

**Given** Marie's `access_level` is LIMITED_ACCESS
**When** she opens the Home screen
**Then** Cash-In (deposits), View balance, Account settings are unlocked
**And** Outbound transfers, Cash-Out, Crypto, Savings, Investment, Card issuance show a padlock icon with "Complétez votre NIU pour débloquer"

**Given** Marie's `access_level` is FULL_ACCESS
**When** she opens the Home screen
**Then** all UI elements are displayed as unlocked (frontend-only demo for MVP)

**Given** Marie's account is DISABLED
**When** she attempts to log in
**Then** she is shown: "Votre compte a été désactivé. Contactez votre agence ou notre support client par mail help_desk@bicec.com, ou mobile +237612345678."

---
