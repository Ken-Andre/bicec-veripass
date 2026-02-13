# Adversarial Review Findings: bicec-veripass BMAD Planning Work

**Review Date:** 2026-02-12  
**Reviewer:** Antigravity (Multi-Agent Hat Review)  
**Review Methodology:** review-adversarial-general (Cynical, Zero-Tolerance, Evidence-First)  
**Overall Assessment:** 🔴 NOT READY FOR IMPLEMENTATION

---

## Executive Summary

The bicec-veripass planning phase shows ambition and vision but suffers from critical execution gaps, missing fundamental artifacts, and dangerous inconsistencies that would absolutely torpedo implementation. This review adopts an adversarial stance, wearing the hats of PM, Architect, UX Designer, QA, and Developer to identify problems that MUST be fixed before proceeding to implementation.

**Critical Blockers Found:** 27+ issues across strategic, architectural, design, and operational domains.

---

## 🚨 Critical Blockers (Tier 1)

### 1. Missing Architecture Documentation
**Severity:** 🔴 CRITICAL | **Agent Hat:** Architect

**Finding:** There is ZERO architectural documentation in the _bmad-output directory. No architecture.md, no system design, no component diagrams, no data flow, no deployment architecture, no security architecture, nothing.

**Impact:**
- Developers have no blueprint for how the Mobile App, Backend API, Back-Office Portal, AI Services, and Mock Integrations should be structured
- No clarity on Docker Compose orchestration despite mentioning it 15+ times in the PRD
- No database schema design despite mentioning PostgreSQL, SQLite/Hive
- No API contract specifications despite claiming "API Contract Freeze" (FR32, ADR in PRD)
- No security architecture despite AES-256 encryption requirements (NFR5)

**Evidence from PRD conflicts:**
- PRD Section 7 (Mobile App) mentions "Monolithic Docker-Compose deployment" but provides zero architectural context
- Implementation Plan mentions "Core Banking (Iwomi Core)" but never explains the integration architecture
- UX Spec references back-office "side-by-side" views but no architectural support for image storage/retrieval

**What's Missing:**
- [ ] System architecture diagram (C4 Model Level 1-3)
- [ ] Component interaction diagrams
- [ ] Data flow diagrams (Marie's journey → Storage → Jean's validation)
- [ ] Database schemas (PostgreSQL for back-office, SQLite for mobile)
- [ ] API contract specifications (FastAPI endpoints)
- [ ] Docker Compose service definitions
- [ ] Security architecture (encryption at rest/in transit)
- [ ] Integration architecture (Mocks for DGI, BEAC, Amplitude)

> **User Context (Ken):** *L'architecture doit être faite par l'architecte du projet. Pour le moment, les agents ont utilisé mon document d'ébauche qui les a "empoisonnés" avec des informations non validées.*

---

### 2. Missing Epics & Stories
**Severity:** 🔴 CRITICAL | **Agent Hat:** PM / Scrum Master

**Finding:** Zero epics, zero user stories, zero acceptance criteria found in the entire _bmad-output directory.

**Impact:**
- The PRD contains 41 Functional Requirements (FR1-FR41) and 12 NFRs, yet none have been decomposed into implementable stories
- No backlog, no sprint planning possible
- No clear handoff to developers
- No acceptance criteria for testing/validation

> **BMAD Compliance Violation:** The BMAD methodology explicitly requires /create-epics-and-stories workflow to run AFTER architecture and BEFORE implementation.

---

### 3. Zero Implementation Artifacts
**Severity:** 🔴 CRITICAL | **Agent Hat:** Dev

**Finding:** The _bmad-output/implementation-artifacts directory is completely empty. Not a single line of code, not a single test, not a single Dockerfile.

**What Should Exist:**
- At minimum, a scaffolded project structure (if BMAD planning claims to be "complete")
- Proof-of-concept for the AI stack on the hardware constraint
- Docker Compose orchestration files
- Basic Flutter mobile shell
- FastAPI project skeleton with mock endpoints

> **User Context (Ken):** *Le développement ne sera pas le focus de mes évaluateurs de soutenance - je suis en data/AI. Mais pour la démo, j'aurai besoin de mocks fonctionnels pour simuler les APIs institutionnels.*

