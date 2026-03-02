# Architecture bicec-veripass — Corrections v2
**Sections corrigées :** Guide lecture + C4 L2/L3 + Use Case + State Machine + Séquences clés  
**À fusionner avec** `architecture-bicec-veripass.md` v1.0

---

## 🗺️ GUIDE DE LECTURE DES DIAGRAMMES

### Comment lire un diagramme C4

Le modèle C4 décrit un système à 4 niveaux de zoom croissants, comme une carte géographique :

| Niveau | Analogie | Ce qu'on voit |
|---|---|---|
| **C4 L1 – Contexte** | Vue satellite | Le système entier + les acteurs humains + systèmes externes qui l'entourent |
| **C4 L2 – Conteneurs** | Vue du quartier | Les grandes "boîtes" déployées (serveurs, apps, bases de données) et leurs connexions |
| **C4 L3 – Composants** | Plan d'un bâtiment | À l'intérieur d'une boîte, les modules logiciels et leurs interactions internes |
| **C4 L4 – Code** | Plan d'une pièce | Classes, fonctions (non produit ici — niveau implémentation) |

**Symboles utilisés :**
- **Personne** (icône humain) = acteur externe (Marie, Jean…)
- **Boîte pleine** = composant interne au système
- **Boîte en pointillés** = système externe (Orange SMS, Amplitude)
- **Flèche →** = direction du flux de données ou appel
- **Label sur flèche** = protocole ou rôle du lien (ex: `HTTPS/443`, `SQL/5432`)

---

### Comment lire un diagramme de Séquence

Se lit **de haut en bas**, comme une conversation dans le temps :

```
Acteur A          Acteur B          Système C
   |                 |                  |
   |----requête----->|                  |     ← A appelle B
   |                 |----traitement--->|     ← B appelle C
   |                 |<---réponse-------|     ← C répond à B
   |<----résultat----|                  |     ← B répond à A
```

- Les **barres verticales** = lignes de vie des acteurs
- Les **rectangles sur une ligne de vie** = période d'activité (traitement en cours)
- `alt / else` = bloc conditionnel (si/sinon)
- `Note over X` = commentaire sur un acteur
- `loop` = répétition
- Flèche **pleine** `—>` = appel synchrone (attend réponse)
- Flèche **pointillée** `-->` = réponse ou appel asynchrone

---

### Comment lire un Use Case

- **Ellipses** = fonctionnalités (ce que le système fait)
- **Bonhommes** = acteurs (qui utilise cette fonctionnalité)
- **Trait plein acteur→UC** = "cet acteur utilise cette fonctionnalité"
- **`<<include>>`** = ce UC inclut obligatoirement un autre (ex: toute action nécessite un login)
- **`<<extend>>`** = ce UC peut optionnellement déclencher un autre
- **Boîtes/subgraphs** = regroupement par domaine

---

### Comment lire un State Machine (Diagramme d'états)

- **`[*]`** = point de départ ou de fin
- **Rectangle arrondi** = un état stable du système
- **Flèche entre états** = transition (déclenchée par un événement)
- **Label sur flèche** = condition ou action qui déclenche la transition
- **`note`** = clarification sur un état

---

### Comment lire un ERD (Entity-Relationship Diagram)

| Notation | Signification |
|---|---|
| `\|\|--o{` | Un (obligatoire) → Plusieurs (optionnel) = **1:N** |
| `\|\|--\|\|` | Un → Un obligatoire = **1:1** |
| `}o--\|\|` | Plusieurs (optionnel) → Un = **N:1** |
| `PK` | Clé primaire — identifiant unique de la table |
| `FK` | Clé étrangère — référence vers une autre table |
| `UK` | Unique Key — valeur unique (mais pas la PK) |

Exemple de lecture : `users ||--o{ kyc_sessions` = **un user peut avoir plusieurs sessions KYC** (mais une session appartient à un seul user).

---

## 3bis. C4 Level 2 — Conteneurs (CORRIGÉ)

> **Corrections apportées :**  
> - Labels Redis clarifiés : rôle distinct API vs Celery  
> - C4 Level 3 simplifié (moins de connexions, lecture améliorée)

