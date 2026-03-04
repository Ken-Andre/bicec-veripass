# Architecture bicec-veripass — Patch v3-bis
**Traite :** 15 findings Adversarial Review + correction Amplitude + directives Mermaid  
**Annule et remplace les sections concernées de v1 + v2 + v3**  
**Date :** 2026-03-04

---

## 0. INSTRUCTION DE FUSION — SOURCE DE VÉRITÉ UNIQUE (répond AR1)

> **Pour tout implémenteur :** Le seul document de référence est la **version consolidée finale** qui intègre dans cet ordre :
> `v1.0 (base) → corrections-v2 (replace §4,§5,§6) → patch-v3 (replace §7,§8,§9,§12,§13) → patch-v3-bis (replace §10,§13bis,§15 + ajoute §16,§17)`

| Section | Document actif | Statut v1 |
|---|---|---|
| §3 C4 L1 | v1.0 | ✅ Conservé |
| §3 C4 L2/L3 | corrections-v2 | ❌ v1 obsolète |
| §4 Use Case | corrections-v2 | ❌ v1 obsolète |
| §5 State Machine | patch-v3 (version définitive) | ❌ v1 + v2 obsolètes |
| §6 Séquences | corrections-v2 + patch-v3 | ❌ v1 partiellement obsolète |
| §7 ERD/LDM | patch-v3-bis §7bis | ❌ v1 + v3 partiellement obsolètes |
| §8 API Contract | patch-v3 + v3-bis §8bis | ❌ v1 partiellement obsolète |
| §9 Docker Compose | patch-v3 (mem_limits) | ❌ v1 partiellement obsolète |
| §10 RAM Budget | patch-v3-bis §10bis | ❌ v1 + v3 obsolètes |
| §13.3 Amplitude SDK | **SUPPRIMÉ** (voir §13bis) | ❌ v1 §13.3 entièrement supprimé |

---

## §3bis. C4 Level 2 — Conteneurs (Mermaid v3-bis, directives appliquées)

```mermaid
%%{init: {
  "flowchart": {
    "diagramPadding": 30,
    "nodeSpacing": 60,
    "rankSpacing": 70,
    "curve": "basis"
  }
}}%%
graph TB
    subgraph EXT["Systèmes Externes"]
        direction LR
        Orange["📱 Orange Cameroon<br>SMS API<br>OTP · Notifs critiques"]
        Axway["🔀 Axway API Manager<br>Réseau BICEC<br>Middleware Core Banking"]
        Sanctions["📋 OpenSanctions · UN<br>EU FSF · OFAC<br>Sync hebdo batch"]
    end

    subgraph Clients["Acteurs"]
        direction LR
        Marie["👤 Marie<br>PWA Browser"]
        Agents["👤 Jean · Thomas · Sylvie<br>Desktop Chrome/Edge"]
    end

    subgraph Docker["🐳 Docker Compose — bicec-veripass"]
        direction TB

        Nginx["🔀 Nginx<br>Reverse Proxy · TLS 1.3<br>Rate Limit · port 443"]

        subgraph Frontends["Frontends"]
            direction LR
            PWA["📱 PWA Marie<br>React/TypeScript<br>Service Worker · MediaPipe WASM"]
            BO["🖥️ Back-Office SPA<br>React/TypeScript<br>Jean · Thomas · Sylvie"]
        end

        subgraph Backend["Backend"]
            direction LR
            API["⚡ FastAPI<br>Python 3.11<br>PaddleOCR · DeepFace · MiniFASNet"]
            Celery["⚙️ Celery Workers<br>GLM-OCR · SMS<br>Provisioning · Sanctions"]
        end

        subgraph Data["Données"]
            direction LR
            PG[("🗄️ PostgreSQL 16<br>OLTP · DWH · Audit<br>PEP/Sanctions")]
            Redis[("⚡ Redis 7<br>Broker Celery<br>OTP TTL · Anti-replay")]
            FS[("📁 Volume Docker<br>/data/documents<br>Images · Selfies · Factures")]
        end
    end

    Marie -->|"HTTPS 443"| Nginx
    Agents -->|"HTTPS 443"| Nginx
    Nginx -->|"HTTP 3000"| PWA
    Nginx -->|"HTTP 3001"| BO
    Nginx -->|"HTTP 8000"| API

    API -->|"SQL 5432"| PG
    API -->|"GET/SET sessions OTP<br>+ vérif anti-replay"| Redis
    API -->|"PUSH tasks vers queues"| Redis
    API -->|"Read/Write images"| FS

    Celery -->|"POP tasks depuis queues"| Redis
    Celery -->|"SQL 5432"| PG
    Celery -->|"Read images à traiter"| FS
    Celery -->|"REST HTTP<br>envoi SMS"| Orange
    Celery -->|"REST · ISO 20022<br>provisioning clients"| Axway
    Celery -->|"HTTPS Download<br>sync listes"| Sanctions
```

