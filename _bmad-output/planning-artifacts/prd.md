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
**bicec-veripass** is BICEC's **client relationship and service discovery platform**—a mobile-first ecosystem that transforms customer acquisition through digital KYC onboarding (**<15 minutes [11-minute stretch goal]** vs. 14 days), personalized banking service demonstrations, and account lifecycle management. Built on a 100% On-Premise, Open-Source AI stack (PaddleOCR, DeepFace), it serves as the **central touchpoint** for new customer relationships, bridging the "Trust Gap" for young entrepreneurs while maintaining COBAC-compliant "Human-in-the-Loop" validation.

The platform combines:
1. **Client Acquisition**: Streamlined digital KYC (CNI, NIU, Liveness) feeding verified identities into Sopra Banking Amplitude
2. **Service Discovery**: Frontend banking feature demonstrations (Accounts, Savings, Cards, Transfers) adapted to user account status
3. **Relationship Management**: Plan personalization (Standard/Premium/Ultra tiers) and use-case based onboarding (Everyday needs, Global spending, Investments)
4. **Future Integration Foundation (Phase 2)**: Positioned as central authentication gateway for BiPay and broader BICEC digital ecosystem

By using a Mock-First integration strategy, the MVP proves the business value (3x CAC reduction, 80% backlog reduction) before scaling to live DGI/Amplitude integration in Phase 2.

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
- **Contract Integrity**: "API Contract Freeze" achieved for all third-party mocks (DGI/Sopra) to ensure Phase 2 compatibility.
- **Biometric Calibration**: Adaptive threshold tuning achieving <2% False Acceptance Rate (FAR).
- **Audit Trail Completeness (Regulatory Shield)**: 100% traceability for every dossier action (capture, validation, activation) with point-in-time IP logs and SHA-256 integrity hashes.

## 3. Product Scope

### MVP - Minimum Viable Product
- **Mobile Journey**: SMS/Email OTP, Resilient AI Capture (PaddleOCR/DeepFace), Local Encryption, Offline Metadata Sync.
- **Back-Office**: Jean's Validation Desk, Thomas's Provisioning Interface (Mocked), Sylvie's Command Dashboard.
- **Core API**: Sovereign Python/FastAPI services for OCR, Biometrics, and KYC State Management.

### Growth Features (Post-MVP)
- **Real Integrations**: Live DGI (Tax) and Sopra Amplitude API connectivity.
- **Scale Ops**: Multi-agent queue management and automated fraud pattern detection.

### Vision (Future)
- **BICEC ID Rail**: Identity anchor for one-click digital banking products (BiPay, CRESCO, Crédit).
- **Regional Export**: RegTech blueprint for CEMAC expansion.

## 4. User Journeys

### 👤 Marie: The "15-Minute Breakthrough" (Success Path)
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
- **Climax**: The app displays: "Désolé pour la gêne, mais pour des raisons techniques/de sécurité, nous sommes obligés de terminer cette session. Ne vous inquiétez pas, vous avez toujours la possibilité d'aller dans une agence locale proche de chez vous, ou de recommencer dès le début. [Bouton: Recommencer]"
- **Resolution**: When Marie clicks "Recommencer," her session data is securely wiped and she can start fresh. Security is maintained without a hard "unfriendly" reject.

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
- **Core Banking Integration**: Direct integration point for Sopra Amplitude provisioning.
- **Mock/Stub Layer**: Full simulation of external DGI (Tax) responses for the MVP pilot. Sopra Banking Amplitude handles IBU generation automatically.
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
- **Mock-First ROI Proof**: Using mock tax APIs to prove a 3x CAC reduction *before* committing to years of external integration overhead. Sopra Banking Amplitude handles IBU generation as part of core banking integration.

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
- **Mock Integration Hierarchy**: High-fidelity stubs for `DGI_MOCK` (tax validation) and `AMPLITUDE_MOCK` (account provisioning). Sopra Banking Amplitude handles IBU generation automatically.

