# Diagramme de séquence — capture et soumission KYC (version courante)

> **Note d'autorité, 2026-06-02 :** ce diagramme remplace `sequence-capture-upload-mermaid.md` (déplacé dans `docs/diagrams/_obsolete/`). Il ne contient **aucune** référence à la DGI, à Sopra Amplitude, ou à un core banking. La séquence illustre le parcours réel implémenté dans `code/backend/app/modules/kyc/` et `code/backend/app/tasks/ocr.py`.
>
> **Document maître :** [`../BICEC-VERIPASS-VUE-ENSEMBLE.md`](../BICEC-VERIPASS-VUE-ENSEMBLE.md) § 4.2.

```mermaid
sequenceDiagram
    autonumber
    actor M as Marie (mobile PWA)
    participant NGX as Nginx
    participant API as FastAPI (api)
    participant DB as PostgreSQL
    participant RD as Redis (broker)
    participant OCR as Celery OCR worker
    participant BIO as Service biométrie (MiniFASNet)
    participant BO as Backoffice (SPA)

    Note over M,BO: Phase 1 — Authentification
    M->>NGX: POST /api/v1/auth/otp/send (phone)
    NGX->>API: proxy
    API->>RD: store OTP hash (TTL 5 min)
    API-->>M: 200 OK (correlation_id)
    M->>NGX: POST /api/v1/auth/otp/verify
    API->>DB: get_or_create users
    API->>RD: issue access + refresh tokens (jti)
    API-->>M: tokens + X-Correlation-ID

    Note over M,BO: Phase 2 — Démarrage de la session KYC
    M->>NGX: POST /api/v1/kyc/session/start
    API->>DB: INSERT kyc_sessions (status=DRAFT)
    API-->>M: session_id + readiness flags

    Note over M,BO: Phase 3 — Capture CNI et OCR
    M->>NGX: POST /api/v1/kyc/capture/cni (multipart, recto)
    API->>DB: INSERT documents (file path, sha256, type=CNI_RECTO)
    API->>OCR: run_paddle_ocr (sync, premier passage)
    OCR-->>API: fields + confidence_score
    alt confidence < seuil OU champs manquants
        API->>RD: enqueue app.tasks.ocr.run_glm_ocr_fallback
        RD-->>OCR: consume (queue glm_ocr_jobs)
        OCR->>OCR: GLM-OCR local (glm_utils.py)
        OCR-->>API: corrected fields
    end
    API-->>M: OCR preview (champs + confidence)

    M->>NGX: POST /api/v1/kyc/capture/cni (verso)
    Note right of M: Même pipeline que recto
    API-->>M: OCR verso preview

    M->>NGX: POST /api/v1/kyc/ocr/review (champs confirmés)
    API->>DB: UPDATE ocr_fields (user_confirmed=true)
    API->>DB: UPDATE documents.ocr_status=CONFIRMED

    Note over M,BO: Phase 4 — Liveness et biométrie
    M->>NGX: POST /api/v1/kyc/liveness/submit (landmarks MediaPipe)
    API->>DB: upsert biometric_results
    API->>BIO: pad_check via MiniFASNetV2 ONNX (sur SELFIE)
    BIO-->>API: liveness score + anti-spoofing
    API->>DB: UPDATE biometric_results (status, score, model_version)
    API-->>M: liveness result

    Note over M,BO: Phase 5 — Adresse, NIU, consentements
    M->>NGX: POST /api/v1/kyc/address/submit
    API->>DB: UPDATE kyc_sessions (region, city, gps)
    M->>NGX: POST /api/v1/kyc/niu/submit
    API->>DB: UPDATE kyc_sessions (niu_type, niu_number)
    M->>NGX: POST /api/v1/kyc/consent/submit
    API->>DB: INSERT consent_records
    M->>NGX: POST /api/v1/kyc/signature/submit
    API->>DB: UPDATE kyc_sessions (signature_data_url)

    Note over M,BO: Phase 6 — Readiness et soumission
    M->>NGX: GET /api/v1/kyc/readiness
    API->>DB: agrège (documents, ocr_confirmed, biometric, consent, signature)
    API-->>M: { can_submit: true, blocking_reasons: [] }
    M->>NGX: POST /api/v1/kyc/submit
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE kyc_sessions SET status=PENDING_AGENT_REVIEW, submission_ip=...
    API->>DB: INSERT validation_decisions (placeholder)
    API->>DB: INSERT audit_log
    API->>DB: COMMIT
    API->>RD: enqueue send_kyc_result (notification)
    API-->>M: 200 OK (status=PENDING_AGENT_REVIEW)

    Note over M,BO: Phase 7 — Revue backoffice
    BO->>API: GET /api/v1/backoffice/queue
    API->>DB: SELECT dossiers WHERE status=PENDING_AGENT_REVIEW
    API-->>BO: queue[]
    BO->>API: GET /api/v1/backoffice/dossier/{id}
    API-->>BO: dossier_detail (avec tous les champs OCR/biométrie)
    BO->>API: GET /api/v1/backoffice/dossier/{id}/documents/{doc_id}/file
    API-->>BO: bytes (vérification rôle)
    BO->>API: POST /api/v1/backoffice/dossier/{id}/review {decision}
    API->>DB: TRANSACTION (validation_decisions + kyc_sessions.status + audit_log)
    API->>RD: enqueue notification Marie
    API-->>BO: 200 OK

    Note over M,BO: Phase 8 — Handoff aval (si APPROVED)
    API->>RD: enqueue notification APPROVED
    RD-->>M: push/in-app "Dossier validé"
    M->>M: PWA lit access_level = LIMITED_ACCESS
    M->>M: OS detection → app-link BI PAY / Wallet<br/>(fallback App Store / Google Play)
```

## Ce que ce diagramme **ne montre pas** (volontairement)

- **Aucun appel DGI.** La validation NIU côté VeriPass est limitée à des contrôles de format et à la gestion `niu_type ∈ {MISSING, DECLARATIVE, UPLOADED}`.
- **Aucun appel Sopra Amplitude.** Aucune route `/amplitude/*` n'existe dans le code.
- **Aucun appel core banking.** Le module `banking/` est une coquille produit locale (cards, transfers, transactions, savings) qui n'est pas connectée à un adaptateur core banking externe.
- **Aucun provisioning de compte aval.** Le passage d'un client vers BI PAY, BICEC Mobile-Banking, ou BICEC Wallet est un **handoff mobile** (app-link + store fallback), pas un provisioning côté VeriPass.
