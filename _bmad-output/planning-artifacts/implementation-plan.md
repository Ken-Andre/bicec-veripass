# KYC Digital Onboarding Platform - BICEC Cameroon

## Goal
Develop a mobile-first KYC onboarding solution for BICEC Cameroon, using 100% open-source tools, focusing on regulatory compliance (BEAC/COBAC, Cameroon Law 2024-017) and robust Data/BI analytics.

## Proposed Changes

### 1. Mobile Application (Flutter)
The mobile app will handle the user journey, document capture, and local passive liveness.

- **[NEW] UI/UX**: BICEC themed components using standard Material/Cupertino with custom styling.
- **[NEW] Capture Module**: Custom camera overlay for CNI (recto/verso) and NIU Attestation.
- **[NEW] Local AI & Resilience**: Integration of `tflite_flutter` for document edge detection. Implementation of **Local Encrypted Cache** for document storage during upload interruptions (auto-resume).
- **[NEW] Geolocation**: Native GPS capture with consistency validation against Facture address.
- **[NEW] Security**: 3 Liveness failures = Auto-wipe session data after user clicks "Recommencer" button.

### 2. Backend Services (Python/FastAPI)
Heavy processing will be centralized on the server to handle the AMD CPU/NPU constraints effectively.

- **[NEW] Core Banking (Sopra Amplitude)**: Integration with Sopra Banking Amplitude for account provisioning. Sopra handles IBU generation automatically as part of the core banking flow.
- **[NEW] DGI Tax Mock**: Realistic API simulating tax number validation for MVP demonstration purposes. Will be replaced with real DGI API in production.
- **[NEW] OCR Engine**: `PaddleOCR` (PP-OCRv4) optimized for Cameroonian ID cards with high-res original storage (AES-256).
- **[NEW] Biometrics Engine**: `DeepFace` for face matching and `MiniFASNetV2` for active/silent liveness detection.
- **[NEW] Manual Validation Workflow (MANDATORY)**: 
    - **No Auto-Activation**: Even if IA scores >95%, the system will ONLY flag as "Suggested Approval".
    - **KYC Agent (Jean)**: Mandatory visual review of original images (CNI, NIU, Facture, Selfie) to verify authenticity and consistency. 
    - **Operations (Thomas)**: Access to create account in Amplitude ONLY after Jean's "Approuver et ACTIVER" status is logged.
- **[NEW] Security & Audit**: AES-256 encryption for documents and full audit trail of every manual action (COBAC compliance).

### 3. Data & BI Strategy (Specialist Focus)
A dedicated pipeline to monitor the onboarding funnel, detect fraud patterns, and log audit trails.

- **Funnel Tracking**: Event-based logging for every step (Capture -> OCR -> Liveness -> Submission -> Jean Approval -> Thomas Creation).
- **Post-MVP Storage Strategy**: 
    - Implementation of an **open-source object storage** (e.g., MinIO) as an intermediary step.
    - Documenting the migration path to resilient, long-term cold storage (Glacier-like) for the 10-year retention requirement.
- **Error Analytics**: Dashboard for OCR confidence scores and Biometric failure reasons.
- **BI Infrastructure**: Simplified data warehouse schema (PostgreSQL) for reporting on conversion rates and agent workloads.

## Verification Plan

### Automated Tests
- **Unit Tests**: Python tests for OCR extraction logic and NIU algorithm.
- **Model Verification**: Validation script for DeepFace embeddings and Liveness thresholds.
- **Flutter Integration**: `flutter test` for state management and capture flow.

### Manual Verification
- **Functional Testing**: Walkthrough of the full onboarding process with (anonymized/test) identity documents.
- **Stress Testing**: Simulating high latency connections to test the mobile app's "Offline Resilience" feature.
- **Liveness Attack Simulation**: Attempting to bypass liveness with photos/videos of faces.

## Success Criteria (Phase Pilote 20-50 comptes)
- **Funnel**: Taux de complétion >75%, Temps moyen client <15 min (Cible stretch goal: 11 min).
- **Quality**: Taux de conformité >95%, Erreur OCR <10%, Faux positifs biométriques <2%, Détection fraude >90%.
- **Operations**: Délai validation humaine <2h, CSAT >4.2/5, Uptime >99.9%.

## User Review Required
> [!IMPORTANT]
> **Data Wipe Policy**: Following the 3rd liveness failure, all session data will be permanently wiped to prevent bot attacks.
