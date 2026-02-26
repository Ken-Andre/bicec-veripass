# Information Architecture — BICEC VeriPass

**Version:** 1.0  
**Date:** 2026-02-26  
**Auteur:** Ken (UX Designer)

---

## Vue d'ensemble

L'architecture d'information de BICEC VeriPass est organisée en 3 produits distincts avec des hiérarchies spécifiques:

1. **Application Mobile** (Marie) - Onboarding KYC + Banking Discovery
2. **Back-Office Agents** (Jean/Thomas) - Validation + Compliance
3. **Command Center** (Sylvie) - Management Dashboard

---

## 1. Application Mobile (Flutter)

### Structure Hiérarchique

```
BICEC VeriPass Mobile
│
├── 📱 Module A: Secure Entry & Context
│   ├── A01 Splash & Language
│   ├── A02 Welcome Value Prop
│   ├── A03 Phone Entry
│   ├── A04 OTP Verify (Phone)
│   ├── A05 Email Entry
│   ├── A06 Email Verification
│   ├── A07 PIN Setup
│   ├── A08 Biometric Opt-in
│   ├── A09 What You Need
│   └── A10 Progress Timeline
│
├── 🆔 Module B: Identity & Liveness
│   ├── B01 CNI Intro
│   ├── B02 CNI Recto Guidance
│   ├── B03 CNI Recto Capture
│   ├── B04 Capture Success
│   ├── B05 CNI Verso Guidance
│   ├── B06 CNI Verso Capture
│   ├── B07 OCR Processing
│   ├── B08 OCR Review & Edit
│   ├── B09 Liveness Intro
│   ├── B10 Liveness Challenge
│   ├── B10_Fail Lockout & Fresh Start
│   └── B11 Liveness Success
│
├── 📍 Module C: Localization & Fiscal Identity
│   ├── C01 Address Cascade
│   ├── C02 GPS Button (Optional)
│   ├── C03 Utility Proof Intro
│   ├── C04 Utility Capture
│   ├── C05 NIU Choice
│   └── C06 NIU Entry/Upload
│
├── ⚖️ Module D: Consent & Signatures
│   ├── D01 Consent (3 Checkboxes)
│   └── D02 Digital Capture
│
├── 🎉 Module E: Submission & Discovery
│   ├── E01 Review Summary
│   ├── E02 Secure Upload
│   ├── E03 Success Celebration
│   ├── E04 Plan Discovery
│   ├── E05 Personalization
│   ├── E06 RESTRICTED_ACCESS Dashboard
│   └── E07 Rejection Notification
│
├── 🏦 Module F: Account Management Dashboard
│   ├── F00 Push Notification - Invitation Agence
│   ├── F01_AGENCY Physical Agency Visit
│   ├── F02 Home Dashboard - FULL_ACCESS
│   ├── F03 Home Dashboard - LIMITED_ACCESS
│   ├── F04 Account Detail
│   ├── F05 Cards Manager
│   └── F06 Linked Accounts
│
└── 🎯 Module G: Feature Shells (Service Education)
    ├── G01 Recurring Transfers
    ├── G02 Add Money Flow
    └── G03 Withdraw Flow
```

### Navigation Patterns

#### Onboarding Flow (Linear)
```
A01 → A02 → A03 → A04 → A05 → A06 → A07 → A08 → A09 → A10
  → B01 → ... → B11
  → C01 → ... → C06
  → D01 → D02
  → E01 → E02 → E03 → E04 → E05 → E06
```

#### Post-Activation (Tab-Based)
```
Bottom Navigation:
├── Home (F02/F03)
├── Invest (G-series)
├── Transfers (G01)
├── Crypto (G-series)
└── Lifestyle (G-series)
```

---

## 2. Back-Office Agents (Web Portal)

### Structure Hiérarchique