### 🖥️ Back-Office Portal (Web-based SPA)
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
The goal is to prove that a sovereign AI stack can securely onboard 20-50 users with 3x lower costs and 100% data locality, even before the real DGI APIs are ready.
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
- **Mock Service Layer**: High-fidelity stubs for DGI and Sopra Amplitude.
- **Universal 16GB Optimization**: WSL2 RAM capping and auto-pruning scripts.
- **Client Relationship Frontend (Banking Demos - UI Only)**:
  - **Plan Personalization**: Premium/Standard/Ultra tier presentation with feature comparison (interest rates, transaction fees, purchase protection)
  - **Use-Case Selection**: Everyday needs (Transfers, Budgeting, Cards), Global spending (Forex, Airport lounge), Investments (Trading, Crypto)
  - **Account Management UI**: Home dashboard with Main account, Pockets, Savings goals, Linked accounts (frontend-only, no backend)
  - **Banking Feature Shells**: Cards management, Recurring transfers, Add money/Withdraw interfaces adapted to account status (FULL_ACCESS, LIMITED_ACCESS, PENDING, DISABLED)
  - **Purpose**: Demonstrate service capabilities and educate users on available banking features while KYC is validated

### 📈 Post-MVP Features (Phases 2 & 3)
**Phase 2 (Growth - Integration & Intelligence)**:
- **Live Tunneling**: Replace mocks with real TLS-secured pipes to DGI and Sopra Amplitude.
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
- **FR7 (3-Strike Lockout)**: After 3 failed liveness/biometric checks, the app displays: "Désolé pour la gêne, mais pour des raisons techniques/de sécurité, nous sommes obligés de terminer cette session. Ne vous inquiétez pas, vous avez toujours la possibilité d'aller dans une agence locale proche de chez vous, ou de recommencer dès le début." When the user clicks "Recommencer," session data is securely wiped and they can start fresh.
- **FR8 (Fallback)**: Users can explicitly select a "Physical Branch" option if they prefer manual onboarding or start over.

