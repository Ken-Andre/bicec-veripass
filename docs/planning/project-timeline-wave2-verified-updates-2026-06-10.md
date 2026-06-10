# Project timeline verified updates wave 2 - 2026-06-10

This pass updates GitHub Project items that were still `Todo` or had missing
dates after the first timeline correction. The dates below were chosen from
feature-specific files and symbols, not from generic planning documents.

Rules:

- `Debut` = first commit where the feature had a meaningful implementation
  surface.
- `Fin` = last commit that made the feature substantially demonstrable or
  closed the acceptance gap.
- Status target = `In Progress`, per the planning convention for completed but
  still-open GitHub issues.
- No issue was closed.
- Docker was not started.

## Applied updates

| Issue | Dates applied | Commit evidence | Why this date range |
| --- | --- | --- | --- |
| #15 `Story 2.3: Liveness Selfie with 3-Strike Lockout` | 2026-04-18 -> 2026-05-31 | `e2a7e62` -> `fcec72c` | Backend liveness capture and lockout flow started with the KYC capture module; the mobile liveness/PWA startup path was hardened on 2026-05-31. |
| #16 `Story 2.4: OCR Extraction Review Screen` | 2026-04-25 -> 2026-05-06 | `2c16272` -> `5e9bb76` | Mobile OCR review/edit UI shipped on 2026-04-25; backend `ocr_review_confirmed` progress tracking completed the confirmation path. |
| #20 `Story 3.3: NIU Declaration or Upload` | 2026-03-21 -> 2026-05-28 | `68b8a08` -> `393016e` | Address/NIU DB migration started the model surface; later compliance evidence and dossier viewer fixes exposed NIU metadata. |
| #21 `Story 3.4: Digital Consent Checkboxes & Dossier Submission` | 2026-04-25 -> 2026-06-10 | `2c16272` -> `dd371a9` | Consent screen started in the KYC mobile flow; final submission confirmations were added on 2026-06-10. |
| #22 `Story 4.1: PaddleOCR PP-OCRv5 Primary CNI Extraction Service` | 2026-04-18 -> 2026-05-18 | `e2a7e62` -> `4dfb3bb` | KYC OCR pipeline started on 2026-04-18; image processing/encryption/OCR merging made the extraction flow demonstrable. |
| #23 `Story 4.2: GLM-OCR Fallback & Bill Semantic Extraction` | 2026-04-18 -> 2026-05-28 | `f5e0e64` -> `960982b` | Celery/core service foundations started the async fallback path; task rewrites and queue logic hardened the async OCR/AML processing path. |
| #24 `Story 4.3: Biometric Face Matching & Liveness Scoring` | 2026-04-18 -> 2026-06-01 | `e2a7e62` -> `e724487` | Liveness/biometric capture started in the KYC module; later route/service refinements completed DeepFace/MiniFASNet integration metadata. |
| #27 `Story 5.2: Side-by-Side Evidence Inspector` | 2026-04-05 -> 2026-05-29 | `2068cdf` -> `eb1ffbc` | Shared evidence viewer primitives started on 2026-04-05; EvidenceViewer v3 completed document tabs, OCR aliases, and image download. |
| #28 `Story 5.3: Jean's Decision Actions` | 2026-04-27 -> 2026-05-28 | `f1eefc4` -> `a7e3324` | Dossier support and decision surfaces appeared on 2026-04-27; EvidenceViewer v2 stabilized the action UI. |
| #29 `Story 6.1: PEP/Sanctions List Seeding & Weekly Cron Sync` | 2026-04-04 -> 2026-05-29 | `d54ed0f` -> `fe4d889` | AML/CFT APIs/models started the sanctions surface; AML list import registry and frontend page completed the operational path. |
| #31 `Story 6.3: Identity Conflict Resolution` | 2026-04-04 -> 2026-05-28 | `d54ed0f` -> `960982b` | DuplicateCheck/AML foundations started on 2026-04-04; async duplicate matching and NIU conflict handling landed on 2026-05-28. |
| #35 `Story 7.3: Immutable SHA-256 Audit Log Viewer` | 2026-04-05 -> 2026-06-06 | `8191b05` -> `c51e0d9` | System audit log page started on 2026-04-05; COBAC export audit metadata was hardened on 2026-06-06. |
| #36 `Story 7.4: COBAC Compliance Pack Export` | 2026-04-05 -> 2026-06-06 | `bfa0b89` -> `c51e0d9` | Audit module/compliance export foundations started on 2026-04-05; exported-by/client-IP audit metadata landed on 2026-06-06. |
| #55 `[CAPTURE-01] CNI Recto Capture logic` | 2026-04-18 -> 2026-05-26 | `8ee80eb` -> `9c97af9` | CNI capture screen started with the PWA KYC flow; upload feedback and KYC capture refinements landed on 2026-05-26. |
| #64 `[OCR-02] GLM-OCR Service (Fallback)` | 2026-04-18 -> 2026-05-28 | `3a09d67` -> `960982b` | OCR/llama-cpp integration started on 2026-04-18; async task rewrites hardened fallback execution. |
| #67 `[OCR-05] OCR results table schema` | 2026-03-18 -> 2026-04-04 | `768a597` -> `ad2b636` | Initial backend models introduced OCR fields; Alembic migrations hardened the schema. |
| #69 `[OCR-07] Field override logic & human tagging` | 2026-04-25 -> 2026-05-06 | `2c16272` -> `5e9bb76` | Mobile OCR review edits started on 2026-04-25; backend confirmation/progress tracking landed on 2026-05-06. |
| #71 `[BIO-02] Biometrics Service` | 2026-04-18 -> 2026-06-01 | `e2a7e62` -> `e724487` | Liveness/biometric capture started on 2026-04-18; DeepFace/MiniFASNet route/service refinements completed on 2026-06-01. |
| #72 `[BIO-03] Anti-spoofing scoring logic` | 2026-04-25 -> 2026-05-26 | `6078276` -> `4ae6d3d` | Backend liveness scoring started in the KYC router; FaceMatch v2 added anti-spoofing metadata and thresholds. |
| #73 `[BIO-04] 1:1 Face Matching logic` | 2026-04-18 -> 2026-05-26 | `e2a7e62` -> `4ae6d3d` | Biometric processing started in the KYC module; FaceMatch v2 completed status/reason/distance metadata. |
| #76 `[BIO-07] Liveness instruction animations & feedback` | 2026-04-25 -> 2026-05-31 | `2c16272` -> `fcec72c` | Mobile liveness screens started on 2026-04-25; liveness/iOS PWA startup was hardened on 2026-05-31. |
| #77 `[BIO-08] Service crop portrait CNI` | 2026-05-18 -> 2026-06-01 | `4dfb3bb` -> `e724487` | Image processing utilities started the crop path; KYC service refinements completed the biometric crop helper. |
| #80 `[BIO-11] 60s cooldown timer screen` | 2026-04-18 -> 2026-05-26 | `e2a7e62` -> `9c97af9` | Backend lockout/cooldown contract started with KYC capture; mobile liveness feedback refinements landed on 2026-05-26. |
| #83 `[KYC-SM-02] State Transition validation & enums` | 2026-04-25 -> 2026-05-29 | `6078276` -> `2b2f365` | Lifecycle state handling entered the KYC router on 2026-04-25; back-office status/flag handling was expanded on 2026-05-29. |
| #88 `[KYC-SM-07] Role-based mobile screens` | 2026-04-25 -> 2026-05-24 | `e69d23c` -> `6f91ee8` | Dashboard/access-level gating started on 2026-04-25; banking/KYC route restrictions and ATM model work landed by 2026-05-24. |
| #99 `[BO-01] Dossier Queue logic` | 2026-03-20 -> 2026-05-29 | `c192475` -> `2b2f365` | Back-office queue pagination/priority started on 2026-03-20; queue risk/priority flags and document promotion landed on 2026-05-29. |
| #100 `[BO-02] Agent Validation Desk Layout` | 2026-03-13 -> 2026-05-28 | `61ce703` -> `a7e3324` | Initial back-office SPA/validation layout started on 2026-03-13; EvidenceViewer v2 stabilized the desk layout on 2026-05-28. |
| #124 `[KYC-ADDR-07] Utility bill GLM-OCR semantic extraction` | 2026-04-30 -> 2026-05-26 | `55caa9a` -> `3cefafc` | Bill OCR templates and correction UI started on 2026-04-30; OCR stop-word/contextual address fixes landed on 2026-05-26. |
| #182 `[ADMIN-09] Frontend Sentry integration` | 2026-03-27 -> 2026-05-23 | `b6d89c0` -> `0357443` | Sentry integration started on 2026-03-27; mobile/backoffice proxy and noisy-event filtering landed on 2026-05-23. |

## Deliberately not updated

| Issue | Current Project state | Reason |
| --- | --- | --- |
| #37 `Story 8.1: Plan Personalization Screen` | `Todo`, no dates | Code contains plan mock data, but no dedicated Standard/Premium/Ultra plan personalization screen that satisfies the story acceptance criteria. |
| #38 `Story 8.2: Use-Case Personalization Selection` | `Todo`, no dates | No implemented use-case selection screen or `/kyc/session/preferences` persistence path was found in `code/`. |
| #177 `[ADMIN-04] /metrics Prometheus endpoint` | `Todo`, no dates | Search found monitoring/demo references, but no concrete `/metrics` Prometheus endpoint implementation in the current backend. |