---

## §5bis. State Machine — Diagramme (Mermaid v3-bis, directives appliquées)

> Contenu identique au patch-v3 §5, syntaxe Mermaid améliorée.

```mermaid
%%{init: {"theme": "dark", "stateDiagram": {"diagramMarginX": 30, "diagramMarginY": 20}}}%%
stateDiagram-v2
    direction TB

    [*] --> DRAFT : Marie crée session<br>access_level=RESTRICTED

    DRAFT --> LOCKED_LIVENESS : 3 échecs liveness<br>consécutifs
    LOCKED_LIVENESS --> DRAFT : Recommencer<br>(cooldown 15s + check<br>lockout_count_24h ≤ 30)
    LOCKED_LIVENESS --> [*] : Aller en agence

    DRAFT --> ABANDONED : Inactif > 24h<br>(Celery beat — analytique)
    DRAFT --> PENDING_KYC : Soumission dossier<br>access_level reste RESTRICTED

    PENDING_KYC --> PENDING_INFO : Jean demande<br>info / doc
    PENDING_INFO --> PENDING_KYC : Marie renvoie<br>via messagerie
    PENDING_INFO --> ABANDONED : Inactif > 7j<br>(Celery beat)

    PENDING_KYC --> COMPLIANCE_REVIEW : Alerte AML<br>auto-détectée
    COMPLIANCE_REVIEW --> PENDING_KYC : Thomas efface<br>faux positif
    COMPLIANCE_REVIEW --> MONITORED : Thomas confirme PEP<br>(actif + surveillé)
    COMPLIANCE_REVIEW --> DISABLED : Thomas confirme<br>fraude avérée

    PENDING_KYC --> REJECTED : Jean rejette<br>(fraude évidente)
    REJECTED --> [*]

    PENDING_KYC --> READY_FOR_OPS : Jean approuve

    READY_FOR_OPS --> PROVISIONING : Thomas initie<br>batch Axway

    PROVISIONING --> OPS_ERROR : Timeout 5min<br>sans réponse Axway
    OPS_ERROR --> PROVISIONING : Thomas retry
    PROVISIONING --> OPS_CORRECTION : Erreur format<br>ou collision NIU
    OPS_CORRECTION --> PROVISIONING : Thomas corrige

    PROVISIONING --> VALIDATED_PENDING_AGENCY : Axway confirme<br>SMS template + notif app

    VALIDATED_PENDING_AGENCY --> ACTIVATED_LIMITED : NIU absent/invalide<br>access_level=LIMITED_ACCESS
    VALIDATED_PENDING_AGENCY --> ACTIVATED_PRE_FULL : NIU valide<br>access_level=PRE_FULL_ACCESS

    ACTIVATED_LIMITED --> ACTIVATED_PRE_FULL : NIU uploadé<br>+ Jean revalide
    ACTIVATED_PRE_FULL --> ACTIVATED_FULL : Signature agence<br>access_level=FULL_ACCESS

    ACTIVATED_FULL --> EXPIRY_WARNING : Doc expirant<br>< 30 jours
    EXPIRY_WARNING --> PENDING_RESUBMIT : Jean notifie Marie
    PENDING_RESUBMIT --> ACTIVATED_FULL : Nouveau doc<br>+ Jean réapprouve
    PENDING_RESUBMIT --> ACTIVATED_LIMITED : Délai 30j dépassé

    MONITORED --> ACTIVATED_FULL : Surveillance levée
    MONITORED --> DISABLED : Fraude confirmée

    ACTIVATED_FULL --> DISABLED : Thomas suspend
    ACTIVATED_LIMITED --> DISABLED : Thomas suspend
    ACTIVATED_PRE_FULL --> DISABLED : Thomas suspend
```