```
BICEC VeriPass Back-Office
│
├── 👤 Jean (Agent KYC)
│   ├── J01 Login - Email/Password
│   ├── J02 Validation Queue Dashboard
│   ├── J03 Queue Filters
│   │   ├── By Priority
│   │   ├── By FIFO
│   │   └── By Confidence
│   ├── J04 Dossier Detail View
│   ├── J05 Side-by-Side Evidence Viewer
│   │   ├── CNI Recto/Verso High-Res
│   │   ├── Selfie vs CNI Photo Comparison
│   │   ├── Utility Bill Review
│   │   └── Wet Signature Verification (Agency Only)
│   ├── J06 OCR Data Review
│   ├── J07 Manual Edit with Justification
│   ├── J08 Decision Panel
│   │   ├── Approve
│   │   ├── Reject (with reason)
│   │   └── Request Info
│   └── J09 Audit Log View
│
├── 🛡️ Thomas (AML/CFT National Supervisor)
│   ├── T01 Login - Email/Password
│   ├── T02 National Supervisor Dashboard
│   ├── T03 AML Screening Queue
│   │   ├── PEP Alerts
│   │   ├── Sanctions Alerts
│   │   └── Watchlist Alerts
│   ├── T04 Screening Detail
│   │   ├── Profile vs PEP/Sanction Hit
│   │   ├── Match Score %
│   │   └── Actions (Clear/Confirm/Escalate)
│   ├── T05 Conflict Resolver (Déduplication)
│   │   ├── Side-by-Side Profile Comparison
│   │   ├── Similarity Heatmap
│   │   └── Actions (Merge/Reject/Escalate)
│   ├── T06 Agency Administration
│   │   └── CRUD Table (Code, Name, City, Status, Agent Count)
│   ├── T07 Amplitude Batch Monitor
│   │   ├── Timeline View
│   │   ├── Per-Dossier Status (✓/⚠/✗)
│   │   └── Retry Failed Items
│   └── T08 National Metrics
│
└── 📊 Sylvie (Manager)
    ├── S01 Login - Email/Password
    ├── S02 Command Center Dashboard
    ├── S03 Big Numbers View
    │   ├── Avg Validation Time (SLA)
    │   ├── Success Rate (FTR)
    │   ├── Active Agents Count
    │   └── Queue Depth
    ├── S04 Funnel Graph
    │   └── Drop-off by Module (A-E)
    ├── S05 System Health (R/Y/G)
    │   ├── AI Services Status (OCR/Liveness)
    │   └── API Latency
    ├── S06 Agent Performance
    │   ├── Jean's Metrics
    │   └── Thomas's Metrics
    ├── S07 Load Balancing View
    │   └── Agent Capacity (Green/Yellow/Red)
    └── S08 Audit Trail & Compliance Export
```

### Navigation Patterns

#### Jean's Workflow
```
J02 (Queue) → J04 (Detail) → J05 (Evidence) → J06 (OCR) → J08 (Decision) → J02 (Return)
```

#### Thomas's Workflow
```
T02 (Dashboard) → [T03 AML | T05 Dedup | T06 Agency | T07 Batch] → T02 (Return)
```

#### Sylvie's Workflow
```
S02 (Dashboard) → [S03 Numbers | S04 Funnel | S05 Health | S06 Performance | S07 Load] → S02 (Return)
```

---

## 3. Grafana Dashboards (Phase 2)

### Structure Hiérarchique

```
Grafana Monitoring (Phase 2)
│
├── 📈 Business Observability
│   ├── North Star Metrics (ID 24368)
│   │   ├── Conversion Funnel
│   │   ├── User Engagement
│   │   └── Retention Rates
│   └── Funnel Analysis
│       ├── Drop-off by Step
│       └── Time-to-Complete
│
├── 🔧 Technical Performance
│   ├── App Metrics - Web Monitoring (ID 15840)
│   │   ├── Error Rates
│   │   ├── Latency
│   │   └── Uptime
│   └── RED Method Dashboards
│       ├── Request Rates
│       ├── Error Rates
│       └── Duration
│
└── 🏦 Banking KYC Specific
    ├── KYC Success Rate
    ├── Time-to-Onboard
    ├── API Latency & Errors
    └── Agent Performance Metrics
```

---

## Principes d'Organisation

### 1. Hiérarchie par Rôle
- **Mobile**: Parcours linéaire (onboarding) → Navigation tabulaire (post-activation)
- **Back-Office**: Dashboards spécialisés par rôle (Jean/Thomas/Sylvie)
- **Grafana**: Vues techniques et business séparées

### 2. Profondeur Maximale
- **Mobile**: 3 niveaux (Module → Screen → Modal)
- **Back-Office**: 2 niveaux (Dashboard → Detail View)
- **Grafana**: 2 niveaux (Category → Dashboard)

### 3. Conventions de Nommage
- **Modules**: Lettre + Numéro (A01, B02, etc.)
- **Écrans**: Nom descriptif en anglais
- **Actions**: Verbes d'action (Approve, Reject, Clear, etc.)

### 4. Points de Sortie
- **Mobile**: Logout, Session Timeout, 3-Strike Lockout
- **Back-Office**: Logout, Session Timeout
- **Grafana**: N/A (read-only dashboards)

---

## Références

- **PRD**: `_bmad-output/planning-artifacts/prd.md`
- **UX Spec v2**: `_bmad-output/planning-artifacts/ux-design-specification-v2.md`
- **Prototype**: `docs/test_tmp_trash/onboarding-system-design-wireframe/`
- **Fonctionnalités**: `docs/Fonctionnalité_Interaction_Erreurs.md`
