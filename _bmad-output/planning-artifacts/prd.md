stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-final']
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-bicec-veripass-2026-02-07.md"
  - "_bmad-output/planning-artifacts/research/research_report_kyc_bicec.md"
  - "_bmad-output/planning-artifacts/research/technical-Bicec-Veripass-research-2026-02-03.md"
  - "Document de Cadrage Projet.md"
  - "M1  Cadrage & Dataset.txt"
  - "README-bmad.md"
workflowType: 'prd'
classification:
  projectType: "Mobile App (Flutter) + API Backend (FastAPI) + Back-Office Portal (Web)"
  domain: "Fintech (Digital KYC/Banking)"
  complexity: "High"
  projectContext: "Brownfield"
---

# Product Requirements Document - bicec-veripass

**Author:** Ken
**Date:** 2026-02-07

## 1. Executive Summary
**bicec-veripass** is a sovereign digital onboarding ecosystem (Mobile App + API + Back-Office) designed to slash BICEC's account opening time from 14 days to 11 minutes. Built on a 100% On-Premise, Open-Source AI stack (PaddleOCR, DeepFace), it bridges the "Trust Gap" for young entrepreneurs while providing a rigorous, COBAC-compliant "Human-in-the-Loop" validation workflow. By using a Mock-First integration strategy, the MVP proves the business value (3x CAC reduction) and operational efficiency (80% backlog reduction) before scaling to a live BEAC/DGI/Amplitude integration in Phase 2.

## 2. Success Criteria

### 👤 User Success
- **Marie (Customer)**: Completes the sub-20MB "low-data" journey with a >75% completion rate, supported by mandatory encrypted session persistence.
- **Jean (KYC Agent)**: Validates dossiers in <5 minutes via a dedicated portal, achieving an 85% First-Time-Right (FTR) rate.
- **Sylvie (Manager)**: Real-time visibility into operational health via a Red/Yellow/Green dashboard, maintaining a >90% Validation SLA (within 2h).

### 💼 Business Success
- **CAC Transformation**: Realize a 3x reduction in Customer Acquisition Cost within 6 months of pilot launch.
- **Regulatory Approval**: Zero critical findings in pre-production COBAC audit; 100% data locality (Law 2024-017).
- **Pilot Traction**: 20-50 verified accounts successfully provisioned via mock-integrated Amplitude flows.

### 🛠️ Technical Success
- **Sovereignty & Efficiency**: 100% dependency on open-source AI; execution on standard 16GB RAM hardware.
- **Contract Integrity**: "API Contract Freeze" achieved for all third-party mocks (DGI/BEAC/Sopra) to ensure Phase 2 compatibility.
- **Biometric Calibration**: Adaptive threshold tuning achieving <2% False Acceptance Rate (FAR).
- **Audit Trail Completeness (Regulatory Shield)**: 100% traceability for every dossier action (capture, validation, activation) with point-in-time IP logs and SHA-256 integrity hashes.

## 3. Product Scope

### MVP - Minimum Viable Product
- **Mobile Journey**: SMS/Email OTP, Resilient AI Capture (PaddleOCR/DeepFace), Local Encryption, Offline Metadata Sync.
- **Back-Office**: Jean's Validation Desk, Thomas's Provisioning Interface (Mocked), Sylvie's Command Dashboard.
- **Core API**: Sovereign Python/FastAPI services for OCR, Biometrics, and KYC State Management.

### Growth Features (Post-MVP)
- **Real Integrations**: Live DGI (Tax), BEAC (IBU), and Sopra Amplitude API connectivity.
- **Scale Ops**: Multi-agent queue management and automated fraud pattern detection.

### Vision (Future)
- **BICEC ID Rail**: Identity anchor for one-click digital banking products (BiPay, CRESCO, Crédit).
- **Regional Export**: RegTech blueprint for CEMAC expansion.

## 4. User Journeys

