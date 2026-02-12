[//]: # (~~---)

[//]: # (stepsCompleted: [1, 2, 3, 4, 5, 6])

[//]: # (inputDocuments:)

[//]: # (  - "_bmad-output/planning-artifacts/research/research_report_kyc_bicec.md")

[//]: # (  - "_bmad-output/planning-artifacts/research/technical-Bicec-Veripass-research-2026-02-03.md")

[//]: # (  - "Document de Cadrage Projet.md")

[//]: # (  - "M1  Cadrage & Dataset.txt")

[//]: # (  - "README-bmad.md")

[//]: # (date: 2026-02-07)

[//]: # (author: Ken)

[//]: # (https://campus.datacamp.com/pdf/web/viewer.html?file=https://projector-video-pdf-converter.datacamp.com/23080/chapter4.pdf#page=21)

[//]: # (https://campus.datacamp.com/pdf/web/viewer.html?file=https://projector-video-pdf-converter.datacamp.com/35209/chapter3.pdf#page=20)

[//]: # (---~~)

# Product Brief: bicec-veripass

<!-- Content will be appended sequentially through collaborative workflow steps -->
## Executive Summary

**bicec-veripass** is a sovereign, mobile-first digital onboarding platform designed to transform the banking experience in Cameroon. By replacing a manual process that currently takes **48 hours to 14 days** (depending on dossier completeness) with a secure **11-minute** biometric journey (target), the project aims to bridge the **"Trust Gap"** between tech-savvy youth and security-conscious older generations. 

The primary business lever is a **3x reduction in Customer Acquisition Cost (CAC)** and the total elimination of the administrative backlog. Beyond these immediate gains, bicec-veripass serves as the foundational **"Digital Identity Rail"** for BICEC and the CEMAC zone, creating a sovereign, 100% open-source technical asset that ensures data locality and local expertise.

---

## Core Vision

### Problem Statement

The current account opening process at BICEC is a relic of a paper-based era, plagued by variability—taking from **48 hours up to 14 days** depending on the back-and-forth required for incomplete dossiers. This creates a barrier to financial inclusion, especially for the 18-35 age group ("Marie") who represent 60% of the demographic and prefer the instant accessibility of Mobile Money. 

Furthermore, the **"Trust Gap"** presents a dual challenge: younger users find banks "bureaucratic," while older users fear digital insecurity. This is compounded by infrastructure instability (3G and power cuts) that breaks existing online processes without session recovery.

## Target Users

### Primary Users

#### Marie (The Entrepreneur)
*   **Context**: 24-year-old entrepreneur in Douala. Sensitive to data costs (~500 FCFA/500MB is significant).
*   **Digital Literacy Spectrum**:
    *   **Segment A (60%)**: "Instagram Native" - Comfortable with apps, expects speed.
    *   **Segment B (30%)**: "Feature Phone Graduate" - New to smartphones, needs guidance.
    *   **Segment C (10%)**: "Assisted First-Timer" - Needs agency support (Out of MVP Scope).
*   **Motivations**: Saving 14 days of "back-and-forth" to focus on her boutique.
*   **Success Vision**: Opening a professional account in 11 minutes without physical friction.

#### Jean (The KYC Guardian)
*   **Context**: 32-45 years old, Yaoundé. Transitioning from paper to digital. Personal legal liability for COBAC audits.
*   **Success Vision**: A high-res portal where he can confidently validate identity in under 5 minutes.

### Secondary Users

#### Sylvie (The Strategic Manager)
*   **Context**: Regional Director, monitors ROI/CAG reduction via 30-second Grafana scans.

#### Thomas (The Ops Specialist)
*   **Context**: Integration expert, ensures error-free bulk provisioning to Amplitude.

### Out of Scope (Anti-Personas for MVP)
- ❌ **Corporate Accounts**: SMEs/SARLs requiring complex registration and a longer phase (Phase 2).
- ❌ **Minors (<18)**: Requires parental consent workflows.
- ❌ **Non-Cameroonian Residents**: Passport-only users without local NIU.
- ❌ **Segment C**: Users requiring full physical assistance for smartphone operation (Better for them to go to an agency).

---

## User Journey: Marie's "11-Minute Path"

A benchmark journey assuming stable 3G and documents ready. *Reality Buffer: 15 minutes.*

- **00:00** - Download app (30s)  [\/<UTMS:1.9Mb/s>\\]
- **00:30** - Phone number + OTP (1 min)
- **01:30** - Tutorial/Onboarding skip (2m50s)
- **02:00** - CNI Capture Recto (1 min - auto-framing)
- **03:00** - CNI Capture Verso (1 min - QR code priority)
- **04:00** - NIU Attestation Upload (1.5 min - Photo + OCR)
- **05:30** - Liveness Selfie (1 min - Capture + Buffer)
- **06:30** - Facture Upload (1 min - ENEO/CAMWATER)
- **07:30** - GPS Capture + Address Confirmation (30s)
- **08:00** - Review Data (1.5 min - check pre-filled fields)
- **09:30** - CGU + Signature (1 min)
- **10:30** - **Success Moment**: "Dossier received, notification in <2h".

**Total: 11:00 minutes**

### Problem Impact

- **Financial Exclusion**: Entrepreneurs like "Marie" are pushed towards foreign Mobile Money providers, missing out on formal banking services.
- **Operational Backlog**: Agents like **"Jean" (KYC)** are overwhelmed by manual data entry from low-quality photocopies, while **"Thomas" (Ops)** handles manual account creation in Amplitude.
- **Regulatory Pressure**: After recent CEMAC scandals, the **COBAC** is increasingly severe. A lack of a robust, "human-in-the-loop" audit trail makes compliance (AML/CFT) a critical risk point.
- **Trust Deficiency**: Banks are losing ground to "faster" competitors because they can't match the 24/7 accessibility and speed of digital-first players.

### Why Existing Solutions Fall Short

- **Traditional Banking**: Geographically constrained and lacks the 24/7 "Saturday evening" availability.
- **Mobile Money**: Instant but limited in depth (credit, true KYC-anchored identity).
- **Generic KYC SaaS**: High per-user costs and issues with data locality (Law 2024-017).

### Proposed Solution

A resilient, biometric-first app with **mandatory local session persistence** to handle power and network failures. It features a seamless **multi-persona workflow**:
1.  **Jean (KYC Agent)**: Visually validates originals in high-res via a dedicated portal.
2.  **Thomas (Operations)**: Triggers bulk account creation in *Sopra Banking Amplitude* via *Iwomi Core* once validated.
3.  **Sylvie (Manager)**: Monitors the entire funnel and ops health through a **PostgreSQL + Grafana pipeline**.

Integrations like **NIU/DGI** (fiscal verification) and **Shadow IBU** (regional identity simulation) ensure that "Marie" can open a restricted account instantly, which then scales to full access (BiPay/CRESCO) once human validation is cleared.

---

## Key Strategic Decisions (ADRs)

### ADR-001: Liveness Failure Policy
*   **Decision**: On the 3rd consecutive liveness failure, the session is **locked** and the local cache is **securely purged**.
*   **User Path**: The user is presented with two options:
    1.  **[A] New Session**: Start the journey again from zero (new Session ID, reset counters) to allow for environmental fixes (lighting, position).
    2.  **[B] Visit Branch**: Physical fallback for persistent technical or biometric difficulties.
*   **Rationale**: Balances high anti-spoofing security with conversion resilience for legitimate users (like "Marie").

### ADR-002: Uptime & Availability
*   **Decision**: Target **99.9% (Three Nines)** for the MVP.
*   **Evolution**: Moving to 99.95% (Four Nines) post-MVP will require multi-API redundancy (DGI), Backend Load Balancing, and a guaranteed SLA from the BEAC for the real IBU integration.

## Success Metrics

### User Success Metrics
*Marie (The Customer)*
- **Completion Rate**: >75% of users complete the onboarding in a single session.
- **Onboarding Speed**: Average time <15 minutes (Benchmark: 11 mins).
- **Data Efficiency**: <20MB per journey (Target: 12-15MB through 480p/JPEG-85 compression).
- **Marie CSAT**: >4.2/5 (evaluated with 50 pilot users).
- **First-Time-Right (FTR)**: 
    - Combined Target: >85% acceptance without manual correction.
    - User-Driven Retries: <15% (UX guidance success).
    - System-Driven Failures: <5% (AI/OCR accuracy).

*Jean (The KYC Agent)*
- **Validation SLA**: >90% within 2 hours; >98% within 4 hours (Business Hours).
- **Jean CSAT**: >4.0/5 (interface usability and workload reduction).
- **Verification Accuracy**: <2% false acceptance rate (biometric/OCR) via manual audit.

---

### Business Objectives
- **CAC Transformation**: Achieve a **3x reduction** in Customer Acquisition Cost (6-month target).
- **Operational Efficiency**: 80% reduction in administrative backlog vs. manual process.
- **Conversion Impact**: 30% increase in monthly new accounts for the 18-35 segment.
- **Conformity & Audit**: 
    - Conformity Rate: >95% audit-ready dossiers.
    - Zero Data Loss: No captured documents lost or corrupted.
    - Zero Security Incident: No biometric data leaks.

---

### Sylvie's "Executive Dashboard" (30-Second Scan)

| Status        | Metrics / Critical Alerts |
|:--------------| :--- |
| 🔴 **RED**    | **Action Now**: Dossiers > 2h SLA (Count), Jean's Queue Overload (>10 pending), System Downtime (Uptime <99.9%), Active Fraud Alerts. |
| 🟡 **YELLOW** | **Watch**: Funnel Drop-off Rate (>25% per step), OCR Accuracy Trend (<90%), Thomas Provisioning Failures (>5%). |
| 🟢 **GREEN**  | **Success**: Daily Onboardings (↗), Mean Time to Activation (<24h), Progress to 3x CAC reduction. |

### Key Performance Indicators (KPIs)

| Metric | Target (MVP Phase) | Measurement |
| :--- | :--- | :--- |
| **Uptime** | >99.9% | System Logs |
| **API Latency (p95)** | <3 Seconds | DGI/IBU Response Times |
| **Accuracy (OCR)** | >90% | Manual Audit |
| **Fraud Detection Rate** | >90% | Identified fraudulent doc / total fraud attempts |
| **Success Volume** | 20-50 Pilotes | Amplitude Activated Accounts |

---

## MVP Scope: "Lean, Sovereign & On-Premise"

### Core Features (Functional)

#### 📱 Mobile App (Marie's Journey)
- **Multi-Factor Onboarding**: SMS/Email OTP verification.
- **Resilient AI Capture**: Guidance-assisted CNI capture (PaddleOCR) and Liveness selfie (MiniFASNet + DeepFace).
- **Context-First Persistence**: Mandatory encrypted local cache to handle 3G/Power drops.
- **Document Suite**: Support for NIU Attestation, ENEO/CAMWATER bills, and GPS geolocation.
- **Digital Closure**: Integrated CGU review and digital signature.

#### 🏛️ Back-Office Portal (Ops & KYC)
- **Jean's Validation Desk**: High-resolution side-by-side comparison of CNI original vs. OCR results.
- **Thomas's Provisioning Desk**: Integration bridge to *Amplitude* (via *Iwomi Core*), featuring the "Retry" and "Reactivate Identity" buttons for MOCKED flows.
- **Sylvie's Command Center**: The "Red/Yellow/Green" Grafana dashboard for real-time funnel and SLA monitoring.

---

### Technical & Economic Constraints

- **Infrastructure**: **100% On-Premise**. No cloud/staging allowed (Law 2024-017 & Security Policy).
- **Hardware Profile**: Must operate on standard hardware (Target: **16GB RAM** for development/production nodes).
- **Development Model**: Internalized execution (Interns/Junior devs) using **Docker/Compose** for all environments.
- **Integrations (MVP Phase)**: **Mock/Stub Strategy** for DGI (Tax), BEAC (IBU), and Sopra Amplitude. Real production integrations are deferred to Phase 2.
- **Licensing**: 0 FCFA in per-user SaaS fees. 100% Open Source stack to ensure technological sovereignty.

---

### Out of Scope for MVP
-  **Corporate Onboarding**: SMEs/SARLs requiring complex registry checks.
-  **Minor Accounts**: Anyone under 18 requiring a parental guarantor workflow.
-  **International Passports**: Focusing strictly on Cameroonian CNI for the pilot.
-  **Full Automation (STP)**: No "Auto-Approve" without human validation (COBAC compliance requirement).

---

### Future Vision
- **BICEC ID Rail**: Reusing bicec-veripass identity to one-click open BiPay, CRESCO, or Credit products.
- **CEMAC Expansion**: Deploying the same sovereign stack to other countries in the region.
- **Real Integration Transition**: Phasing out Mocks for live BEAC/DGI/Sopra APIs.


### Key Differentiators

- **Technological Sovereignty**: 100% open-source core (PaddleOCR, DeepFace) for total control and cost efficiency.
- **Context-Aware Resilience**: Encrypted local cache specifically for the Cameroonian infrastructure reality.
- **Strategic Identity Rail**: Built to be the identity anchor for all BICEC services (BiPay, CRESCO, Crédit) and a model for the CEMAC region.
- **Audit-Impeccable Compliance**: A workflow designed to "show blood" to the COBAC agents, proving every step was validated by a responsible human before the account "switch" was flipped.

---

## Operational Handoff & Exception Handling

### 1. Provisioning Lifecycle (Jean → Thomas)
*   **Workflow**: `PENDING_KYC` (Jean) → `READY_FOR_OPS` → `PROVISIONING` (Thomas).
*   **Action**: If Iwomi Core fails to create the account in Amplitude, the state becomes `OPS_ERROR`.
*   **Resolution**: Thomas handles re-provisioning via a **"Retry"** button; Jean is not disturbed for technical failures.

### 2. Amplitude Rejection Protocols
*   **Type A: Technical/Format Error** (e.g., character limit): 
    *   **Action**: Status `OPS_CORRECTION`. Thomas fixes and retries.
*   **Type B: Identity Conflict (NIU Collision)**:
    *   **B1 (Data Match)**: If NIU exists and Name/Surname matches (existing client). 
        *   **Action**: Thomas clicks **"Reactivate Existing Account"**. Client is notified.
    *   **B2 (Data Conflict)**: If NIU exists but Names do NOT match (potential fraud). 
        *   **Action**: Dossier bounces back to Jean with `IDENTITY_CONFLICT` flag for deep manual investigation.

### 3. SLA Escalation & Load Balancing (Sylvie)
*   **Level 1 (Manual)**: Sylvie clicks **"Escalate"** for dossiers exceeding 2h SLA. 
    *   **Effect**: `HIGH_PRIORITY` flag + 30-minute timer for Jean + Notification.
*   **Level 2 (Auto)**: If Jean fails to act within the 30-minute escalation window. 
    *   **Effect**: Notification to **KYC Supervisor** for reassignment or takeover.
*   **Load Balancing**: If a queue exceeds 10 dossiers, Sylvie can trigger **"Redistribute Load"** to move dossiers to agents with lower utilization.

### 4. Batch Integrity (Atomic Processing)
*   **Decision**: Success is handle per-dossier. Failures in a batch are isolated in the `OPS_ERROR` queue, while successes are activated immediately. Rollbacks of entire batches are forbidden.