---

## §7bis. ERD LDM — Version complète corrigée (répond AR12, AR14, AR15)

> **AR12 résolu :** `digital_signature_path` remplacé.  
> **AR14 résolu :** `status` et `access_level` avec contraintes CHECK explicites + trigger.  
> **AR15 résolu :** `support_threads`, `support_messages` intégrés au CDM/LDM.

### 7.1bis — CDM mis à jour

```mermaid
%%{init: {"er": {"diagramMarginX": 20, "diagramMarginY": 20}}}%%
erDiagram
    USER ||--o{ KYC_SESSION : "initie"
    USER ||--o{ NOTIFICATION : "reçoit"
    USER ||--o{ OTP_SESSION : "s'authentifie via"

    KYC_SESSION ||--|{ DOCUMENT : "contient"
    KYC_SESSION ||--o| BIOMETRIC_RESULT : "produit"
    KYC_SESSION ||--o{ AML_ALERT : "génère"
    KYC_SESSION ||--o{ DUPLICATE_CHECK : "déclenche"
    KYC_SESSION ||--o| CONSENT_RECORD : "finalise par"
    KYC_SESSION ||--o| DOSSIER_ASSIGNMENT : "assigné à"
    KYC_SESSION ||--o{ VALIDATION_DECISION : "reçoit"
    KYC_SESSION ||--o{ PROVISIONING_BATCH_ITEM : "provisionné dans"
    KYC_SESSION ||--o{ SUPPORT_THREAD : "associé à"

    DOCUMENT ||--|{ OCR_FIELD : "extrait en"

    AGENT ||--o{ DOSSIER_ASSIGNMENT : "traite"
    AGENT ||--o{ VALIDATION_DECISION : "émet"
    AGENT }|--|| AGENCY : "appartient à"

    PROVISIONING_BATCH ||--|{ PROVISIONING_BATCH_ITEM : "contient"

    PEP_SANCTIONS ||--o{ AML_ALERT : "déclenche"

    SUPPORT_THREAD ||--|{ SUPPORT_MESSAGE : "contient"
    AUDIT_LOG }|--|| USER : "tracé par"
```

### 7.2bis — LDM : tables modifiées ou ajoutées