### 👤 Marie: The "11-Minute Breakthrough" (Success Path)
- **Opening Scene**: Marie needs a bank account for her business but cannot leave her shop. She uses the bicec-veripass app.
- **Rising Action**: She follows vibrant, guidance-assisted alignment for CNI photos and completes a 3-second liveness selfie.
- **Climax**: She sees a "Dossier Securely Submitted" screen with a countdown. 8 minutes total.
- **Resolution**: Within 1 hour, she receives a **push notification activation**. The "Trust Gap" is bridged.

### 👤 Marie: The "ENEO Blackout" (Resilience Path)
- **Opening Scene**: A power cut drops Marie's 3G signal halfway through her document upload.
- **Rising Action**: Signal returns 20 minutes later. The app opens and displays: "Resuming session... We saved your progress." 
- **Climax**: Her previous uploads are intact thanks to the **Encrypted Local Cache**.
- **Resolution**: She finishes the journey seamlessly, avoiding abandonment.

### 👤 Marie: The "3-Strike Liveness Lockout" (Security Exception)
- **Opening Scene**: Marie attempts liveness three times in poor lighting, moving too fast.
- **Rising Action**: On the 3rd failure, the system flags a potential spoofing or technical impossibility.
- **Climax**: The app displays: "We couldn't verify your identity automatically. Choose: [A] Start New Session (resets counter) or [B] Visit Branch (physical fallback)."
- **Resolution**: Marie chooses to reset and try again in better light. Security is maintained without a hard "unfriendly" reject.

### 👤 Jean: The "Evidence-First Validation" (Internal Ops)
- **Opening Scene**: Jean logs in to find Marie's dossier. One OCR field is flagged yellow (Low Confidence).
- **Rising Action**: He uses a side-by-side comparator between the high-res original and the OCR text.
- **Climax**: Jean spots a minor character error, manually corrects it, and confirms the identity.
- **Resolution**: He completes the check in 3 minutes, protected by a full audit log of his manual correction.

### 👤 Thomas: The "Identity Reincarnation" (Provisioning Desk)
- **Opening Scene**: Thomas receives an `OPS_ERROR` for a validated dossier—an NIU collision exists.
- **Rising Action**: He verifies that Marie had a dormant 2018 account with matching data.
- **Climax**: He clicks **"Reactivate Existing Account"** instead of creating a duplicate in Amplitude.
- **Resolution**: The system updates the legacy record with new biometrics. Marie is active, and the database remains clean.

### 👤 Sylvie: The "30-Second Morning Scan" (Management)
- **Opening Scene**: Sylvie checks the **Command Center** dashboard over coffee.
- **Rising Action**: She spots a **YELLOW** alert indicating a drop-off at Liveness for segment B (Low Literacy).
- **Climax**: She confirms that system uptime and SLA are **GREEN**, pinpointing the issue as UX guidance.
- **Resolution**: She initiates a UX tuning task for the next sprint, maintaining proactive control.

### Journey Requirements Summary
1. **Mobile**: Resilient Progressive Upload, Encrypted Session Persistence, 3-Strike Lockout Logic.
2. **Back-Office (Jean)**: OCR Comparator, Manual Override, Decision Auditing.
3. **Back-Office (Thomas)**: Conflict Resolver (Retry/Reactivate), State Machine Visualization.
4. **Management**: Multi-color Grafana Monitoring, Segmented Funnel Analytics, SLA Alerting.

## 5. Domain-Specific Requirements

### ⚖️ Compliance & Regulatory
- **COBAC R-2023/01 & R-2019/02 Compliance**: Mandatory "Human-in-the-Loop" for all account activations. No Straight-Through Processing (STP) for new onboardings.
- **Law 2024-017 (Data Protection)**: Strict adherence to data locality. **100% On-Premise** hosting with zero external cloud dependencies.
- **KYC/AML Standards**: Multi-source verification (CNI + NIU Attestation + Utility Bill) to prevent identity fraud.
- **Auditability**: Bulletproof traceability of all biometric and manual decisions (SHA-256 integrity).

