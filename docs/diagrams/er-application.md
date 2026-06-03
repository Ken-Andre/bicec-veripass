# Modèle entité-relation (ER) — version courante

> **Note d'autorité, 2026-06-02 :** ce diagramme remplace `er-application-mermaid.md` (déplacé dans `docs/diagrams/_obsolete/`). Il reflète le **modèle SQLAlchemy actuel** (post-migration `029_dwh_analytics_events.py`) et **n'inclut pas** de tables DGI, Sopra Amplitude, ou core banking.
>
> **Source de vérité :** `code/backend/app/modules/*/models.py` + `code/backend/alembic/versions/`.
>
> **Document maître :** [`../BICEC-VERIPASS-VUE-ENSEMBLE.md`](../BICEC-VERIPASS-VUE-ENSEMBLE.md) § 4.5.

```mermaid
erDiagram
    USERS ||--o{ OTP_SESSIONS : "reçoit"
    USERS ||--o{ TOKEN_REVOCATIONS : "révoque"
    USERS ||--o{ WEBAUTHN_CREDENTIALS : "possède"
    USERS ||--o{ DEVICE_REGISTRATIONS : "possède"
    USERS ||--o{ KYC_SESSIONS : "ouvre"
    USERS ||--o{ NOTIFICATIONS : "reçoit"
    USERS ||--o{ NOTIFICATION_PREFERENCES : "configure"
    USERS ||--o{ PUSH_SUBSCRIPTIONS : "possède"
    USERS ||--o{ BANK_CARDS : "possède (coquille locale)"
    USERS ||--o{ TRANSFERS : "initie (coquille locale)"
    USERS ||--o{ TRANSACTIONS : "a (coquille locale)"
    USERS ||--o{ SAVINGS_POCKETS : "possède (coquille locale)"

    AGENCIES ||--o{ AGENTS : "emploie"
    AGENCIES ||--o{ KYC_SESSIONS : "reçoit"

    AGENTS ||--o{ DOSSIER_ASSIGNMENTS : "assigné"
    AGENTS ||--o{ VALIDATION_DECISIONS : "décide"

    KYC_SESSIONS ||--o{ DOCUMENTS : "contient"
    KYC_SESSIONS ||--o| BIOMETRIC_RESULTS : "a"
    KYC_SESSIONS ||--o| CONSENT_RECORDS : "a"
    KYC_SESSIONS ||--o{ VALIDATION_DECISIONS : "revue"
    KYC_SESSIONS ||--o{ DOSSIER_ASSIGNMENTS : "assigné"
    KYC_SESSIONS ||--o{ AML_ALERTS : "déclenche"
    KYC_SESSIONS ||--o{ DUPLICATE_CHECKS : "comparé"
    KYC_SESSIONS ||--o{ SUPPORT_THREADS : "discute"
    KYC_SESSIONS ||--o{ NOTIFICATIONS : "reçoit"
    KYC_SESSIONS ||--o{ PROVISIONING_BATCH_ITEMS : "tracké"

    DOCUMENTS ||--o{ OCR_FIELDS : "extrait"
    DOCUMENTS ||--o{ SUPPORT_MESSAGES : "attaché"

    SUPPORT_THREADS ||--o{ SUPPORT_MESSAGES : "contient"

    PEP_SANCTIONS ||--o{ AML_ALERTS : "matche"

    PROVISIONING_BATCHES ||--o{ PROVISIONING_BATCH_ITEMS : "contient"

    AUDIT_LOG }o--|| USERS : "acteur"
    AUDIT_LOG }o--|| AGENTS : "acteur"

    ATMS ||--o{ KYC_SESSIONS : "référence"

    subgraph DWH["Schema dwh (OLAP léger)"]
        DWH_FACT_KYC_EVENTS
        DWH_DIM_USERS
        DWH_DIM_AGENCIES
        DWH_DIM_AGENTS
        DWH_DIM_TIME
    end

    KYC_SESSIONS -.->|event tracking| DWH_FACT_KYC_EVENTS
```

## Notes importantes

- **Tables `BANK_CARDS`, `TRANSFERS`, `TRANSACTIONS`, `SAVINGS_POCKETS`** : appartiennent au **module banking local** (`code/backend/app/modules/banking/`). Ce sont des **coquilles produit** utilisées pour le dashboard post-KYC et les flows d'argent simulés. **Elles ne sont pas un adaptateur core banking et n'ont pas de correspondance avec un système externe.**
- **Tables `PROVISIONING_BATCHES`, `PROVISIONING_BATCH_ITEMS`** : utilisées par les écrans admin et AML pour le suivi de **batchs administratifs internes**. Le mot "provisioning" est historique et **ne signifie PAS une intégration DGI, Sopra, ou core banking**. Aucun appel sortant n'est fait.
- **Schema `dwh`** : créé par la migration `029_dwh_analytics_events.py`. C'est un mini-star-schema pour les analytics (event sourcing léger). C'est dans la **même** base PostgreSQL, pas dans un entrepôt séparé.
- **Table `ATMS`** : catalogue interne d'agences/GAB affiché en mode client après approbation.
- **Table `AUDIT_LOG`** : append-only, alimente l'export COBAC.

## Différences avec la version historique

- L'ancienne ER avait `APPLICATIONS` (terme Flutter/legacy), `AUDIT_LOGS` (pluriel) avec des champs `nationalId`/`niuId` au niveau racine. La version courante utilise les tables SQLAlchemy normalisées.
- L'ancienne ER n'incluait ni le module `devices`, ni le module `notifications`, ni le schema `dwh`.
