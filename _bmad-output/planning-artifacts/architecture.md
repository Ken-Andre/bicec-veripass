---
stepsCompleted: [1, 2]
inputDocuments: [
  "C:/Users/yoann/Documents/School/Xp-X5/Stage/bicec-veripass/_bmad-output/planning-artifacts/prd.md",
  "C:/Users/yoann/Documents/School/Xp-X5/Stage/bicec-veripass/_bmad-output/planning-artifacts/ux-design-specification-v2.md",
  "C:/Users/yoann/Documents/School/Xp-X5/Stage/bicec-veripass/_bmad-output/planning-artifacts/product-brief-bicec-veripass-2026-02-07.md",
  "C:/Users/yoann/Documents/School/Xp-X5/Stage/bicec-veripass/_bmad-output/planning-artifacts/research/research_report_kyc_bicec.md",
  "C:/Users/yoann/Documents/School/Xp-X5/Stage/bicec-veripass/_bmad-output/planning-artifacts/research/technical-Bicec-Veripass-research-2026-02-03.md"
]
workflowType: 'architecture'
project_name: 'bicec-veripass'
user_name: 'Ken'
date: '2026-02-25T05:49:01+01:00'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The system must support a high-precision, digital KYC onboarding flow (CNI OCR, Liveness) paired with a robust back-office validation and compliance system. The MVP is scoped for internal pilot testing by employees, meaning precision, data quality, and extraction accuracy are prioritized over offline resilience. Back-office operations (Jean/Thomas) demand side-by-side evidence inspection, AML screening, and comprehensive audit trailing. Following manual validation, supervised agents (Thomas) will trigger account provisioning directly via Sopra Amplitude Web Services.

**Non-Functional Requirements:**
Architecture is driven by strict data sovereignty (100% on-premise AI, zero cloud SaaS) and hardware constraints (Intel i3, 16GB RAM cap for the Docker stack). High precision in OCR and biometrics is critical to ensure clean data entry into the core banking system. Security demands TLS 1.3 in transit, AES-256 for biometric data at rest, and immutable SHA-256 audit logs to satisfy COBAC requirements. Mobile offline resilience ("Délestage" handling) is explicitly descoped for the MVP.

**Scale & Complexity:**
Project Complexity: Medium-High

- Primary domain: Mobile Fintech & Sovereign AI Processing
- Complexity level: Medium-High (Integration of Local AI, strict compliance flows, and real Amplitude Web Services)
- Estimated architectural components: 4 (Mobile Client, Core API/AI Backend, Back-Office Web SPA, PostgreSQL Database/Cache)

### Technical Constraints & Dependencies

- **Hardware**: Strict deployment to legacy nodes (Intel i3 @ 2.5GHz, 16GB RAM, 200GB Disk).
- **Infrastructure**: Air-gapped/On-premise deployment strictly mandated by Law 2024-017. Docker-compose monolith strategy for MVP.
- **Dependencies**: Open-source sovereign stack only (PaddleOCR, DeepFace, FastAPI). Real web service integration with Sopra Amplitude is required for MVP. External API integration with DGI (Tax) is descoped for MVP.

### Cross-Cutting Concerns Identified

- **Data Precision & Payload Integrity**: Ensuring OCR extraction meets strict quality thresholds before human review and subsequent transmission to Amplitude.
- **Audit & Compliance**: Centralized, immutable logging for every validation decision and state change.
- **Resource Throttling**: Preventing CPU pegging during concurrent OCR/Biometric workloads on low-spec hardware.