### ⚙️ Technical Constraints (Universal 16GB Node Strategy)
- **Lowest Common Denominator**: The complete software stack MUST run comfortably on an **Intel Core i3 @ 2.5GHz** (Office machine). Project success cannot depend on NPU acceleration.
- **Resource Budget (Strict 16GB Cap)**:
    - **Docker Desktop (WSL2)**: Hard-capped at **8GB RAM** (via `.wslconfig`).
    - **Headroom**: 2GB buffer for OS/Management; 6GB for local development (IDEs/UI).
- **Storage Hygiene**: Hard **200GB Disk Limit**. "Prune-First" policy: automated daily deletion of Docker build cache and logs required.
- **Eco-System Sovereignty**: 100% Open-Source AI core (PaddleOCR, DeepFace, MiniFASNet). No 3rd-party SaaS licensing fees.

### 🔄 Integration Requirements
- **Iwomi Core Middleware**: Integration point for Sopra Amplitude provisioning.
- **Mock/Stub Layer**: Full simulation of external DGI (Tax) and BEAC (IBU) responses for the MVP pilot.
- **Provisioning States**: Automated lifecycle management between `PENDING_KYC` (Jean) and `PROVISIONING` (Thomas).

### 🚩 Risk Mitigations
1. **Biometric Drift**: Mitigated by the **Calibration Window** (tuning liveness/OCR thresholds during pilot).
2. **Identity Fraud/Collisions**: Thomas's **Conflict Resolver** journey handles existing-account "Reincarnation".
3. **Hardware Throttle**: Optimized container orchestration to prevent i3 CPU pegging during concurrent OCR/Biometric workloads.

## 6. Innovation & Novel Patterns

### 💎 Detected Innovation Areas
- **Sovereign RegTech Blueprint**: A 100% On-Premise, Open-Source AI stack (PaddleOCR, DeepFace) that eliminates vendor lock-in and foreign SaaS dependency—a pioneering move for Tier-1 banks in Cameroon.
- **Context-Aware Resilience (Mobile/Edge)**: The combination of **Encrypted Local Cache** + **Progressive Sequential Upload** + **Sovereign Biometric States** specifically engineered to survive "Délestage" (power cuts) and unstable 3G infrastructure.
- **Hybrid "Audit-Impeccable" Workflow**: An innovative RegTech approach where the UX is designed strictly to "show the blood" (evidence) to COBAC regulators, turning a compliance burden into a competitive advantage (faster approval).
- **Mock-First ROI Proof**: Using a "Shadow IBU" and mock tax APIs to prove a 3x CAC reduction *before* committing to years of external integration overhead.

### 📊 Market Context & Competitive Landscape
- **Local Reality**: Most competitors depend on foreign SaaS (Onfido, Jumio) which poses data locality risks (Law 2024-017) and high per-user costs.
- **Bicec-Veripass Edge**: Zero marginal license cost + 100% data sovereignty + resilience built for Cameroonian infrastructure (not Western fiber).

### 🧪 Validation Approach
- **The 20-50 Pilot**: Validating OCR/Liveness accuracy on "real-world" Cameroonian document quality (low-res, stained, or worn CNI).
- **Stress-Testing Resilience**: Simulating "Drop-Off" events (manual signal killing) to prove the recovery logic works as intended.

### 🛡️ Risk Mitigation
- **The "Lowest Common Denominator" Shield**: Mitigating hardware bottlenecks on i3 machines by optimizing container loads and daily cache pruning.
- **Fallback Hierarchy**: The "3-Strike Liveness Lockout" provides a graceful descent from Auto-Biometry to Manual Branch verification.

## 7. Project-Type Specific Requirements

### 📱 Mobile App Requirements (Flutter)
- **Compatibility Strategy**:
    - **Minimum SDK**: Android 24 (7.0), iOS 15.
    - **Target SDK**: Latest supported by current Flutter stable tooling.
- **Device Permissions**: 
    - `CAMERA`: Mandatory for high-res CNI/Passport capture and Liveness.
    - `INTERNET`: For secure dossier submission.
    - `STORAGE`: Encrypted local persistence for session recovery.
- **NFC Strategy**: **Out of Scope for MVP** (avoid hardware fragmentation/UX complexity).
- **Offline & Resilience**: Full **Encrypted Local Cache** (SQLite/Hive) to handle "Délestage" or signal loss.
- **Store Compliance**: Hardened for APK distribution (for internal BICEC devices) and future Play Store compliance.

