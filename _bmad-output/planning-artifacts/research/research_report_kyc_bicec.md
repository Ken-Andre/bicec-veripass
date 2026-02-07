# Deep Research Report: KYC Digital Biometric Platform (BICEC Cameroon)

## 1. Regulatory Deep Dive

### 🏦 BEAC & COBAC Compliance
The regulatory framework for digital onboarding in the CEMAC zone is mature:
- **Regulation 04/18/CEMAC**: Provides the general framework for payment services.
- **COBAC R-2019/01 & R-2019/02**: Specifics on licensing and prudential norms.
- **COBAC Compliance**: High-resolution original images/videos must be kept (AES-256) for 10 years. Mathematical embeddings alone are insufficient for audit.
- **IBU (BEAC)**: ISO 20022 structure (20-22 chars). MVP uses Shadow IBU with Modulo 97 key.

### 🔐 Data Protection (Law 2024-017)
Promulgated on December 23, 2024, this law is the "Cameroonian GDPR":
- **Full Enforceability**: June 23, 2026.
- **Core Principles**: Explicit consent, data minimization, right to access/rectification, and mandatory DPO for large entities.
- **Biometric Data**: Classed as "Sensitive Data," requiring higher security (encryption, access logs).

### 🧾 NIU (Tax Identification Number)
- **Mandatory**: Required for all bank account openings since 2020.
- **DGI Verification**: No public REST API for real-time validation is currently exposed to third parties, but a web-based "eRegistration" portal exists.
- **Strategy for MVP**: Implement a regex-based format check + key-digit validation + mandatory visual check.
- **Règle d'Activation**: **AUCUNE activation automatique**. Un agent (Jean) doit valider les originaux avant toute création de compte par les opérations (Thomas).

## 2. Competitor Analysis

| Competitor | Digital Strategy | KYC Approach |
|------------|------------------|--------------|
| **Afriland First Bank** | Advanced (Sara App) | Hybrid onboarding, strong focus on PMEs. |
| **Ecobank** | Mobile-First | Pan-African platform with mature eKYC. |
| **MTN Mobile Money** | Fully Digital | Simplified registration, moving towards banking-grade KYC post-licensing. |
| **Orange Money** | Fully Digital | High penetration, basic KYC evolving. |

**Observation**: Most traditional banks still require a physical visit or a "hybrid" approach. BICEC can differentiate by being **100% remote** while maintaining higher trust scores than Mobile Money providers.

## 3. Technical Feasibility (Open Source)

### 📸 OCR (PaddleOCR)
- **Selection**: PaddleOCR (PP-OCRv4) outperforms Tesseract for ID documents.
- **Optimism**: With proper preprocessing (deskewing, binarization), high accuracy (90%+) is achievable on Cameroonian CNIs.
- **Constraint**: Best run on the server side (Python/FastAPI) to handle complexity without bloat on the mobile app.

### 👤 Biometrics (DeepFace + MiniFASNet)
- **Combination**: `DeepFace` for face matching (embeddings) and `MiniFASNetV2` for silent/active liveness detection.
- **Diversity**: Addressing African skin tones requires a diverse dataset. The **CASIA-SURF CeFA** dataset includes African populations and is suitable for fine-tuning anti-spoofing models.

## 4. Data/BI Strategy (Specialist Perspective)

As a Data/BI specialist, your project's value lies in the **Data Pipeline**:
- **Funnel Analysis**: Tracking conversion from "App Download" -> "CNI Capture" -> "Liveness" -> "Validation".
- **Friction Detection**: Measuring time spent on each step to optimize the UI.
- **Quality Metrics**: Tracking OCR confidence vs. human correction rates to fine-tune the backend model.
- **DWH Schema**: A clean STAR schema (in PostgreSQL) to report on onboarding performance and fraud attempts.

## 6. Resilience & Success
- **Connectivity**: Local encrypted cache on Flutter app for auto-resume upload.
- **Geography**: Native GPS validation against Facture address.
- **Targets**: <15 min completion, >95% conformity, >99.9% uptime.