---

### 4. UX Mockups: Referenced But Missing
**Severity:** 🔴 CRITICAL | **Agent Hat:** UX Designer

**Finding:** The UX Design Specification references TWO mockup images at the end (Section 12):
- `_bmad-output/planning-artifacts/cni_capture_mockup.png`
- `_bmad-output/planning-artifacts/pending_dashboard_mockup.png`

These files DO NOT EXIST.

**User Decision:** Instead of continuing with Sally's incomplete work, Ken will use **Google Stitch** (stitch.withgoogle.com) to generate all UI designs following proper documentation, then use the MCP of Stitch to generate prompts for consistent design.

> **User Context (Ken):** *Sally n'a pas créé les images qu'elle mentionne - ce sont des faux liens. Je vais reprendre le design UI avec Stitch de Google pour avoir des vrais mockups de qualité.*

---

### 5. Inconsistent "11-Minute" vs "15-Minute" Claims
**Severity:** 🟡 HIGH | **Agent Hat:** PM

**Finding:** The project makes contradictory claims about the core metric:

| Document | Claim |
|----------|-------|
| PRD Section 2 | "slash BICEC's account opening time from 14 days to 11 minutes" |
| Product Brief (User Journey) | "Benchmark journey assuming stable 3G and documents ready. Reality Buffer: 15 minutes. Total: 11:00 minutes" |
| Product Brief (Success Metrics) | "Onboarding Speed: Average time <15 minutes (Benchmark: 11 mins)" |

**User Decision:** Accept second recommendation - **15 minute breakthrough, 11 minutes stretch goal**. Need all document owners to align on this.

---

### 6. 3-Strike Liveness Lockout: Divergent Policies
**Severity:** 🟡 HIGH | **Agent Hat:** Security Architect + UX Designer

**Finding:** Three different documents describe the 3-strike liveness failure policy with conflicting outcomes:

| Document | Policy |
|----------|--------|
| PRD FR7 | "After 3 failed liveness/biometric checks, the session locks, and the user is redirected to go to a physical branch or fresh start." |
| Product Brief ADR-001 | "On the 3rd consecutive liveness failure, the session is locked and the local cache is securely purged. User path: [A] New Session or [B] Visit Branch" |
| Implementation Plan (Section 2) | "3 Liveness failures = Auto-wipe session data & redirect to Agency visit." |

**User-Defined Correct Flow:**
> *"Désolé pour la gêne, mais pour <x,y> raisons, nous sommes obligés de terminer cette session. Ne vous inquiétez pas, vous avez toujours la possibilité néanmoins d'aller dans une agence locale proche de chez vous, ou de recommencer dès le début. Cliquez juste en dessous si vous voulez dans ce cas recommencer [le bouton 'Fresh Start']"*

> **Assignment:** PM needs to correct this in their document, then UX will update the wireframe accordingly.

---

## 🟡 Major Design Flaws (Tier 2)

### 7. NIU Manual Entry: "LIMITED_ACCESS" Status Not Defined
**Severity:** 🟡 HIGH | **Agent Hat:** Product Manager + Dev

**Finding:** The PRD (FR14-FR16) introduces a "LIMITED_ACCESS" account status but:
- No definition of allowed/blocked banking features
- No difference from "PENDING_KYC" or "FULL_ACCESS"
- No Amplitude integration provisioning logic
- UX Spec doesn't mention LIMITED_ACCESS - only "Pending" vs "Full/Validated"

> **Assignment:** Product Manager to define and document.

---

### 8. "Wet Signature" 3x Capture: Absurd UX, Zero Rationale
**Severity:** 🟡 HIGH | **Agent Hat:** UX Designer + Compliance

**Finding:** The PRD (FR19) mandates 3 wet signatures on paper, which:
- Destroys the "11-minute digital breakthrough" promise
- Contradicts digital signature (FR18) purpose
- No COBAC regulatory citation provided