### 🌐 API Backend Requirements (FastAPI)
- **Protocol Paradigm**: **Lean REST/JSON** for MVP (maximizes mock-resilience and development velocity).
- **Endpoint Specification**: 
    - `/auth`: OTP-based mobile authentication (SMS/Email).
    - `/kyc/capture`: Sequential image upload with immediate OCR feedback.
    - `/kyc/verify`: Biometric comparison (DeepFace) and state management.
    - `/backoffice/dossiers`: Queue management for Jean, Thomas, and Sylvie.
- **Authentication Model**: **OTP-based session management** for Mobile (SMS/Email); strict refresh/expiry hierarchy. Back-office uses Email/Password (No AD).
- **Data Schemas**: Strict Pydantic models for OCR extraction and BICEC-standard KYC profiles.
- **Mock Integration Hierarchy**: High-fidelity stubs for `DGI_MOCK`, `BEAC_MOCK`, and `AMPLITUDE_MOCK`.

### 🖥️ Back-Office Portal (Web/React)
- **"Zoom + Compare" Requirement**: Mandatory side-by-side high-res evidence viewer for manual OCR validation and fraud review.
- **Browser Matrix**: Optimized for **Chrome/Edge** (Desktop) used by BICEC agents.
- **Responsive Design**: Fixed-width "Desk-First" layout optimized for 1920x1080 agent monitors.
- **SLA & Performance**: Dashboard queries (Sylvie) must resolve in <3s even with 1,000+ dossiers in history.
- **Security**: Strict Role-Based Access Control (RBAC) mapping Jean, Thomas, and Sylvie to their specific journeys.

### 🛠️ Common Implementation Considerations
- **Architecture Paradigm**: Monolithic Docker-Compose deployment for MVP (fits **16GB RAM** constraint); micro-service path prepared for Phase 2.
- **Security Protocols**: **TLS 1.3** for all internal traffic; **AES-256** for biometric data at rest.

## 8. Project Scoping & Phased Development

### 🎯 MVP Strategy & Philosophy
**MVP Approach**: **Compliance & ROI Validator.** 
The goal is to prove that a sovereign AI stack can securely onboard 20-50 users with 3x lower costs and 100% data locality, even before the real BEAC/DGI APIs are ready.
**Resource Requirements**: 1-2 Internal Devs/Interns; 1 Project Lead (Ken).

### 🚀 MVP Feature Set (Phase 1)
**Core User Journeys Supported**:
- Marie's Resilient Onboarding (including "ENEO Blackout" and "3-Strike Lockout").
- Jean's side-by-side Validation Desk + Audit Log.
- Thomas's Conflict Resolver (Mocked Reactivation).
- Sylvie's Dashboard (Red/Yellow/Green).

**Must-Have Capabilities**:
- **Resilient Mobile Capture**: Sequential upload, local encrypted cache.
- **Sovereign AI Engine**: PaddleOCR + DeepFace running locally on Docker.
- **Human-in-the-Loop Portal**: RBAC for Jean, Thomas, and Sylvie.
- **Mock Service Layer**: High-fidelity stubs for DGI, BEAC, and Sopra Amplitude.
- **Universal 16GB Optimization**: WSL2 RAM capping and auto-pruning scripts.

### 📈 Post-MVP Features (Phases 2 & 3)
**Phase 2 (Growth - Integration & Intelligence)**:
- **Live Tunneling**: Replace mocks with real TLS-secured pipes to BEAC, DGI, and Sopra Amplitude (via Iwomi).
- **Multi-Agent Load Balancing**: Queue distribution for larger onboarding teams.
- **Automated Fraud Scoring**: Pattern detection based on pilot data.

**Phase 3 (Expansion - The ID Rail)**:
- **CEMAC Regional Support**: Support for passports/IDs from neighboring CEMAC nations.
- **Cross-Service Identity**: BICEC ID used for BiPay and credit product 1-click applications.
- **NFC Support**: Hardware-level chip reading for biometric passports.