```mermaid
%%{init: {"er": {"diagramMarginX": 20, "diagramMarginY": 20}}}%%
erDiagram

    kyc_sessions {
        UUID id PK
        UUID user_id FK
        UUID agency_id FK
        TEXT status "CHECK IN states"
        TEXT access_level "CHECK IN levels"
        TEXT niu_type
        DECIMAL confidence_score_global
        INT liveness_strike_count
        BOOLEAN priority_flag
        BOOLEAN doc_expiry_flag
        TIMESTAMPTZ doc_expiry_deadline
        TIMESTAMPTZ doc_expiry_notified_at
        TIMESTAMPTZ escalated_at
        TIMESTAMPTZ started_at
        TIMESTAMPTZ submitted_at
        TIMESTAMPTZ completed_at
        TEXT last_step_completed
        INET submission_ip
    }

    users {
        UUID id PK
        VARCHAR phone UK
        VARCHAR email UK
        TEXT pin_hash
        BOOLEAN biometric_opt_in
        VARCHAR language
        INT liveness_lockout_count_24h
        TIMESTAMPTZ last_lockout_reset_at
        TIMESTAMPTZ created_at
    }

    consent_records {
        UUID id PK
        UUID session_id FK
        BOOLEAN cgu_accepted
        BOOLEAN privacy_accepted
        BOOLEAN data_processing_accepted
        TEXT consent_method
        JSONB consent_metadata
        TIMESTAMPTZ signed_at
        INET client_ip
    }

    support_threads {
        UUID id PK
        UUID session_id FK
        TIMESTAMPTZ created_at
        TEXT status
    }

    support_messages {
        UUID id PK
        UUID thread_id FK
        TEXT sender_type
        UUID sender_id
        TEXT content
        TEXT attachment_path
        TEXT attachment_sha256
        TIMESTAMPTZ sent_at
        TIMESTAMPTZ read_at
    }

    provisioning_batches {
        UUID id PK
        UUID created_by FK
        TIMESTAMPTZ created_at
        TEXT status
        TEXT error_type
        TEXT error_detail
        INT retry_count
    }

    provisioning_batch_items {
        UUID id PK
        UUID batch_id FK
        UUID session_id FK
        TEXT status
        TEXT axway_request_id
        TEXT iso20022_message_ref
        JSONB axway_response
        TIMESTAMPTZ processed_at
    }

    kyc_sessions ||--o{ support_threads : "session_id"
    support_threads ||--|{ support_messages : "thread_id"
    provisioning_batches ||--|{ provisioning_batch_items : "batch_id"
    kyc_sessions ||--o{ provisioning_batch_items : "session_id"
```

> **Contraintes DB à ajouter en DDL (pas dans Mermaid — Mermaid ne supporte pas les CHECK) :**
> ```
> status   : CHECK IN ('DRAFT','PENDING_KYC','PENDING_INFO','COMPLIANCE_REVIEW',
>                      'READY_FOR_OPS','PROVISIONING','OPS_ERROR','OPS_CORRECTION',
>                      'VALIDATED_PENDING_AGENCY','ACTIVATED_LIMITED','ACTIVATED_PRE_FULL',
>                      'ACTIVATED_FULL','EXPIRY_WARNING','PENDING_RESUBMIT',
>                      'MONITORED','REJECTED','DISABLED','ABANDONED')
> access_level : CHECK IN ('RESTRICTED','LIMITED_ACCESS','PRE_FULL_ACCESS',
>                           'FULL_ACCESS','BLOCKED')
> agents.role  : CHECK IN ('JEAN','THOMAS','SYLVIE')
> ```
> Trigger PostgreSQL validant les combinaisons `(status, access_level)` légales selon la matrice du §5.

---

## §8bis. API Contract — Versioning + Schéma d'erreurs (répond AR13)

### Préfixe de version

Tous les endpoints sont préfixés `/api/v1/`. Exemple : `POST /api/v1/auth/otp/send`.

### Schéma d'erreur standard (toutes les routes)

```json
{
  "error": {
    "code": "OTP_RATE_LIMIT_EXCEEDED",
    "message": "Trop de tentatives. Réessayez dans 15 minutes.",
    "retry_after_seconds": 900,
    "request_id": "req_abc123"
  }
}
```