```mermaid
graph TB
    subgraph Clients
        Marie["👤 Marie\nPWA Browser"]
        Agents["👤 Jean/Thomas/Sylvie\nDesktop Chrome/Edge"]
    end

    subgraph Docker["🐳 Docker Compose — bicec-veripass"]
        Nginx["🔀 Nginx\nReverse Proxy\nTLS 1.3 · Rate Limit\nporte: 443"]

        PWA["📱 PWA Marie\nReact/TypeScript\nService Worker\nMediaPipe WASM"]

        BO["🖥️ Back-Office SPA\nReact/TypeScript\nJean · Thomas · Sylvie"]

        API["⚡ FastAPI Backend\nPython 3.11\nPaddleOCR · DeepFace\nMiniFASNet"]

        Celery["⚙️ Celery Workers\nPython\nGLM-OCR · SMS · Amplitude\nSanctions sync"]

        PG[("🗄️ PostgreSQL 16\nOLTP + DWH Analytics\nAudit Log · PEP/Sanctions")]

        Redis[("⚡ Redis 7\nBroker Celery\nSessions OTP TTL\nAnti-replay liveness")]

        FS[("📁 Filesystem Volume\n/data/documents\nImages CNI · Selfies · Factures\n10 ans COBAC")]
    end

    subgraph Externe["🌐 Systèmes Externes"]
        Orange["📱 Orange Cameroon\nSMS API\nOTP · Notifications"]
        Amplitude["🏦 Sopra Amplitude\nCore Banking\nProvisioning comptes"]
        Sanctions["📋 OpenSanctions\nUN · EU · OFAC\nSync hebdo batch"]
    end

    Marie -->|"HTTPS 443"| Nginx
    Agents -->|"HTTPS 443"| Nginx
    Nginx -->|"HTTP 3000"| PWA
    Nginx -->|"HTTP 3001"| BO
    Nginx -->|"HTTP 8000"| API

    API -->|"SQL 5432\n(lecture/écriture OLTP)"| PG
    API -->|"Redis GET/SET\n(sessions OTP + anti-replay)"| Redis
    API -->|"Read/Write\n(images + documents)"| FS
    API -->|"PUSH tasks\n(file glm_ocr_jobs, notifications)"| Redis

    Celery -->|"SQL 5432\n(update statuts, logs)"| PG
    Celery -->|"POP tasks\n(consomme queues Celery)"| Redis
    Celery -->|"Read\n(images à traiter)"| FS
    Celery -->|"HTTPS REST\n(envoi SMS OTP)"| Orange
    Celery -->|"HTTPS SOAP/REST\n(provisioning comptes)"| Amplitude
    Celery -->|"HTTPS Download\n(sync hebdo listes)"| Sanctions
```