### 🛡️ Risk Mitigation Strategy
- **Technical Risks**: Mitigated by the **API Contract Freeze** (stubs defined early) and **Lowest Common Denominator** hardware testing (i3 benchmark).
- **Market Risks**: Mitigated by the **20-50 User Pilot** to calibrate biometric thresholds before wide release.
- **Resource Risks**: Mitigated by a **Lean Monolith** architecture (one Docker-Compose file) to simplify maintenance for a small team.

## 9. Functional Requirements

### 👤 Identity & Capture (Mobile — Marie's Journey)
- **FR1 (Auth)**: Users register/authenticate via OTP (SMS for Auth only).
- **FR2 (Deep Capture)**: The system enforces **Recto AND Verso** capture for CNI (mandatory). It also supports Passport (alternative) and NIU Attestation.
- **FR3 (Quality Control)**: The app guides capture (auto-crop, blur detection, glare check) and rejects poor-quality images client-side before upload.
- **FR4 (Liveness)**: Users perform a real-time "Liveness" video selfie with adaptive visual guidance (smile, turn left, etc.).
- **FR5 (Review)**: Users see OCR extraction results (fields + confidence) for immediate confirmation.
- **FR6 (Resilience)**: Progressive Sync allows resuming interrupted sessions without data loss (encrypted local cache).
- **FR7 (3-Strike Lockout)**: After 3 failed liveness/biometric checks, the session locks, and the user is redirected to go to a physical branch or fresh start.
- **FR8 (Fallback)**: Users can explicitly select a "Physical Branch" option if they prefer manual onboarding or start over.

### 📍 Localization & Proof of Address
- **FR9 (Cascade Address)**: Address input uses progressive dropdowns: *Ville → Commune → Quartier → Lieu-dit*.
- **FR10 (Declarative Map Pin)**: Users must pinpoint their **Home Location on an embedded map** (OpenStreetMap) "on honor."
- **FR11 (Compliance GPS)**: The system stores map coordinates as compliance metadata and for future delivery/logistics use cases.
- **FR12 (Utility Choice)**: Users choose **Either ENEO Or CAMWATER** (toggle) to upload as proof of address.
- **FR13 (Coherence Check)**: The system validates utility bill date (≤ 3 months) and checks coherence between bill address and declared "Quartier/Ville."

### ⚖️ NIU & Legal Consent
- **FR14 (Flexible NIU)**: Users can upload the NIU Attestation **OR** manually declare the NIU number.
- **FR15 (Validation Logic)**: For manual NIU, the system validates format (Regex) and flags the dossier as "NIU Declarative."
- **FR16 (Status Impact)**: "Declarative NIU" triggers a **LIMITED_ACCESS** account status until back-office verification.
- **FR17 (Consent)**: Users must scroll through and accept Terms (CGU) and the Account Contract via a checkbox.
- **FR18 (Digital Signature)**: Users sign the contract digitally on the touchscreen (timestamped & stored).
- **FR19 (Wet Signature Capture)**: Users must sign **3 times on a white paper**; the app captures this for the compliance "Signature Card."

### 🧠 Sovereign AI Engine (FastAPI)
- **FR20 (OCR Engine)**: Local OCR extracts structured fields from CNI (Recto/Verso) and utility bills.
- **FR21 (Global Confidence Score)**: The system computes a **single dossier-level confidence score** (OCR + liveness + face match + coherence) for prioritization.
- **FR22 (Biometrics)**: Face matching performs 1:1 matching (Selfie vs. CNI Photo) and outputs a score.
- **FR23 (Anti-Spoofing)**: Liveness/anti-spoofing outputs a score and flags suspicious captures.
- **FR24 (Field Confidence & Flags)**: The system assigns confidence per OCR field and raises flags for human review.
- **FR25 (Duplicate Check)**: The system checks for potential duplicates in the local database and raises a "possible duplicate" flag.