| Code HTTP | Code erreur métier | Déclencheur |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Champ manquant ou format incorrect |
| 401 | `TOKEN_EXPIRED` | JWT expiré |
| 401 | `TOKEN_INVALID` | JWT invalide ou falsifié |
| 403 | `RBAC_DENIED` | Rôle insuffisant pour cette action |
| 409 | `SESSION_ALREADY_SUBMITTED` | Double-soumission /kyc/submit |
| 413 | `PAYLOAD_TOO_LARGE` | Image > 10MB |
| 422 | `OCR_ALL_FIELDS_FAILED` | Confidence = 0% sur tous les champs |
| 429 | `OTP_RATE_LIMIT_EXCEEDED` | >5 envois OTP/15min |
| 429 | `LIVENESS_LOCKOUT` | 3 strikes consécutifs |
| 500 | `INTERNAL_ERROR` | Erreur serveur non anticipée |
| 503 | `OCR_SERVICE_UNAVAILABLE` | PaddleOCR ou GLM-OCR indisponible |

---

## §10bis. RAM Budget — Version honnête (répond AR3)

**Problème identifié :** Au démarrage `docker-compose up`, tous les containers démarrent simultanément. `celery_ocr` charge GLM-OCR en mémoire au lancement → pic RAM simultané avec FastAPI chargeant PaddleOCR → OOM sur i3/16GB WSL2 (cap 8GB).

**Solution : lazy loading + démarrage séquentiel**

```yaml
# docker-compose.yml - ajouts critiques

api:
  mem_limit: 2g
  environment:
    - PADDLE_LAZY_LOAD=true   # PaddleOCR chargé à la 1ère requête OCR
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 30s
    start_period: 60s

celery_ocr:
  mem_limit: 3g
  depends_on:
    api:
      condition: service_healthy  # Ne démarre qu'après API prête
  environment:
    - GLM_LAZY_LOAD=true      # GLM-OCR chargé à la 1ère tâche de la queue
```

**Budget RAM révisé (honnête) :**

| Phase | Mémoire | Condition |
|---|---|---|
| Démarrage à froid (aucune requête) | ~2.2GB | Nginx + PG + Redis + API (sans modèles) |
| API active, PaddleOCR chargé | ~3.7GB | Après 1ère requête OCR |
| Celery actif, GLM en attente | ~4.2GB | Workers prêts, pas de tâche GLM |
| **Peak : PaddleOCR en cours + GLM en cours** | **~7.2GB** | **⚠️ Séquentiel obligatoire (Redis lock)** |
| Peak absolu théorique (si lock échoue) | ~9GB | ❌ OOM — le lock Redis l'empêche |

> Le Redis lock applicatif (voir patch-v3 §12) est **la seule protection** contre l'OOM. Il doit être implémenté avant toute mise en production, même sur i3.

---

## §13bis. Amplitude — SUPPRESSION SDK + Architecture corrigée (répond AR2)

### ❌ SUPPRIMER ENTIÈREMENT — Section 13.3 de v1

> La section 13.3 "Amplitude Python SDK" du document v1 est **entièrement supprimée**. Elle référençait `amplitude.com` (SaaS analytics américain) sous le nom "Sopra Amplitude" — deux produits sans aucun rapport. Ce code viole la souveraineté (données envoyées vers cloud étranger) et ne correspond à rien dans notre architecture.

### ✅ Architecture Axway — Provisioning Sopra Amplitude Core Banking

**Ce que "Amplitude" signifie dans ce projet :** Sopra Banking Software — Amplitude, Core Banking System de BICEC. L'accès se fait via le middleware **Axway API Manager** sur le réseau interne BICEC. VeriPass n'a **jamais** accès direct au Core.

```
Table provisioning_batches (PostgreSQL VeriPass)
    ↓  Thomas initie via interface back-office
Celery Worker amplitude_batch_worker
    ↓  Appels REST séquentiels (ou mini-batch)
Axway API Manager v11.6 AIF (réseau BICEC — intranet)
    ↓  Route + authentifie + transforme
Sopra Amplitude Core Banking
    ↓  Confirme création/mise à jour
Celery Worker ← réponse Axway
    ↓
UPDATE provisioning_batch_items (status, axway_request_id, iso20022_message_ref)
UPDATE kyc_sessions (status=VALIDATED_PENDING_AGENCY)
```

