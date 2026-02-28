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

**Observation**: Most traditional banks still require a physical visit or a "hybrid" approach. Based on the current target flow, BICEC is **primarily remote but hybrid**: **11 of 12 mandatory customer steps are remote (~91.7%)**, with one mandatory in-branch step (wet signature/final activation), while still aiming for higher trust scores than Mobile Money providers.

## 3. Technical Feasibility (Sovereign OCR & Biometrics)

### 📸 OCR Strategy: Hybrid Pipeline (PaddleOCR + GLM-OCR)
To balance real-time mobile response and high-precision back-office parsing, a two-tier hybrid approach is implemented.

- **Tier 1 – Low-Latency Capture (PaddleOCR PP-OCRv4)**:
  - **Focus**: Immediate extraction of Cameroonian CNI fields (Name, ID#, Expiry).
  - **Optimization**: Deployed via **ONNX Runtime** to leverage local CPU/NPU resources for sub-second feedback during the mobile capture flow.

- **Tier 2 – Multimodal Document Reasoning (GLM-OCR 0.9B)**:
  - **Focus**: Complex documents (Utility bills, tax sheets, registration forms).
  - **Innovation**: Uses **CogViT visual encoder** and **Multi-Token Prediction (MTP)** to go beyond character recognition. It preserves **layout semantics** (headings, nested tables) and converts them directly to **JSON/Markdown**.
  - **Performance**: State-of-the-art results on **OmniDocBench V1.5 (~94.62 score)**. Supports a **PRECISION_MODE** for high-stakes financial data reaching 99.9% accuracy.
  - **Hardware Synergy**: While the stack resides on an i3, GLM-OCR is offloaded to the **NPU-enabled node** available in the environment, ensuring throughput of ~1.86 pages/sec without saturating the primary API worker RAM.

### 👤 Biometrics (DeepFace + MiniFASNet)
- **Matching**: `DeepFace` for high-dimensional facial embeddings.
- **Liveness**: `MiniFASNetV2` for silent anti-spoofing, ensuring "live" presence without complex user challenges.
- **Equity**: Calibrated using the **CASIA-SURF CeFA** dataset to ensure high precision across African skin tones, which is suitable for fine-tuning anti-spoofing models.

## 4. Data/BI Strategy (Specialist Perspective)

As a Data/BI specialist, the project's value lies in the **Data Pipeline**:
- **Funnel Analysis**: Tracking conversion from "App Download" -> "CNI Capture" -> "Liveness" -> "Validation".
- **Friction Detection**: Measuring time spent on each step to optimize the UI.
- **Quality Metrics**: Monitoring OCR confidence levels (Paddle vs. GLM) against human correction rates to fine-tune extraction thresholds.
- **DWH Schema**: Clean STAR schema in PostgreSQL to report on onboarding performance, compliance auditing and fraud detection.

## 5. Resilience & Success
- **Connectivity**: Local encrypted cache on Flutter app for auto-resume during network drops ("Délestage" management).
- **Geography**: Native GPS validation against the utility bill address.
- **Targets**: <15 min completion, >95% data conformity, >99.9% uptime.