### 🔍 Validation Desk (Jean — Validation)
- **FR26 (Queue)**: Agents view a prioritized queue based on FIFO, priority flags, and global confidence scores.
- **FR27 (Deep Inspection)**: Agents compare High-Res Originals (Recto, Verso, Bill, Sig Card) side-by-side with extracted data.
- **FR28 (Correction)**: Agents can correct OCR errors with a mandatory justification log (original value preserved).
- **FR29 (Decision)**: Agents can Approve, Reject (with reason), or Request Info (Push Notification sent to user).
- **FR30 (Signature Check)**: Agents verify the "3x Wet Signature" capture against the CNI signature.

### ⚙️ Ops & Provisioning (Thomas — Resolution)
- **FR31 (Collision Handling)**: Ops can resolve duplicates by linking new dossiers to existing client records.
- **FR32 (Mock Provisioning)**: The system triggers a mocked "Create Account" call to the Core Banking stub (Sopra Amplitude Mock).
- **FR33 (Status View)**: Ops view real-time provisioning status (Pending/Success/Error).

### 📈 Monitoring & Audit (Sylvie — Supervision)
- **FR34 (SLA Dashboards)**: Managers view Red/Yellow/Green health status of queues and services.
- **FR35 (Funnel)**: Analytics on drop-off rates across the Marie journey.
- **FR36 (Audit Log)**: Immutable SHA-256 log of every action, including who viewed what and when.
- **FR37 (RBAC)**: Strict Role-Based Access Control for all internal personas.
- **FR38 (Evidence Pack)**: One-click export of a full compliance dossier (PDF + JSON + Images) for COBAC audits.

### 🏦 The "Banking Demo" (Frontend Only)
- **FR39 (Banking UI Shell)**: The app includes **frontend-only** screens for Cash-In, Virtual Cards, and Trading to demonstrate vision.
- **FR40 (Gating Logic)**: Vision features are visually **locked/greyed out** for "Pending/Limited" users and unlocked for "Full/Validated" users.
- **FR41 (Notification Strategy)**: SMS is used strictly for OTP; all status updates use **Push Notifications** (zero-cost).

## 10. Non-Functional Requirements

### ⚡ Performance (Snappy AI Standards)
- **NFR1 (Inference Latency)**: Total AI processing must be **<15 seconds** (Target: OCR <5s, Liveness <10s) on the 16GB i3 benchmark node.
- **NFR2 (Mobile Fluidity)**: Capture guidance must operate at **>15 FPS** on mid-range Android 7.0 devices to ensure image quality.
- **NFR3 (Mobile Footprint)**: Total app size must be **<40MB** (Target: <20MB for initial download) to respect Cameroonian data constraints. Cold start time must be **<4 seconds**.

### 🛡️ Security & Sovereignty
- **NFR4 (Auth Simplicity)**: Back-office access (Jean/Thomas/Sylvie) uses standard **Email/Password** authentication managed in the local application database (No Active Directory for MVP). Passwords must be hashed using **bcrypt/Argon2**.
- **NFR5 (Data at Rest)**: 100% of biometric templates and CNI images must be encrypted using **AES-256** inside the Docker volumes.
- **NFR6 (Sovereignty Pillar)**: The system must operate with **no external service calls** for its core AI functions, ensuring 100% data sovereignty and regulatory compliance.
- **NFR7 (Transport)**: All communication between the Flutter app and FastAPI must use **TLS 1.3**.

### 🔌 Reliability & Resilience
- **NFR8 (Resumption Speed)**: App must resume an "In-Progress" session within **<2 seconds** of signal return using local encrypted cache.
- **NFR9 (Health & Pruning)**: System must trigger a **Docker Prune** if disk usage exceeds 85% of the 200GB partition. A **daily local database backup** must be saved to a separate, non-pruned folder prior to cleanup.
- **NFR10 (Log Standards)**: All system logs must be in standard **JSON format** for simplicity and future SIEM compatibility.

### 📊 Scalability & Accessibility
- **NFR11 (Concurrent Pilot)**: The MVP node must support **5 concurrent active onboarding sessions** without CPU/RAM throttling.
- **NFR12 (Language & Literacy)**: The interface must support **French and English** with regional terminology (NIU, ENEO) and vibrant illustrated guidance for lower digital literacy.