**User Decision:** Accept Option 3 - Move wet signature to post-account-activation (mailed to user's address, returned by post).

> **User Context (Ken):** *La version numérique a été notre idée, mais ne sachant pas si la BEAC l'apprécierait avec leurs règles encore un peu archaïques, ils préfèrent quand tu signes. On le fera après par mail.*

---

### 9. "Shadow IBU" / Mock BEAC Strategy: Regulatory Disaster
**Severity:** 🟡 HIGH | **Agent Hat:** Compliance Officer + Architect

**Finding:** The Implementation Plan proposes "Shadow IBU" for MVP which:
- Fakes BEAC-issued legally binding identifiers
- Creates regulatory compliance nightmare for COBAC audit
- Confuses real accounts vs test accounts

**User Clarification:**
> *Ces comptes seront comme des réels mais pour tester tout le prototype et les parcours UX. Ça reste qu'il n'y aura toujours pas pour le déploiement, c'est juste dans ma machine où il y aura tout le conteneur Docker et ses services. Pour la démo, j'aurais besoin de simuler les vrais étant donné qu'en tant que stagiaire on ne me donnera pas accès aux vrais.*

**User Request:** Better wording needed to clarify this is for testing/demo purposes only, not actual banking.

---

### 10. 16GB RAM Constraint: No Performance Validation Proof
**Severity:** 🟡 HIGH | **Agent Hat:** Performance Engineer

**Finding:** The PRD obsesses over "Universal 16GB Node Strategy" but:
- ZERO proof that AI stack (PaddleOCR + DeepFace + MiniFASNet) can run concurrently
- NFR11 requires 5 concurrent sessions without throttling
- No benchmark tests documented

---

### 11. Address Cascade + Map Pin: Redundant and Contradictory
**Severity:** 🟡 MEDIUM | **Agent Hat:** UX Designer + Product Manager

**Finding:** The PRD mandates TWO separate address input mechanisms:
- FR9: Address Cascade (Ville → Commune → Quartier → Lieu-dit)
- FR10 + FR11: Map Pin (OpenStreetMap GPS coordinates)

**User Decision - Simplified GPS Strategy:**

> *On remplace la map OSM obligatoire par:*
> - *Un simple bouton "Utiliser ma position actuelle (optionnel)" qui lit GPS natif et enregistre lat/lon en metadata*
> - *Les coords GPS servent à des use cases futurs (livraison, scoring géographique)*
> - *Un check de cohérence soft (flag si distance > X km entre GPS et quartier sélectionné)*
> - *L'adresse cascade reste la vérité réglementaire pour KYC*

**In Case of Major Divergence:** Flag only, no blocking. Address cascade is regulatory truth.

---

### 12. Utility Bill Coherence Check (FR13): Technically Impossible
**Severity:** 🟡 MEDIUM | **Agent Hat:** AI Engineer

**Finding:** FR13 requires automated validation between bill address and declared address, but:
- OCR on Cameroonian utility bills (ENEO/CAMWATER) is unreliable
- No address matching engine exists
- 1 minute allocated is insufficient

**User Decision:** Simplify FR13 - system validates that utility bill is a valid image and flags for manual review by Jean. Move coherence check to Jean's Validation Desk.

**Evidence Provided:** User shared real ENEO bill OCR examples showing format complexity and field extraction challenges.

---

### 13. Back-Office Portal: Contradiction on Technology Stack
**Severity:** 🟡 MEDIUM | **Agent Hat:** Tech Lead

**Finding:** 
- PRD Section 7: "Back-Office Portal (Web/React)"
- Implementation Plan mentions "fl_chart" (Flutter charting library)

**Resolution Needed:** Add ADR-TECH-001 to clarify technology choice.

---

### 14. Grafana Dashboard: Never Explained or Architected
**Severity:** 🟡 MEDIUM | **Agent Hat:** DevOps Engineer

**Finding:** Grafana is mentioned 4 times but:
- No architectural detail on integration
- No data source specified (PostgreSQL? Prometheus?)
- No metrics schema defined

---

### 15. Push Notifications: Critical Dependency, Zero Implementation Plan
**Severity:** 🟡 MEDIUM | **Agent Hat:** Mobile Engineer

**Finding:** FR41 mandates push notifications for status updates but:
- No FCM/APNS infrastructure planning
- No fallback strategy if user denies permissions
- No notification payload definition

---

## 🟠 Moderate Issues (Tier 3)

### 16-27. Additional Findings Summary

| # | Issue | Category |
|---|-------|----------|
| 16 | COBAC Regulation Citations: Zero Primary Sources | Compliance |
| 17 | Research Reports Referenced But Not Reviewed | Context |
| 18 | Product Brief vs PRD: Different Authors, Same Project | Process |
| 19 | No Test Artifacts | QA |
| 20 | "Revolut-Styled" Design: Inspiration Not Adaptation | UX |
| 21 | Screen Inventory: 20+ Screens, Zero Navigation Diagram | UX |
| 22 | Accessibility (WCAG AA): Claimed But Not Validated | UX |
| 23 | Copywriting Strategy: French Only, English Ignored | Localization |
| 24 | Data Encryption (AES-256): No Key Management Strategy | Security |
| 25 | Docker Pruning (NFR9): Operational Nightmare | DevOps |
| 26 | Amplitude Integration: "Iwomi Core" Undefined | Integration |
| 27 | "Compliance Metadata" For GPS: Legal Basis Unclear | Privacy |

---

## 📊 Summary of Findings by Severity

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 CRITICAL BLOCKERS | 6 | Missing Architecture, Missing Epics/Stories, Zero Implementation Code, Missing UX Mockups, Inconsistent Journey Times, Liveness Lockout Policy Conflicts |
| 🟡 HIGH | 9 | NIU Limited Access Undefined, Wet Signature UX Disaster, Shadow IBU Regulatory Risk, RAM Constraint Unvalidated, Address Input Redundancy, Utility Bill OCR Impossibility, Tech Stack Confusion, Grafana Undesigned, Push Notifications Unplanned |
| 🟠 MEDIUM | 12 | Missing Regulatory Citations, Unreviewed Research Reports, Duplicate Brief/PRD, No Test Artifacts, Revolut Inspiration Not Adapted, Missing Navigation Diagram, WCAG AA Unvalidated, English Localization Missing, No Key Management, Docker Pruning Danger, Iwomi Core Undefined, GPS Compliance Unclear |

**Total Issues Found: 27**

---

## 🎯 Path Forward

### Immediate Actions Required

| Action | Owner | Status |
|--------|-------|--------|
| Create Architecture Documentation | Architect | ⏳ Pending |
| Align 11/15-minute claims | Product Manager | ⏳ Pending |
| Fix 3-Strike Liveness Lockout policy | Product Manager | ⏳ Pending |
| Define LIMITED_ACCESS account status | Product Manager | ⏳ Pending |
| Simplify Wet Signature (Option 3) | Product Manager | ⏳ Pending |
| Simplify GPS strategy | Product Manager | ⏳ Pending |
| Simplify Utility Bill validation | Product Manager | ⏳ Pending |
| Clarify Shadow IBU wording for demo | Product Manager | ⏳ Pending |
| Create UX Mockups with Google Stitch | UX Designer | ⏳ Pending |

### User Context Summary

**Who is Ken?**
- Final year CS student (5th year engineering)
- Specialization: Data Science, LLM Engineering, AI
- Internship at Bicec - assigned this project verbally by supervisor
- **3 months remaining** (February not counting)
- **Primary focus:** Data/AI components (this is what thesis evaluators will assess)
- **MVP Goal:** Functional demo with mock APIs that IT team can correct post-internship

**Why documents are incomplete:**
1. Sally (UX Designer) produced incomplete/inconsistent work
2. Agents were "poisoned" by Ken's initial draft document
3. Focus on preventing propagation of errors before it went further
4. Limited time - decided to stop at step 4 of 10 in BMAD core process

**Technology Decisions Not Yet Validated:**
- User noted confusion about technical terms and technologies used
- Need comparative study and justification for choices
- This should be done by the architect role

---

## 📁 Related Documents

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/product-brief-bicec-veripass-2026-02-07.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/implementation-plan.md`
- `_bmad-output/planning-artifacts/research/technical-Bicec-Veripass-research-2026-02-03.md`
- `_bmad-output/planning-artifacts/research/research_report_kyc_bicec.md`

---

*Document generated from Adversarial Review on 2026-02-12*  
*To be updated after corrections are applied by respective document owners*