**Format des messages — ISO 20022 (obligatoire depuis 2025, directive BEAC) :**

| Action | Message ISO 20022 |
|---|---|
| Création compte | `acmt.009` — AccountOpeningInstruction |
| Confirmation création | `acmt.010` — AccountOpeningConfirmation |
| Mise à jour client existant | `acmt.003` — AccountModificationInstruction |
| Confirmation mise à jour | `acmt.004` — AccountModificationConfirmation |

> **Note investigation :** La documentation exacte des endpoints Axway disponibles dans l'environnement BICEC doit être demandée à l'équipe IT BICEC avant implémentation. L'encadreur confirme que v11.6 AIF expose des WebServices API Manager — les endpoints REST spécifiques et la structure exacte des messages sont à confirmer en contexte d'intégration réelle.

**Cas client existant (update) :**
> Un client BICEC existant qui passe par VeriPass pour mettre à jour ses infos expirées → Celery vérifie d'abord si un compte existe (recherche par téléphone/NIU dans Axway) → si oui : `acmt.003` mise à jour uniquement des champs expirés → Axway répond "client updated" → pas de doublon créé.

---

## §15. Findings restants Adversarial Review (AR4 à AR11)

### AR4 — PRD dit Flutter, ADR dit PWA

> **Réconciliation officielle :** Le PRD (line 161, `projectType`) est **antérieur** à la décision ADR-001. Le PRD n'a pas été mis à jour car c'est un document de planification figé — il n'est pas re-généré pendant l'architecture. La **source de vérité technique** est l'ADR-001 (architecture document). Pour tout développeur : ADR-001 > PRD sur les choix technologiques. Une note de réconciliation est ajoutée en tête du PRD.

### AR5 — Chiffrement Phase 1 vs NFR5 PRD

> **NFR5 :** "100% of biometric templates and CNI images must be encrypted using AES-256 inside Docker volumes."  
> **Réconciliation :** L'ADR-006 (§14 du document principal) différait le chiffrement au repos. C'est une **contradiction réelle** avec le PRD. **Décision révisée :** Le chiffrement au repos s'applique dès le départ sur le **volume `/data/documents`** via chiffrement applicatif Python (Fernet/AES-256) sur l'écriture des images — avant de toucher le disque. Seules les données de debug non-sensibles (logs, métadonnées JSON) restent en clair. Cela résout la contradiction avec NFR5 sans bloquer le développement (un helper `encrypt_file()` / `decrypt_file()` suffit).

### AR6 — Error UX non spécifiée

**États d'erreur Marie — à implémenter sur la PWA :**

| Scénario | Message affiché | Action proposée |
|---|---|---|
| OTP SMS jamais arrivé | "SMS non reçu ? Attendez 60s puis réessayez. Ou recevez par email." | Bouton "Renvoyer" + bouton "Recevoir par email" |
| OCR 0% confiance sur tous les champs | "Nous n'avons pas pu lire votre document. Recapturez dans un endroit plus lumineux." | Bouton "Réessayer" avec conseils photo |
| Upload timeout 3G (>30s) | "Connexion lente détectée. Votre document est sauvegardé localement, l'upload reprendra automatiquement." | Indicateur "En attente de réseau" |
| Erreur 500 backend | "Une erreur inattendue s'est produite. Votre progression est sauvegardée." | Bouton "Réessayer" (retry idempotent) |
| session_id invalide côté serveur | "Session expirée. Reconnectez-vous avec votre PIN pour reprendre." | Redirect PIN auth → GET /kyc/session/{id} |

### AR7 — AML fuzzy matching non défini

**Algorithme retenu : pg_trgm (trigram PostgreSQL)**