### 📍 Localization & Proof of Address
- **FR9 (Cascade Address)**: Address input uses progressive dropdowns: *Ville → Commune → Quartier → Lieu-dit*.
- **FR10 (GPS Location - Optional)**: Users can optionally use a "Utiliser ma position actuelle" button to auto-populate GPS coordinates.
- **FR11 (Privacy Notice & Compliance)**: When GPS is used, the system displays a privacy notice: "We collect your GPS location to verify your address for compliance purposes. This data is encrypted and never shared (Enregistré pour des fins de contrôle réglementaire de KYC)." If GPS distance > X km from selected Quartier, show a warning (don't block).
- **FR12 (Utility Choice)**: Users choose **Either ENEO Or CAMWATER** (toggle) to upload as proof of address.
- **FR13 (Bill Validation)**: The system extracts the bill date and ENEO/CAMWATER agency name using PaddleOCR. The system uses the utility agency zone to assign the dossier to the nearest BICEC agency for load balancing. Address coherence validation is performed manually by Jean during back-office review.

### ⚖️ NIU & Legal Consent
- **FR14 (Flexible NIU)**: Users can upload the NIU Attestation **OR** manually declare the NIU number.
- **FR15 (Validation Logic)**: For manual NIU, the system validates format (Regex) and flags the dossier as "NIU Declarative."
- **FR16 (Status Impact)**: "Declarative NIU" triggers a **LIMITED_ACCESS** account status until back-office verification. LIMITED_ACCESS allows Cash-In transactions only; all other features (Virement, Cards) are locked pending full KYC validation by Jean.
- **FR17 (Consent)**: Users must scroll through and accept Terms (CGU) and the Account Contract via a checkbox.
- **FR18 (Digital Signature)**: Users sign the contract digitally on the touchscreen (timestamped & stored).
- **FR19 (Wet Signature 3x - MANDATORY)**: Users must sign **3 times on a white paper**; the app captures this photo for the compliance "Signature Card." This is a BEAC/COBAC regulatory requirement confirmed by Ken's supervisor (2026-02-15).

### 🧠 Sovereign AI Engine (FastAPI)
- **FR20 (OCR Engine)**: Local OCR extracts structured fields from CNI (Recto/Verso) and utility bills.
- **FR21 (Global Confidence Score)**: The system computes a **single dossier-level confidence score** (OCR + liveness + face match + coherence) for prioritization.
- **FR22 (Biometrics)**: Face matching performs 1:1 matching (Selfie vs. CNI Photo) and outputs a score.
- **FR23 (Anti-Spoofing)**: Liveness/anti-spoofing outputs a score and flags suspicious captures.
- **FR24 (Field Confidence & Flags)**: The system assigns confidence per OCR field and raises flags for human review.
- **FR25 (Duplicate Check)**: The system checks for potential duplicates in the local database and raises a "possible duplicate" flag.

### 🔍 Validation Desk (Jean — Validation)
- **FR26 (Queue)**: Agents view a prioritized queue based on FIFO, priority flags, and global confidence scores.
- **FR26b (Load Balancing)**: The system distributes dossiers intelligently to agents based on: (1) Agent capacity (minimum 2, maximum 10 dossiers per agent), (2) Agent availability (online/offline status), (3) Current load (prefer agents with fewer active dossiers).
- **FR27 (Deep Inspection)**: Agents compare High-Res Originals (Recto, Verso, Bill) side-by-side with extracted data.
- **FR28 (Correction)**: Agents can correct OCR errors with a mandatory justification log (original value preserved).
- **FR29 (Decision)**: Agents can Approve, Reject (with reason), or Request Info (Push Notification sent to user).
- **FR30 (Signature Check)**: Agents verify the "3x Wet Signature" photo capture against the CNI signature for authenticity.

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

### 🏦 Client Relationship \u0026 Banking Discovery (Frontend Only)
> [!IMPORTANT]
> **FR39-47 describe frontend-only demonstrations** of banking capabilities to establish client relationships and educate users on service offerings. These interfaces adapt based on account validation status (PENDING/LIMITED_ACCESS/FULL_ACCESS/DISABLED) to demonstrate the value proposition while KYC is being validated. **No backend banking operations are implemented in MVP.**

- **FR39 (Plan Personalization)**:
  - **Premium/Standard/Ultra Tier Presentation**: Users see detailed plan comparisons with:
    - **Interest rates** (e.g., Ultra: 4.75%, Premium: 3%, Standard: 2.29% on savings)
    - **Transaction fees** (e.g., Ultra: 1.49% commodities, Premium: 1.49% reduced, Standard: 1.99%)
    - **Features** (Stock trading limits, crypto fees, purchase protection, airport lounge access)
  - **Purpose**: Position BICEC as competitive with neobanks like Revolut, demonstrate value before full activation
  - **UI**: Swipeable tab interface (Ultra/Metal/Premium/Plus/Standard) with "Start trial" / "Skip" options

- **FR40 (Use-Case Personalization)**:
  - **Selection Interface**: Users pick relevant use cases via chip/tag selection:
    - **Everyday needs**: Transfers, Scheduling payments, Professional account, Metal card, Cashback, Budgeting, View accounts in one place, Shopping deals, Get paycheck early, Kids account
    - **Global spending**: Overseas transfers, Foreign exchange, Spending abroad, Airport lounge access
    - **Investments**: Stock trading, Crypto, Commodities (partially visible in mockup)
  - **Purpose**: Tailor onboarding messaging and UI emphasis based on declared interests, build anticipated feature awareness

- **FR41 (Account Management Dashboard)**:
  - **Home Screen UI** (frontend mockup):
    - **Main Account**: Balance display (£0 mockup), country selector (British pound flag), Accounts button
    - **Pockets**: Custom savings pockets (e.g., "Salvation lies within" with checkmark icon) with individual balances
    - **Savings**: "Add Savings" card showing interest rate (4.75%), CTA to create savings goal
    - **Linked Accounts**: "Add Linked" card to connect external bank accounts ("See all your bank accounts in one place")
    - **Add New** button for creating additional accounts/pockets
  - **Purpose**: Demonstrate account organization capabilities and modern neobank-style UX

- **FR42 (Account Detail View)**:
  - **UI Elements** (frontend mockup):
    - **Account header**: Name ("Salvation lies within"), balance, "Accounts" access
    - **Action buttons**: Add money, Withdraw (grayed out if LIMITED_ACCESS), Details, More
    - **Goal Tracking**: "Track your progress" widget with "Add" button
    - **Recurring Transfers**: "Add money automatically" setup
    - **Bottom Navigation**: Home, Invest, Transfers, Crypto, Lifestyle tabs
  - **Transactions**: "No transactions yet" empty state for new accounts

- **FR43 (Recurring Transfers UI)**:
  - **Schedule Modal**:
    - **Start date picker**: Calendar selector (e.g., December 15, 2023)
    - **Repeat frequency**: Dropdown (Monthly, Weekly, Daily options)
    - **Summary**: "Monthly, starting on December 15, 2023"
    - **Set schedule** CTA button (bright blue)
  - **Purpose**: Showcase automation features, build anticipation for activated account

- **FR44 (Cards Management)**:
  - **UI** (frontend mockup):
    - **Online shopping card**: Pink card with "Submit missing information" status badge (Single-use)
    - **Virtual card**: Black card with "Submit missing information" error indicator
    - **Find ATMs nearby**: Map icon button with chevron
    - **Reactivate terminated card**: Link at bottom
    - **Add new** button for requesting additional cards
  - **Status-based UX**: Cards show error states for PENDING/LIMITED_ACCESS, unlock with FULL_ACCESS

- **FR45 (Gating Logic \u0026 Account Status)**:
  - **PENDING** (KYC submitted, awaiting validation):
    - All banking features show "locked" state with "⏳ Your account is being validated" message
    - Users can browse Plans, see feature descriptions, but cannot interact
  - **LIMITED_ACCESS** (Account active but NIU missing or declarative):
    - **Unlocked**: Cash-In (receive money), View balance, Account settings
    - **Locked** (gray + padlock icon): Virements sortants, Épargne, Trading, Crédit, Cards
    - **Warning banner**: "⚠️ Complétez votre NIU pour débloquer toutes les fonctionnalités"
  - **FULL_ACCESS** (Complete KYC + NIU validated):
    - All UI elements unlocked (still frontend demos, no backend implementation)
  - **DISABLED** (Account suspended):
    - Login blocked with message: "Votre compte a été désactivé. Contactez votre agence."

- **FR46 (Notification Strategy)**: SMS is used strictly for OTP; all status updates (validation complete, account activated, features unlocked, KYC rejection) use **Push Notifications** (zero marginal cost).

- **FR47 (Purpose of Frontend Demos)**: These interfaces serve three strategic goals:
  1. **Educate users** on BICEC's digital banking value proposition during KYC delays
  2. **Reduce abandonment** by showing "what's coming" even when account is PENDING
  3. **Test UI/UX** for future backend integration without blocking MVP delivery

## 10. Non-Functional Requirements

### ⚡ Performance (Snappy AI Standards)
- **NFR1 (Inference Latency)**: Total AI processing must be **<15 seconds** (Target: OCR <5s, Liveness <10s) on the 12GB i3 benchmark node.
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

### 📊 Data & BI Infrastructure
> [!IMPORTANT]
> **Critical for Thesis Evaluation**: The following requirements establish the Data/BI foundation necessary for performance validation, fraud detection,  and regulatory compliance. These components are evaluated as core thesis deliverables.

- **NFR11 (OCR Training Dataset)**:
  - **Requirement**: Curated dataset of **500-1000 Cameroonian CNI images** (mix of old plastified and new 2024 biometric versions) for PaddleOCR fine-tuning and validation
  - **Composition**:
    - **60% Training**: Labeled ground truth (manual OCR verification of all fields: Nom, Prénom, Date Naissance, Numéro CNI, Date Délivrance, Lieu)
    - **20% Validation**: Held-out set for hyperparameter tuning and threshold calibration
    - **20% Test**: Unseen data for final accuracy metrics (target >90% field-level extraction accuracy)
  - **Acquisition Strategy**:
    - **Crowdsourcing interne BICEC**: Voluntary employee participation with anonymization (blur faces, mask personal data)
    - **Partnership agences**: Existing client consent for research use
    - **Synthetic generation**: If needed to augment edge cases (worn documents, poor lighting) using data augmentation techniques
  - **Storage**: Encrypted repository with version control, SHA-256 integrity hashes
  - **Challenge**: **No dataset currently exists**; must be built from scratch alongside MVP development

- **NFR12 (Biometric Test Sets)**:
  - **Liveness Detection Dataset**: 100-200 video samples including:
    - **Genuine liveness**: 70% real user compliance scenarios (good lighting, proper framing, cooperative subjects)
    - **Spoofing attacks**: 30% presenting photos, screens, masks, printed faces to calibrate anti-spoofing thresholds
  - **Face Matching Pairs**: 300-500 CNI photo ↔ selfie pairs for calibration:
    - **Positive pairs** (same person): 60% to tune acceptance threshold
    - **Negative pairs** (different persons): 40% to minimize False Acceptance Rate (target <2% FAR)
  - **Challenge**: **No baseline biometric data exists**; collection must respect Loi 2024-017 consent requirements

- **NFR13 (Analytics Infrastructure)**:
  - **Real-Time Funnel Tracking**: Database schema and event logging for:
    - **Conversion metrics**: Per-step drop-off rates (Inscription → CNI → NIU → Liveness → Signature → Validation → Activation)
    - **Session duration**: Time-to-completion histograms, bottleneck identification
    - **Error frequency**: Liveness failures by time-of-day/lighting conditions, OCR extraction confidence distributions
  - **Data Warehouse Structure**:
    - **Dimensional model**: User sessions (fact), Documents (dimension), Validation actions (fact), Agents (dimension)
    - **Storage**: PostgreSQL with indexed time-series for Grafana dashboards
  - **Exports**: CSV/JSON dumps for offline analysis, COBAC audit trail generation
  - **Dashboards**: Pre-configured Grafana views for:
    - **Operational**: Red/Yellow/Green service health, queue depths, SLA violations
    - **Business**: Daily/weekly onboarding trends, CAC reduction tracking, Plan selection distribution
    - **Compliance**: Audit log completeness, document retention status, access control violations

- **NFR14 (Data Governance & Compliance)**:
  - **Minimization**: Only collect data strictly necessary for KYC, plan personalization, and fraud prevention (Loi 2024-017 principles)
  - **Retention**: 10-year encrypted storage for KYC documents (COBAC requirement), 3-year analytics retention
  - **Access Control**: Role-based access logs for all dataset queries, agent dashboard views, and document retrievals
  - **Anonymization Protocols**: Before any dataset sharing for model training, automatic PII redaction (face blur, name masking, NIU truncation)

### 📊 Scalability & Accessibility
- **NFR11 (Concurrent Pilot)**: The MVP node must support **5 concurrent active onboarding sessions** without CPU/RAM throttling.
- **NFR12 (Language & Literacy)**: The interface must support **French and English** with regional terminology (NIU, ENEO) and vibrant illustrated guidance for lower digital literacy.