> **Note Redis :** L'API **pousse** les tâches dans Redis (PUSH/SET). Celery les **consomme** (POP). L'API lit aussi Redis directement pour vérifier les OTP et les tokens anti-replay liveness. Redis joue donc deux rôles distincts : **broker de messages** (pour Celery) et **cache sessions** (pour l'API).

---

### C4 Level 3 — Composants Backend (CORRIGÉ — version simplifiée)

```mermaid
graph LR
    subgraph "FastAPI — Modules"
        AUTH[auth\nOTP · PIN · JWT]
        KYC[kyc\nCapture · State\nMachine · Submit]
        BO_MOD[backoffice\nJean · Thomas\nSylvie]
        AML[aml\nScreening · Conflicts\nAgencies · Batch]
        ANALYTICS[analytics\nFunnel · SLA\nHealth · Events]
        NOTIF[notifications\nPolling · SMS\nEmail]
    end

    subgraph "Services Partagés"
        OCR_SVC[OCR Service\nPaddleOCR primaire\nGLM-OCR fallback]
        BIO_SVC[Biometrics\nMiniFASNet\nDeepFace]
        AUDIT_SVC[Audit Service\nSHA-256\nAppend-only log]
        CORE[Core\nDB Pool · JWT\nbcrypt · Config]
    end

    AUTH --> CORE
    KYC --> OCR_SVC
    KYC --> BIO_SVC
    KYC --> AUDIT_SVC
    KYC --> CORE
    BO_MOD --> AUDIT_SVC
    BO_MOD --> CORE
    AML --> AUDIT_SVC
    AML --> CORE
    ANALYTICS --> CORE
    NOTIF --> CORE
```

---

## 4. Diagramme Use Case (CORRIGÉ)

```mermaid
graph TB
    subgraph "👤 Marie — Onboarding"
        M1[S'inscrire OTP SMS/Email]
        M2[Configurer PIN & Biométrie]
        M3[Capturer CNI Recto/Verso]
        M4[Passer liveness]
        M5[Saisir adresse + GPS optionnel]
        M6[Uploader facture utilitaire]
        M7[Déclarer ou uploader NIU]
        M8[Accepter CGU & Signer digitalement]
        M9[Soumettre dossier KYC]
    end

    subgraph "👤 Marie — Post-Onboarding"
        M10[Suivre état dossier\nen RESTRICTED_ACCESS]
        M11[Explorer services BICEC\nvitrine — plans · cartes · épargne]
        M12[Reprendre session\naprès coupure réseau]
        M13[Contacter support client\nmessagerie in-app]
        M14[Renvoyer documents\nsur demande agent]
        M15[S'authentifier vers\nautres apps BICEC\nAuth Rail ID]
        M16[Utiliser app en\nLIMITED_ACCESS\ndépôts · consultation]
        M17[Utiliser app en\nFULL_ACCESS\ntous services débloqués]
    end

    subgraph "👤 Jean — Validation Desk"
        J1[Se connecter\nEmail/Password]
        J2[Consulter SA queue\nassignée à lui]
        J3[Inspecter dossier\ncomplet soumis]
        J4[Consulter images\nhaut résolution]
        J5[Zoomer sur image\nlibrement]
        J6[Comparer selfie\nvs photo CNI]
        J7[Valider ou corriger\ndonnées OCR inline]
        J8[Approuver le dossier]
        J9[Demander info\ncomplémentaire au client]
        J10[Voir message client\nmessagerie support]
        J11[Répondre au message\nclient + voir PJ]
        J12[Restreindre compte\naprès expiration doc]
        J13[Réapprouver après\nnouvelle soumission]
    end

    subgraph "👤 Thomas — AML/CFT Supervision"
        T1[Se connecter\nEmail/Password]
        T2[Examiner alertes\nPEP/Sanctions]
        T3[Effacer faux positif\navec justification]
        T4[Confirmer match AML\net surveiller compte]
        T5[Résoudre conflits\nd'identité/doublons]
        T6[Gérer agences CRUD]
        T7[Surveiller batch\nAmplitude]
        T8[Relancer batch\nen erreur]
        T9[Provisionner comptes\nAmplitude par batch]
        T10[Suspendre compte\nfraude/doublon confirmé]
    end

    subgraph "👤 Sylvie — Command Center"
        S1[Se connecter\nEmail/Password]
        S2[Dashboard R/Y/G\n30-second scan]
        S3[Analyser funnel\ndrop-off par étape]
        S4[Escalader dossier\nSLA > 2h]
        S5[Redistribuer charge\nentre agents]
        S6[Surveiller santé\nsystème AI/API/DB]
        S7[Exporter pack\nconformité COBAC]
    end

    subgraph "⚙️ Système Automatique"
        SYS1[Scorer dossier\nglobalement]
        SYS2[Allouer dossier\nà une agence\nzone géographique]
        SYS3[Allouer dossier\nà un agent WRR\nLeast Connections]
        SYS4[Détecter doublons\nd'identité]
        SYS5[Déclencher alerte\nSLA 2h dépassé]
        SYS6[Sync PEP/Sanctions\nhebdomadaire]
        SYS7[Backup DB quotidien\n+ prune si disk >85%]
        SYS8[Router message chat\nvers agent responsable\nou agent disponible]
        SYS9[Transmettre chat\navec dossier complet\ndu client]
        SYS10[Notifier expiration\ndocuments actifs]
    end

    Marie --> M1 & M2 & M3 & M4 & M5 & M6 & M7 & M8 & M9
    Marie --> M10 & M11 & M12 & M13 & M14 & M15 & M16 & M17
    Jean --> J1 & J2 & J3 & J4 & J5 & J6 & J7 & J8 & J9 & J10 & J11 & J12 & J13
    Thomas --> T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9 & T10
    Sylvie --> S1 & S2 & S3 & S4 & S5 & S6 & S7
```

---

## 5. State Machine KYC (CORRIGÉ)

> **Corrections majeures :**
> - Distinction claire entre `session_status` (workflow back-office) et `access_level` (expérience Marie dans l'app)
> - RESTRICTED_ACCESS dès la soumission (Marie voit l'app en vitrine immédiatement)
> - PEP = compte actif mais **surveillé** (pas rejeté)
> - DISABLED depuis n'importe quel état actif (fraude/doublon)
> - Expiration document → notification → resoumission → retour état normal
> - Agents demandent info (pas de rejet direct sauf fraude avérée)

```mermaid
stateDiagram-v2
    direction TB

    [*] --> DRAFT : Marie crée session

    note right of DRAFT
        Marie capture CNI, liveness,
        adresse, NIU, consentement
        — tout en local/progressif
    end note

    DRAFT --> LOCKED_LIVENESS : 3 échecs liveness
    LOCKED_LIVENESS --> DRAFT : Clic "Recommencer"\n(cache purgé, nouveau session ID)
    LOCKED_LIVENESS --> [*] : Clic "Aller en agence"

    DRAFT --> PENDING_KYC : Marie soumet le dossier
    DRAFT --> RESTRICTED_ACCESS : [accès app simultané\nvitrine mode activé]

    note right of RESTRICTED_ACCESS
        Dès soumission, Marie peut
        explorer l'app en vitrine :
        consultation, découverte services,
        messagerie support.
        Aucun virement ni carte.
    end note

    PENDING_KYC --> PENDING_INFO : Jean demande\ninfo / nouveau document
    PENDING_INFO --> PENDING_KYC : Marie soumet\nnouveau document (M14)

    PENDING_KYC --> COMPLIANCE_REVIEW : Alerte AML\nauto-détectée

    COMPLIANCE_REVIEW --> PENDING_KYC : Thomas efface\nfaux positif

    COMPLIANCE_REVIEW --> MONITORED : Thomas confirme PEP\n(compte activé mais surveillé)

    COMPLIANCE_REVIEW --> DISABLED : Thomas confirme\nfraude avérée

    PENDING_KYC --> READY_FOR_OPS : Jean approuve le dossier

    READY_FOR_OPS --> PROVISIONING : Thomas lance\nbatch Amplitude

    PROVISIONING --> OPS_ERROR : Erreur technique\nAmplitude
    OPS_ERROR --> PROVISIONING : Thomas retry

    PROVISIONING --> OPS_CORRECTION : Erreur format\nou NIU collision
    OPS_CORRECTION --> PROVISIONING : Thomas corrige + retry

    PROVISIONING --> ACTIVATED_PENDING_AGENCY : Amplitude confirme\ncréation compte\n[système notifie Marie SMS + app]

    ACTIVATED_PENDING_AGENCY --> LIMITED_ACCESS : Jean avait validé\nSANS NIU valide
    ACTIVATED_PENDING_AGENCY --> PRE_FULL_ACCESS : Jean avait validé\nAVEC NIU valide

    note right of ACTIVATED_PENDING_AGENCY
        SMS + notif in-app envoyés :
        "Votre compte est prêt !
        Rendez-vous en agence pour
        signer et récupérer votre carte."
    end note

    PRE_FULL_ACCESS --> FULL_ACCESS : Signature agence\n(wet signature 3x)\n+ activation finale

    LIMITED_ACCESS --> PRE_FULL_ACCESS : Marie uploade NIU\n+ Jean revalide (J13)

    note right of LIMITED_ACCESS
        Dépôts OK, consultation OK.
        Virements, retraits, cartes : BLOQUÉS.
        Banner : "Complétez votre NIU"
    end note

    note right of FULL_ACCESS
        Toutes fonctionnalités débloquées.
        Auth Rail vers BiPay, CRESCO, etc.
    end note

    FULL_ACCESS --> EXPIRY_WARNING : Système détecte\nexpiration document (J12/SYS10)
    EXPIRY_WARNING --> PENDING_RESUBMIT : Jean notifie Marie\n(délai de notice)
    PENDING_RESUBMIT --> FULL_ACCESS : Marie soumet nouveau doc\n+ Jean réapprouve (J13)
    PENDING_RESUBMIT --> RESTRICTED_ACCESS : Délai dépassé\n→ restriction temporaire

    MONITORED --> DISABLED : Thomas confirme\nfraude après surveillance

    FULL_ACCESS --> DISABLED : Thomas suspend\n(fraude / doublon confirmé)
    LIMITED_ACCESS --> DISABLED : Thomas suspend
    RESTRICTED_ACCESS --> DISABLED : Thomas suspend
    MONITORED --> FULL_ACCESS : Surveillance levée\n(PEP non confirmé)
```

---

## 6. Séquences — Corrections & Nouvelles (v2)

### SEQ-02b : Séquence Login — Back-Office (Jean, Thomas, Sylvie)

> **Correction :** Sylvie doit aussi se connecter. Tous les agents partagent la même plateforme, login commun, rôle différent.

```mermaid
sequenceDiagram
    actor Agent as Jean / Thomas / Sylvie
    participant BO as Back-Office SPA
    participant API as FastAPI
    participant PG as PostgreSQL

    Agent->>BO: Ouvre l'URL back-office
    BO->>BO: Vérifie JWT stocké (localStorage chiffré)
    alt JWT valide
        BO->>BO: Redirige vers dashboard selon rôle
    else Pas de JWT / expiré
        BO->>Agent: Affiche écran login (email + password)
        Agent->>BO: Saisit identifiants
        BO->>API: POST /auth/backoffice/login {email, password}
        API->>PG: SELECT agent (email) → compare bcrypt hash
        alt Identifiants valides
            API->>PG: INSERT audit_log (action=LOGIN, agent_id, ip)
            API-->>BO: {access_token, role: JEAN/THOMAS/SYLVIE, agency_id}
            BO->>BO: Stocke JWT
            BO->>BO: Redirige vers dashboard du rôle\n(Jean→Queue, Thomas→AML, Sylvie→Command Center)
        else Identifiants invalides
            API-->>BO: 401 Unauthorized
            BO->>Agent: Message erreur + compteur tentatives
        end
    end
```

---

### SEQ-06 : Messagerie Support — Marie ↔ Jean

```mermaid
sequenceDiagram
    actor Marie
    participant PWA
    participant API as FastAPI
    participant PG as PostgreSQL
    actor Jean

    Note over Marie,Jean: Marie est en RESTRICTED_ACCESS, dossier PENDING_INFO

    Marie->>PWA: Ouvre messagerie support
    PWA->>API: GET /support/threads?session_id={id}
    API->>PG: SELECT messages du thread lié à la session
    API-->>PWA: {thread_id, messages, attachments}
    PWA->>PWA: Affiche historique messages + pièces jointes

    Marie->>PWA: Écrit message + joint nouveau document
    PWA->>API: POST /support/messages {thread_id, text, attachment_b64}
    API->>PG: INSERT message (sender=MARIE, content, attachment_path)
    API->>PG: INSERT notifications (agent_id=jean, type=NEW_MESSAGE)
    API-->>PWA: 200 {message_id}

    Note over API,Jean: [Système route le message vers Jean\n(agent responsable du dossier)\nou agent disponible si Jean absent]

    API->>PG: SELECT dossier_assignment (session_id) → agent responsable
    alt Agent responsable disponible aujourd'hui
        API->>PG: Notif → Jean (agent d'origine)
    else Agent absent toute la journée
        API->>PG: WRR → sélectionne agent disponible
        API->>PG: Notif → nouvel agent assigné
        API->>PG: UPDATE dossier_assignment (agent_id, with_full_dossier=true)
    end

    Jean->>BO: Ouvre notification message
    BO->>API: GET /support/threads/{thread_id}
    API->>PG: SELECT messages + dossier complet du client
    API-->>BO: {messages, dossier_summary, documents_urls}
    BO->>BO: Affiche message + pièces jointes\n+ dossier complet Marie visible en sidebar

    Jean->>BO: Rédige réponse
    BO->>API: POST /support/messages {thread_id, text, sender=JEAN}
    API->>PG: INSERT message (sender=JEAN)
    API->>PG: INSERT notifications (user_id=marie, type=AGENT_REPLY)
    API-->>BO: 200 OK

    Marie->>PWA: [polling 15s] GET /notifications
    API-->>PWA: {type: AGENT_REPLY}
    PWA->>PWA: Affiche nouveau message Jean
```

---

### SEQ-07 : Marie utilise l'App Post-Onboarding (États d'accès)

> **Nouvelle séquence** — manquait dans la v1.

```mermaid
sequenceDiagram
    actor Marie
    participant PWA
    participant API as FastAPI
    participant PG as PostgreSQL

    Marie->>PWA: Ouvre l'app (login PIN / biométrie)
    PWA->>API: POST /auth/pin/verify {user_id, pin_hash}
    API->>PG: SELECT user + kyc_session (access_level)
    API-->>PWA: {access_token, access_level: RESTRICTED/LIMITED/FULL}

    alt access_level = RESTRICTED_ACCESS
        PWA->>PWA: Affiche dashboard VITRINE
        PWA->>PWA: Banner: "⏳ Dossier en cours de validation"
        PWA->>PWA: Fonctionnalités : read-only, plans, cartes verrouillées
        PWA->>PWA: Messagerie support disponible
    else access_level = LIMITED_ACCESS
        PWA->>PWA: Affiche dashboard avec restrictions
        PWA->>PWA: Banner: "⚠️ Complétez votre NIU pour débloquer tout"
        PWA->>PWA: Dépôts : ✅ | Virements, retraits, cartes : 🔒
    else access_level = FULL_ACCESS
        PWA->>PWA: Affiche dashboard complet
        PWA->>PWA: Tous services disponibles
        PWA->>PWA: Auth Rail BICEC actif
    end

    Note over Marie,PWA: Auth Rail — Accès autres apps BICEC

    Marie->>PWA: Clique sur icône "BiPay" dans section apps
    alt App BiPay installée
        PWA->>PWA: Ouvre BiPay avec token d'identité BICEC
    else App non installée
        PWA->>PWA: Redirige vers Play Store / App Store
        Note over PWA: Dans BiPay, Marie se connecte\navec son email/phone + OTP\nAmplitude reconnaît son identité KYC
    end

    Note over Marie,PWA: Polling notifications

    loop Toutes les 15-30s (foreground)
        PWA->>API: GET /notifications?since={last_timestamp}
        API->>PG: SELECT notifications non lues
        API-->>PWA: {notifications: [...]}
        PWA->>PWA: Affiche badge + centre notifications
    end
```

---

### SEQ-08 : Expiration Document — Flow Jean + Marie

```mermaid
sequenceDiagram
    participant SYS as Système (Celery beat)
    participant PG as PostgreSQL
    actor Jean
    participant BO as Back-Office SPA
    actor Marie
    participant PWA

    Note over SYS,PG: [Job cron quotidien — vérification expiration docs]

    SYS->>PG: SELECT sessions FULL_ACCESS\noù doc expiry < NOW() + 30 jours
    PG-->>SYS: Liste sessions concernées
    SYS->>PG: INSERT notifications (agent_id=jean, type=DOC_EXPIRY_WARNING)
    SYS->>PG: UPDATE kyc_session (doc_expiry_flag=true)

    Jean->>BO: Reçoit notification expiration
    BO->>API: GET /backoffice/dossiers/{id}/expiry
    API-->>BO: Détail doc expirant + date limite client

    Jean->>BO: Envoie notice au client
    BO->>API: POST /support/messages {text: "Votre CNI expire le XX, veuillez la renouveler"}
    API->>PG: INSERT notification (user_id=marie, type=DOC_EXPIRY_NOTICE, deadline=30j)

    Marie->>PWA: Reçoit notification expiration
    Note over Marie,PWA: Marie a 30 jours pour soumettre nouveau doc

    alt Marie soumet dans le délai
        Marie->>PWA: Upload nouveau document CNI
        PWA->>API: POST /kyc/capture/cni {session_id, new_doc}
        API->>PG: INSERT document (status=PENDING_REVIEW)
        API->>PG: INSERT notifications (agent_id=jean, type=NEW_DOC_SUBMITTED)
        Jean->>BO: Revoit nouveau document
        BO->>API: POST /backoffice/dossiers/{id}/reapprove
        API->>PG: UPDATE kyc_session (doc_expiry_flag=false, status=FULL_ACCESS)
        API->>PG: INSERT audit_log (action=DOC_REAPPROVED)
    else Délai dépassé
        SYS->>PG: UPDATE user (access_level=RESTRICTED_ACCESS)
        SYS->>PG: INSERT notifications (user_id=marie, type=ACCOUNT_RESTRICTED)
        Note over SYS: Jean peut lever la restriction\naprès nouveau doc validé (J12)
    end
```

---

## Tables/entités supplémentaires identifiées

Ces tables sont à **ajouter** au LDM (section 7.2) :

```sql
-- Messagerie support client ↔ agent
CREATE TABLE support_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES kyc_sessions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'OPEN'  -- OPEN, RESOLVED
);

CREATE TABLE support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES support_threads(id),
    sender_type TEXT NOT NULL,  -- USER, AGENT
    sender_id UUID NOT NULL,    -- user.id ou agent.id
    content TEXT,
    attachment_path TEXT,       -- fichier joint (nouveau doc)
    attachment_sha256 TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Flag expiration documents
-- Ajouter à kyc_sessions :
ALTER TABLE kyc_sessions ADD COLUMN doc_expiry_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE kyc_sessions ADD COLUMN doc_expiry_notified_at TIMESTAMPTZ;
ALTER TABLE kyc_sessions ADD COLUMN doc_expiry_deadline TIMESTAMPTZ;
```

---

*Corrections v2 — 2026-03-02 | À fusionner avec architecture-bicec-veripass v1.0*