- Natif PostgreSQL, zéro dépendance externe
- `similarity(nom_client, nom_sanctions)` → score entre 0 et 1
- **Seuil alerte :** `≥ 0.65` → INSERT aml_alert (review humain Thomas)
- **Seuil auto-clear :** `< 0.40` → pas d'alerte créée
- Complété par : comparaison `date_of_birth` (± 2 ans tolérance) + `nationality`
- Données périmées : `pep_sanctions.last_synced_at` affiché dans l'interface Thomas — si > 8 jours → banner ⚠️ "Données de sanctions potentiellement périmées"

### AR9 — Notifications polling et scalabilité

**Cache Redis pour notifications (50 users pilote → scalable Phase 2) :**

```
GET /api/v1/notifications?after_id={cursor}
    → Redis GET notif_cache:{user_id}
    → Si miss : SELECT FROM notifications WHERE id > cursor AND user_id = X
    → SET Redis (TTL 30s)
    → Retourne {notifications, next_cursor}
```

- Le cache Redis (TTL 30s) absorbe les requêtes polling répétées
- À 500 users (Phase 2) : 1000-2000 req/min → Redis répond en <1ms, PostgreSQL consulté seulement si cache miss
- Si croissance > 500 users : migration SSE (`GET /api/v1/notifications/stream`) sans changer le contrat API client

### AR10 — OLTP et DWH sur même PostgreSQL

**Isolation par schéma PostgreSQL :**

```
Base veripass (PostgreSQL unique, 512MB)
├── schema: public        → Tables OLTP (kyc_sessions, users, agents...)
├── schema: dwh           → Tables analytics (fact_*, dim_*)
└── schema: audit         → audit_log (partitionnée, append-only)
```

**Isolation des requêtes analytiques :**
- Rôle DB `vp_analytics` avec accès READ-ONLY sur `schema dwh` uniquement
- `SET statement_timeout = '5s'` sur la connexion analytics (SQLAlchemy pool dédié)
- Les requêtes Sylvie partent d'un pool de connexions séparé → ne bloquent pas Jean

### AR11 — Partitions audit_log non automatisées

**Celery Beat — création automatique partitions mensuelles :**

```
Tâche Celery : create_audit_partition
Schedule     : 1er de chaque mois à 00h01
Action       : CREATE TABLE IF NOT EXISTS audit.audit_log_{YYYY_MM}
               PARTITION OF audit.audit_log
               FOR VALUES FROM ('{YYYY-MM-01}') TO ('{YYYY-MM+1-01}')
```

> Celery Beat envoie cette tâche dans la queue `maintenance` — un worker Celery normal l'exécute. Si la partition existe déjà (`IF NOT EXISTS`), la tâche est idempotente. Une alerte est envoyée à Thomas si la création échoue (INSERT audit impossible le 1er du mois à 00h02 = signal d'échec).

---

## §16. Réconciliation Prototype (AR8)

> Le prototype (`MobileOnboarding.tsx`, `BackOffice.tsx`) est un **prototype de démonstration UI**, pas le code de production. Il ne prétend pas implémenter l'architecture complète. Les divergences documentées sont des **dettes de réconciliation** à traiter lors de l'implémentation, pas des bugs d'architecture.

**Checklist de réconciliation prototype → production :**

- [ ] Renommer status enum : `pending→PENDING_KYC`, `approved→READY_FOR_OPS`, `limited→ACTIVATED_LIMITED`
- [ ] Ajouter états manquants : `DRAFT`, `COMPLIANCE_REVIEW`, `MONITORED`, `VALIDATED_PENDING_AGENCY`, etc.
- [ ] Étape `signature` → renommer `consent`, supprimer canvas, conserver 3 checkboxes uniquement
- [ ] Ajouter champ `access_level` distinct de `status` dans `ApplicationData`
- [ ] Aligner `STEP_SEQUENCE` avec les modules A→G de la UX Spec v2.1

---

*Patch v3-bis — 2026-03-04*  
*AR findings traités : 15/15 | Amplitude SDK supprimé | Mermaid directives appliquées*
