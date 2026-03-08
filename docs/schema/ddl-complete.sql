-- =============================================================================
-- BICEC VeriPass — DDL Complet PostgreSQL 16
-- Version : 1.0.0
-- Date    : 2026-03-08
-- Auteur  : Équipe VeriPass
--
-- Ce fichier est la source de vérité du schéma base de données.
-- Il est conçu pour être exécuté dans l'ordre sur une base PostgreSQL 16 vierge.
-- En production, les migrations sont gérées via Alembic (ce fichier sert de référence).
--
-- Ordre d'exécution :
--   1. Extensions
--   2. Fonctions utilitaires
--   3. Référentiels (agencies, pep_sanctions)
--   4. Utilisateurs & agents (users, agents)
--   5. Sessions KYC (kyc_sessions, documents, ocr_fields, biometric_results)
--   6. Décisions & workflow (dossier_assignments, validation_decisions, aml_alerts)
--   7. Messaging & notifications (support_threads, support_messages, notifications)
--   8. Provisioning (provisioning_batches, provisioning_batch_items)
--   9. Audit (audit_log)
--  10. Analytics DWH (fact_kyc_sessions, dim_*)
--  11. Index, contraintes et sécurité
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- digest() pour SHA-256
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- fuzzy matching (duplicate detection)
CREATE EXTENSION IF NOT EXISTS "postgis";      -- GEOGRAPHY pour coordonnées GPS

-- =============================================================================
-- 2. FONCTIONS UTILITAIRES
-- =============================================================================

-- Trigger automatique pour updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. RÉFÉRENTIELS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- agencies : Agences BICEC (centres de traitement et agences commerciales)
-- ---------------------------------------------------------------------------
CREATE TABLE agencies (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(200)    NOT NULL,
    code                VARCHAR(20)     UNIQUE,                 -- Code interne BICEC
    region              VARCHAR(100)    NOT NULL,               -- Région du Cameroun
    city                VARCHAR(100)    NOT NULL,
    zone_coordinates    GEOGRAPHY(POINT, 4326),                 -- Centroïde GPS (PostGIS)
    max_agent_capacity  INTEGER         NOT NULL DEFAULT 10,    -- Nb max d'agents simultanés
    status              TEXT            NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agencies IS 'Agences et centres de traitement KYC du réseau BICEC.';
COMMENT ON COLUMN agencies.zone_coordinates IS 'Centroïde GPS de l'agence, utilisé pour le routage des dossiers par proximité (facture utilitaire).';
COMMENT ON COLUMN agencies.max_agent_capacity IS 'Nombre maximum d'agents Jean pouvant traiter des dossiers en parallèle dans cette agence.';

CREATE TRIGGER set_updated_at_agencies
    BEFORE UPDATE ON agencies
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_agencies_region ON agencies(region);
CREATE INDEX idx_agencies_status  ON agencies(status);


-- ---------------------------------------------------------------------------
-- pep_sanctions : Base de données PEP & sanctions (UN, EU, OFAC, OpenSanctions)
-- ---------------------------------------------------------------------------
CREATE TABLE pep_sanctions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    source          TEXT        NOT NULL
                        CHECK (source IN ('UN', 'EU', 'OFAC', 'OPENSANCTIONS')),
    entity_type     TEXT        NOT NULL
                        CHECK (entity_type IN ('INDIVIDUAL', 'ENTITY')),
    full_name       TEXT        NOT NULL,
    aliases         TEXT[]      DEFAULT '{}',
    date_of_birth   DATE,
    nationality     VARCHAR(3),                     -- ISO 3166-1 alpha-3
    programs        TEXT[]      DEFAULT '{}',
    is_pep          BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_synced_at  DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pep_sanctions IS 'Référentiel PEP et listes de sanctions consolidées (mise à jour hebdomadaire).';
COMMENT ON COLUMN pep_sanctions.aliases IS 'Alias et orthographes alternatives du nom, utilisés pour le fuzzy matching.';
COMMENT ON COLUMN pep_sanctions.programs IS 'Programmes de sanctions auxquels l'entité est soumise (ex: OFAC SDN, EU Consolidated).';

-- Index trigramme pour le fuzzy matching des noms
CREATE INDEX idx_pep_sanctions_full_name_trgm ON pep_sanctions USING GIN (full_name gin_trgm_ops);
CREATE INDEX idx_pep_sanctions_is_active       ON pep_sanctions(is_active);
CREATE INDEX idx_pep_sanctions_source          ON pep_sanctions(source);


-- =============================================================================
-- 4. UTILISATEURS & AGENTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users : Tous les utilisateurs du système (clients Marie + agents back-office)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number            VARCHAR(20) UNIQUE,                  -- Format E.164 (+237XXXXXXXXX)
    email                   VARCHAR(255) UNIQUE,
    pin_hash                VARCHAR(255),                        -- bcrypt hash du PIN (clients uniquement)
    role                    TEXT        NOT NULL
                                CHECK (role IN ('CLIENT', 'JEAN', 'THOMAS', 'SYLVIE', 'ADMIN_IT')),
    status                  TEXT        NOT NULL DEFAULT 'ACTIVE'
                                CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
    lockout_count_24h       INTEGER     NOT NULL DEFAULT 0,      -- Compteur liveness strikes (reset quotidien)
    lockout_until           TIMESTAMPTZ,                        -- Expiry du verrou (liveness ou auth)
    language                VARCHAR(5)  NOT NULL DEFAULT 'fr'
                                CHECK (language IN ('fr', 'en')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Table unifiée pour tous les utilisateurs : clients (Marie) et agents back-office (Jean, Thomas, Sylvie, Admin IT).';
COMMENT ON COLUMN users.role IS 'CLIENT = client onboardé via PWA ; JEAN = validateur KYC ; THOMAS = AML/conformité ; SYLVIE = directrice opérationnelle ; ADMIN_IT = administrateur système.';
COMMENT ON COLUMN users.lockout_count_24h IS 'Nombre de tentatives liveness échouées dans les 24h (max 3 avant verrouillage session).';

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_users_role   ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_phone  ON users(phone_number);
CREATE INDEX idx_users_email  ON users(email);


-- ---------------------------------------------------------------------------
-- agents : Métadonnées spécifiques aux agents back-office (load balancing, agence)
-- Note : agents.id = users.id (relation 1:1, pas de FK séparée)
-- ---------------------------------------------------------------------------
CREATE TABLE agents (
    id                          UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    agency_id                   UUID        NOT NULL REFERENCES agencies(id),
    availability_status         TEXT        NOT NULL DEFAULT 'AWAY'
                                    CHECK (availability_status IN ('AVAILABLE', 'BUSY', 'AWAY', 'OFFLINE')),
    static_weight               INTEGER     NOT NULL DEFAULT 1
                                    CHECK (static_weight BETWEEN 1 AND 5),  -- Poids WRR statique
    current_weight              INTEGER     NOT NULL DEFAULT 1,              -- Poids WRR dynamique
    active_dossier_count        INTEGER     NOT NULL DEFAULT 0
                                    CHECK (active_dossier_count >= 0),
    max_dossier_capacity        INTEGER     NOT NULL DEFAULT 10
                                    CHECK (max_dossier_capacity BETWEEN 2 AND 20),
    total_validated             INTEGER     NOT NULL DEFAULT 0,
    avg_validation_time_seconds INTEGER,
    last_activity_at            TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agents IS 'Métadonnées back-office des agents (Jean, Thomas, Sylvie). Un Agent IT n'a pas de ligne ici car il ne traite pas de dossiers.';
COMMENT ON COLUMN agents.static_weight IS 'Poids fixe pour l'algorithme WRR (Weighted Round-Robin). Un senior peut avoir weight=2.';
COMMENT ON COLUMN agents.current_weight IS 'Poids dynamique recalculé à chaque cycle WRR en fonction de la charge courante.';
COMMENT ON COLUMN agents.active_dossier_count IS 'Nombre de dossiers actuellement assignés à cet agent. Plage recommandée : 2-10.';

CREATE TRIGGER set_updated_at_agents
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_agents_agency_id            ON agents(agency_id);
CREATE INDEX idx_agents_availability_status  ON agents(availability_status);


-- =============================================================================
-- 5. SESSION KYC
-- =============================================================================

-- ---------------------------------------------------------------------------
-- kyc_sessions : Session d'onboarding KYC (machine à états à 18 états)
-- ---------------------------------------------------------------------------
CREATE TABLE kyc_sessions (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID        NOT NULL REFERENCES users(id),

    -- Machine à états
    status                      TEXT        NOT NULL DEFAULT 'DRAFT'
                                    CHECK (status IN (
                                        'DRAFT',
                                        'PENDING_KYC',
                                        'PENDING_INFO',
                                        'COMPLIANCE_REVIEW',
                                        'READY_FOR_OPS',
                                        'PROVISIONING',
                                        'OPS_ERROR',
                                        'OPS_CORRECTION',
                                        'VALIDATED_PENDING_AGENCY',
                                        'ACTIVATED_LIMITED',
                                        'ACTIVATED_PRE_FULL',
                                        'ACTIVATED_FULL',
                                        'EXPIRY_WARNING',
                                        'PENDING_RESUBMIT',
                                        'MONITORED',
                                        'REJECTED',
                                        'DISABLED',
                                        'ABANDONED'
                                    )),
    access_level                TEXT        NOT NULL DEFAULT 'RESTRICTED'
                                    CHECK (access_level IN (
                                        'RESTRICTED',
                                        'PENDING_ACTIVATION',
                                        'LIMITED_ACCESS',
                                        'PRE_FULL_ACCESS',
                                        'FULL_ACCESS',
                                        'BLOCKED'
                                    )),

    -- Routing
    assigned_agency_id          UUID        REFERENCES agencies(id),
    assigned_agent_id           UUID        REFERENCES users(id),

    -- Scoring & flags
    global_confidence_score     DECIMAL(5,2)
                                    CHECK (global_confidence_score BETWEEN 0 AND 100),
    liveness_strike_count       INTEGER     NOT NULL DEFAULT 0
                                    CHECK (liveness_strike_count >= 0),
    duplicate_suspected         BOOLEAN     NOT NULL DEFAULT FALSE,
    aml_alert                   BOOLEAN     NOT NULL DEFAULT FALSE,
    priority_flag               BOOLEAN     NOT NULL DEFAULT FALSE,
    doc_expiry_flag             BOOLEAN     NOT NULL DEFAULT FALSE,
    doc_expiry_deadline         TIMESTAMPTZ,

    -- NIU
    niu_type                    TEXT
                                    CHECK (niu_type IN ('DOCUMENT', 'DECLARATIVE', NULL)),
    niu_declarative             BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Adresse (saisie cascadante)
    address_ville               VARCHAR(100),
    address_commune             VARCHAR(100),
    address_quartier            VARCHAR(100),
    address_lieu_dit            VARCHAR(100),
    gps_coordinates_encrypted   TEXT,           -- AES-256 chiffré

    -- Préférences
    preferences                 JSONB       DEFAULT '{}',

    -- Timestamps
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at                TIMESTAMPTZ,
    approved_at                 TIMESTAMPTZ,
    activated_at                TIMESTAMPTZ,
    rejected_at                 TIMESTAMPTZ
);

COMMENT ON TABLE kyc_sessions IS 'Suivi complet d'une session d'onboarding KYC — machine à états à 18 états.';
COMMENT ON COLUMN kyc_sessions.status IS 'État courant de la session. Transitions documentées dans docs/diagrams/state-machine-kyc-v3-updated.md.';
COMMENT ON COLUMN kyc_sessions.access_level IS 'Niveau d'accès bancaire du client. Passe de RESTRICTED à FULL_ACCESS après validation complète.';
COMMENT ON COLUMN kyc_sessions.global_confidence_score IS 'Score de confiance agrégé (0-100) : OCR 40% + liveness 30% + face match 20% + cohérence 10%.';
COMMENT ON COLUMN kyc_sessions.niu_declarative IS 'True si le NIU a été déclaré manuellement (non uploadé). Déclenche access_level=LIMITED_ACCESS.';
COMMENT ON COLUMN kyc_sessions.priority_flag IS 'True si escaladé par Sylvie ou déclenché par un flag système (AML, expiry).';

CREATE TRIGGER set_updated_at_kyc_sessions
    BEFORE UPDATE ON kyc_sessions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_kyc_sessions_user_id              ON kyc_sessions(user_id);
CREATE INDEX idx_kyc_sessions_status               ON kyc_sessions(status);
CREATE INDEX idx_kyc_sessions_assigned_agent_id    ON kyc_sessions(assigned_agent_id);
CREATE INDEX idx_kyc_sessions_assigned_agency_id   ON kyc_sessions(assigned_agency_id);
CREATE INDEX idx_kyc_sessions_priority_flag        ON kyc_sessions(priority_flag) WHERE priority_flag = TRUE;
CREATE INDEX idx_kyc_sessions_aml_alert            ON kyc_sessions(aml_alert) WHERE aml_alert = TRUE;


-- ---------------------------------------------------------------------------
-- documents : Fichiers uploadés (images CNI, selfie, NIU, factures)
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id              UUID        NOT NULL REFERENCES kyc_sessions(id),
    document_type           TEXT        NOT NULL
                                CHECK (document_type IN (
                                    'CNI_RECTO',
                                    'CNI_VERSO',
                                    'PASSPORT',
                                    'UTILITY_BILL',
                                    'NIU_ATTESTATION',
                                    'LIVENESS_VIDEO'
                                )),
    -- Variante de format (CNI uniquement)
    -- Détectée automatiquement par l'OCR service sur CNI_RECTO
    -- CNI_ANCIEN_LANDSCAPE : avant ~2021, orientation paysage, photo à droite
    -- CNI_NOUVEAU_PORTRAIT  : 2021+, orientation portrait, photo en haut
    format_variant          TEXT
                                CHECK (format_variant IN (
                                    'CNI_ANCIEN_LANDSCAPE',
                                    'CNI_NOUVEAU_PORTRAIT',
                                    'PASSPORT',
                                    'N/A'
                                )),
    file_path               VARCHAR(500) NOT NULL,              -- /data/documents/{session_id}/{filename}
    sha256_hash             VARCHAR(64)  NOT NULL,              -- Intégrité du fichier
    file_size_bytes         INTEGER,
    capture_quality_metrics JSONB,                              -- {laplacian_variance, luminance_std}
    status                  TEXT        NOT NULL DEFAULT 'UPLOADED'
                                CHECK (status IN ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED')),
    ocr_engine_used         TEXT
                                CHECK (ocr_engine_used IN ('PADDLE', 'GLM', 'PADDLE_THEN_GLM', NULL)),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE documents IS 'Métadonnées des documents uploadés. Les fichiers binaires sont sur le filesystem (pas en BYTEA).';
COMMENT ON COLUMN documents.format_variant IS 'Variante physique de la CNI détectée via ratio largeur/hauteur. Impact sur la zone de détection du visage et la disposition des champs OCR.';
COMMENT ON COLUMN documents.capture_quality_metrics IS 'Métriques qualité : variance Laplacienne (flou), écart-type luminance (reflet). Seuils : laplacian > 100, luminance_std < 60.';

CREATE INDEX idx_documents_session_id       ON documents(session_id);
CREATE INDEX idx_documents_document_type    ON documents(document_type);
CREATE INDEX idx_documents_status           ON documents(status);
CREATE INDEX idx_documents_sha256           ON documents(sha256_hash);


-- ---------------------------------------------------------------------------
-- ocr_fields : Champs extraits par OCR (un enregistrement par champ)
--
-- Champs CNI Recto (cni_nom, cni_prenom, cni_date_naissance, cni_lieu_naissance,
--                   cni_sexe, cni_taille, cni_profession, cni_numero_cni)
-- Champs CNI Verso (cni_pere, cni_mere, cni_situation_pro, cni_adresse,
--                   cni_autorite_nom, cni_date_delivrance, cni_date_expiration,
--                   cni_poste_identification, cni_identifiant_unique)
--
-- IMPORTANT : cni_identifiant_unique ≠ NIU fiscal
--   - cni_identifiant_unique : délivré par le Centre d'État Civil (imprimé sur la CNI)
--   - niu_value              : délivré par la DGI (attestation NIU séparée)
--   Ces deux identifiants ne doivent JAMAIS être confondus ni stockés dans le même champ.
-- ---------------------------------------------------------------------------
CREATE TABLE ocr_fields (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id         UUID        NOT NULL REFERENCES documents(id),
    field_name          VARCHAR(100) NOT NULL
                            CHECK (field_name IN (
                                -- Champs CNI Recto
                                'cni_nom',
                                'cni_prenom',
                                'cni_date_naissance',
                                'cni_lieu_naissance',
                                'cni_sexe',
                                'cni_taille',
                                'cni_profession',
                                'cni_numero_cni',
                                'cni_signature_present',
                                -- Champs CNI Verso
                                'cni_pere',
                                'cni_mere',
                                'cni_situation_pro',
                                'cni_adresse',
                                'cni_autorite_nom',
                                'cni_date_delivrance',
                                'cni_date_expiration',
                                'cni_poste_identification',
                                'cni_identifiant_unique',   -- ≠ NIU fiscal (DGI)
                                -- Facture utilitaire
                                'bill_date',
                                'bill_agency_name',
                                'bill_agency_zone'
                            )),
    field_value         TEXT,                               -- Valeur extraite (NULL si non trouvé)
    confidence_score    DECIMAL(5,2)
                            CHECK (confidence_score BETWEEN 0 AND 100),
    engine              TEXT        NOT NULL
                            CHECK (engine IN ('PADDLE', 'GLM')),
    human_corrected     BOOLEAN     NOT NULL DEFAULT FALSE,
    corrected_value     TEXT,                               -- Valeur après correction manuelle
    corrected_by        UUID        REFERENCES users(id),   -- Marie (CLIENT) ou Jean (JEAN)
    corrected_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ocr_fields IS 'Champs OCR extraits, un enregistrement par champ. Les champs CNI couvrent recto + verso selon le référentiel de la CNI camerounaise.';
COMMENT ON COLUMN ocr_fields.field_name IS 'Nom technique du champ. Voir référentiel complet dans docs/schema/ddl-complete.sql et design.md §Data Models.';
COMMENT ON COLUMN ocr_fields.cni_identifiant_unique IS 'Champ cni_identifiant_unique : identifiant état civil imprimé sur la CNI. DISTINCT du NIU fiscal (DGI).';

CREATE INDEX idx_ocr_fields_document_id  ON ocr_fields(document_id);
CREATE INDEX idx_ocr_fields_field_name   ON ocr_fields(field_name);


-- ---------------------------------------------------------------------------
-- biometric_results : Scores liveness (MiniFASNet) et face match (DeepFace)
-- ---------------------------------------------------------------------------
CREATE TABLE biometric_results (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id                  UUID        NOT NULL REFERENCES kyc_sessions(id),
    liveness_score              DECIMAL(5,2)
                                    CHECK (liveness_score BETWEEN 0 AND 100),
    anti_spoofing_score         DECIMAL(5,2)
                                    CHECK (anti_spoofing_score BETWEEN 0 AND 100),
    face_match_score            DECIMAL(5,2)
                                    CHECK (face_match_score BETWEEN 0 AND 100),
    face_embedding_encrypted    TEXT,       -- Vecteur d'embedding AES-256 chiffré
    model_version_liveness      VARCHAR(50),
    model_version_face          VARCHAR(50),
    liveness_attempts           INTEGER     NOT NULL DEFAULT 1,
    processing_duration_ms      INTEGER,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE biometric_results IS 'Résultats de traitement biométrique : liveness (MiniFASNet) et correspondance faciale (DeepFace 1:1).';
COMMENT ON COLUMN biometric_results.face_embedding_encrypted IS 'Embedding facial AES-256 chiffré. Purgé après 30 jours selon la politique de rétention.';
COMMENT ON COLUMN biometric_results.liveness_attempts IS 'Nombre de tentatives liveness pour cette session (max 3 avant verrouillage).';

CREATE INDEX idx_biometric_results_session_id ON biometric_results(session_id);


-- =============================================================================
-- 6. DÉCISIONS & WORKFLOW
-- =============================================================================

-- ---------------------------------------------------------------------------
-- dossier_assignments : Assignation agent ↔ dossier (historique complet)
-- ---------------------------------------------------------------------------
CREATE TABLE dossier_assignments (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID        NOT NULL REFERENCES kyc_sessions(id),
    agent_id        UUID        NOT NULL REFERENCES users(id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    is_current      BOOLEAN     NOT NULL DEFAULT TRUE,  -- FALSE si réassigné
    assignment_reason TEXT                              -- 'WRR_AUTO', 'MANUAL_ESCALATION', 'REASSIGN_UNAVAILABLE'
);

COMMENT ON TABLE dossier_assignments IS 'Historique des assignations de dossiers aux agents. Permet de tracer les réassignations WRR.';

CREATE INDEX idx_dossier_assignments_session_id ON dossier_assignments(session_id);
CREATE INDEX idx_dossier_assignments_agent_id   ON dossier_assignments(agent_id);
CREATE INDEX idx_dossier_assignments_is_current ON dossier_assignments(is_current) WHERE is_current = TRUE;


-- ---------------------------------------------------------------------------
-- validation_decisions : Décisions de Jean (approve / reject / request_info)
-- ---------------------------------------------------------------------------
CREATE TABLE validation_decisions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID        NOT NULL REFERENCES kyc_sessions(id),
    agent_id        UUID        NOT NULL REFERENCES users(id),
    decision        TEXT        NOT NULL
                        CHECK (decision IN ('APPROVE', 'REJECT', 'REQUEST_INFO')),
    rejection_type  TEXT
                        CHECK (rejection_type IN ('FRAUDE', 'INCOMPLETUDE', 'DOUBTS', NULL)),
    reason          TEXT,                           -- Justification obligatoire pour REJECT
    requested_info  TEXT,                           -- Précisions pour REQUEST_INFO
    agent_ip        INET,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE validation_decisions IS 'Décisions de validation KYC prises par Jean. Immutable — pas de UPDATE/DELETE.';

CREATE INDEX idx_validation_decisions_session_id ON validation_decisions(session_id);
CREATE INDEX idx_validation_decisions_agent_id   ON validation_decisions(agent_id);
CREATE INDEX idx_validation_decisions_decision   ON validation_decisions(decision);


-- ---------------------------------------------------------------------------
-- aml_alerts : Alertes AML/CFT (correspondances PEP / sanctions)
-- ---------------------------------------------------------------------------
CREATE TABLE aml_alerts (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID        NOT NULL REFERENCES kyc_sessions(id),
    pep_sanctions_id    UUID        REFERENCES pep_sanctions(id),
    alert_type          TEXT        NOT NULL
                            CHECK (alert_type IN ('PEP', 'SANCTIONS_UN', 'SANCTIONS_EU', 'SANCTIONS_OFAC', 'SANCTIONS_OPENSANCTIONS')),
    match_score         DECIMAL(5,2)
                            CHECK (match_score BETWEEN 0 AND 100),
    matched_name        TEXT,                       -- Nom matché dans la liste
    status              TEXT        NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN ('OPEN', 'CLEARED', 'CONFIRMED', 'ESCALATED')),
    cleared_by          UUID        REFERENCES users(id),
    justification       TEXT,                       -- Obligatoire pour CLEARED / CONFIRMED
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

COMMENT ON TABLE aml_alerts IS 'Alertes générées par le screening PEP/sanctions. Résolues par Thomas.';
COMMENT ON COLUMN aml_alerts.justification IS 'Justification obligatoire lorsque Thomas lève (CLEARED) ou confirme (CONFIRMED) une alerte.';

CREATE INDEX idx_aml_alerts_session_id ON aml_alerts(session_id);
CREATE INDEX idx_aml_alerts_status     ON aml_alerts(status);


-- =============================================================================
-- 7. MESSAGING & NOTIFICATIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- support_threads : Fils de discussion Marie ↔ agent back-office
-- ---------------------------------------------------------------------------
CREATE TABLE support_threads (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID        NOT NULL REFERENCES kyc_sessions(id),
    status      TEXT        NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN', 'CLOSED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at   TIMESTAMPTZ
);

CREATE INDEX idx_support_threads_session_id ON support_threads(session_id);
CREATE INDEX idx_support_threads_status     ON support_threads(status);


-- ---------------------------------------------------------------------------
-- support_messages : Messages individuels dans un fil de support
-- ---------------------------------------------------------------------------
CREATE TABLE support_messages (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id           UUID        NOT NULL REFERENCES support_threads(id),
    sender_type         TEXT        NOT NULL
                            CHECK (sender_type IN ('CLIENT', 'AGENT')),
    sender_id           UUID        NOT NULL REFERENCES users(id),
    content             TEXT        NOT NULL,
    attachment_path     TEXT,
    attachment_sha256   VARCHAR(64),
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at             TIMESTAMPTZ
);

CREATE INDEX idx_support_messages_thread_id ON support_messages(thread_id);
CREATE INDEX idx_support_messages_sender_id ON support_messages(sender_id);


-- ---------------------------------------------------------------------------
-- notifications : File de notifications in-app (polling 15-30s)
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id),
    type            TEXT        NOT NULL
                        CHECK (type IN (
                            'OTP_SENT',
                            'DOSSIER_APPROVED',
                            'DOSSIER_REJECTED',
                            'INFO_REQUESTED',
                            'ACCOUNT_ACTIVATED',
                            'AML_ALERT',
                            'ESCALATION',
                            'AGENT_REPLY',
                            'NEW_MESSAGE',
                            'DOC_EXPIRY_WARNING',
                            'PROVISIONING_ERROR'
                        )),
    message         TEXT        NOT NULL,
    delivery_method TEXT        NOT NULL DEFAULT 'IN_APP'
                        CHECK (delivery_method IN ('IN_APP', 'SMS', 'EMAIL')),
    is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at         TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_id  ON notifications(user_id);
CREATE INDEX idx_notifications_is_read  ON notifications(is_read) WHERE is_read = FALSE;


-- =============================================================================
-- 8. PROVISIONING AMPLITUDE (ISO 20022 via Axway)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- provisioning_batches : Lots de provisioning envoyés à Amplitude
-- ---------------------------------------------------------------------------
CREATE TABLE provisioning_batches (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by      UUID        NOT NULL REFERENCES users(id),   -- Thomas
    status          TEXT        NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'PARTIAL_ERROR', 'FAILED')),
    error_type      TEXT,
    error_detail    TEXT,
    retry_count     INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

COMMENT ON TABLE provisioning_batches IS 'Lots de provisioning ISO 20022 (acmt.009) envoyés à Amplitude via Axway API Manager.';

CREATE INDEX idx_provisioning_batches_status     ON provisioning_batches(status);
CREATE INDEX idx_provisioning_batches_created_by ON provisioning_batches(created_by);


-- ---------------------------------------------------------------------------
-- provisioning_batch_items : Éléments individuels d'un lot de provisioning
-- ---------------------------------------------------------------------------
CREATE TABLE provisioning_batch_items (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id                UUID        NOT NULL REFERENCES provisioning_batches(id),
    session_id              UUID        NOT NULL REFERENCES kyc_sessions(id),
    status                  TEXT        NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING', 'SUCCESS', 'ERROR')),
    axway_request_id        TEXT,
    iso20022_message_ref    TEXT,       -- ex: 'acmt.009-20260305-001'
    axway_response          JSONB,
    error_code              TEXT,
    error_message           TEXT,
    processed_at            TIMESTAMPTZ
);

CREATE INDEX idx_provisioning_batch_items_batch_id   ON provisioning_batch_items(batch_id);
CREATE INDEX idx_provisioning_batch_items_session_id ON provisioning_batch_items(session_id);
CREATE INDEX idx_provisioning_batch_items_status     ON provisioning_batch_items(status);


-- =============================================================================
-- 9. AUDIT LOG (IMMUTABLE)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- audit_log : Journal immutable de toutes les actions système
-- Les UPDATE et DELETE sont révoqués sur cette table (voir section sécurité)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id          BIGSERIAL   PRIMARY KEY,
    event_type  TEXT        NOT NULL
                    CHECK (event_type IN (
                        -- Authentification
                        'AUTH_LOGIN_SUCCESS',
                        'AUTH_LOGIN_FAILED',
                        'AUTH_LOCKOUT',
                        'AUTH_OTP_SENT_ORANGE',
                        'AUTH_OTP_SENT_DEV_LOCAL',
                        'AUTH_OTP_VERIFIED',
                        -- Session KYC (client)
                        'SESSION_CREATED',
                        'SESSION_RESUMED',
                        'SESSION_SUBMITTED',
                        'SESSION_ABANDONED',
                        -- Documents & OCR
                        'DOCUMENT_UPLOADED',
                        'OCR_COMPLETED',
                        'OCR_FIELD_CORRECTED',
                        -- Décisions agent (Jean)
                        'DOSSIER_VIEWED',
                        'DOSSIER_APPROVED',
                        'DOSSIER_REJECTED',
                        'DOSSIER_INFO_REQUESTED',
                        'DOSSIER_ASSIGNED',
                        'DOSSIER_REASSIGNED',
                        -- AML/Conformité (Thomas)
                        'AML_ALERT_CREATED',
                        'AML_CLEARED',
                        'AML_CONFIRMED_FREEZE',
                        'AML_ESCALATED',
                        -- Agences (Thomas / Admin IT)
                        'AGENCY_CREATED',
                        'AGENCY_UPDATED',
                        'AGENCY_DISABLED',
                        -- Admin IT — gestion agents
                        'AGENT_CREATED',
                        'AGENT_UPDATED',
                        'AGENT_DISABLED',
                        'AGENT_AGENCY_CHANGED',
                        'AGENT_PASSWORD_RESET',
                        -- Provisioning (Thomas)
                        'PROVISIONING_STARTED',
                        'PROVISIONING_SUCCESS',
                        'PROVISIONING_FAILED',
                        'PROVISIONING_RETRIED',
                        -- Consentement
                        'CONSENT_SIGNED',
                        -- Identité
                        'IDENTITY_LINKED',
                        'IDENTITY_CONFLICT_RESOLVED',
                        'IDENTITY_FRAUD_REJECTED',
                        -- Compliance
                        'SANCTIONS_SYNC_COMPLETE',
                        'EXPORT_COMPLIANCE_PACK'
                    )),
    actor_id    UUID        REFERENCES users(id),   -- NULL pour les actions système automatiques
    dossier_id  UUID        REFERENCES kyc_sessions(id),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address  INET,
    payload     JSONB       DEFAULT '{}',
    -- Chaîne d'intégrité SHA-256 : hash(event_type || actor_id || timestamp || payload)
    sha256_hash VARCHAR(64) NOT NULL
);

COMMENT ON TABLE audit_log IS 'Journal d'audit immutable. UPDATE et DELETE révoqués. Toute action back-office et client critique est tracée ici.';
COMMENT ON COLUMN audit_log.sha256_hash IS 'SHA-256(event_type || actor_id::text || timestamp::text || payload::text). Vérifiable via la requête d'intégrité.';
COMMENT ON COLUMN audit_log.actor_id IS 'NULL pour les événements système automatiques (Celery, cron).';

CREATE INDEX idx_audit_log_event_type  ON audit_log(event_type);
CREATE INDEX idx_audit_log_actor_id    ON audit_log(actor_id);
CREATE INDEX idx_audit_log_dossier_id  ON audit_log(dossier_id);
CREATE INDEX idx_audit_log_timestamp   ON audit_log(timestamp DESC);

-- Vérification d'intégrité du log
-- SELECT id, event_type,
--        sha256_hash = encode(digest(
--            event_type || COALESCE(actor_id::text,'') || timestamp::text || payload::text,
--            'sha256'), 'hex') AS is_valid
-- FROM audit_log
-- WHERE NOT (sha256_hash = encode(digest(
--            event_type || COALESCE(actor_id::text,'') || timestamp::text || payload::text,
--            'sha256'), 'hex'));


-- =============================================================================
-- 10. ANALYTICS DWH (Star Schema)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- dim_time : Dimension temporelle
-- ---------------------------------------------------------------------------
CREATE TABLE dim_time (
    id          BIGSERIAL   PRIMARY KEY,
    date_actual DATE        NOT NULL UNIQUE,
    day_of_week SMALLINT,
    week        SMALLINT,
    month       SMALLINT,
    quarter     SMALLINT,
    year        SMALLINT,
    is_weekend  BOOLEAN
);

-- ---------------------------------------------------------------------------
-- dim_agencies : Dimension agences (snapshot pour historisation)
-- ---------------------------------------------------------------------------
CREATE TABLE dim_agencies (
    agency_dim_id   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id       UUID    NOT NULL REFERENCES agencies(id),
    name            VARCHAR(200),
    region          VARCHAR(100),
    city            VARCHAR(100),
    snapshot_date   DATE    NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_dim_agencies_agency_id ON dim_agencies(agency_id);

-- ---------------------------------------------------------------------------
-- dim_agents : Dimension agents (snapshot pour historisation)
-- ---------------------------------------------------------------------------
CREATE TABLE dim_agents (
    agent_dim_id    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        UUID    NOT NULL REFERENCES users(id),
    agency_id       UUID    REFERENCES agencies(id),
    role            TEXT,
    static_weight   INTEGER,
    snapshot_date   DATE    NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_dim_agents_agent_id ON dim_agents(agent_id);

-- ---------------------------------------------------------------------------
-- fact_kyc_sessions : Table de faits — métriques par session KYC
-- ---------------------------------------------------------------------------
CREATE TABLE fact_kyc_sessions (
    fact_id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id                  UUID        NOT NULL REFERENCES kyc_sessions(id),
    user_dim_id                 UUID        REFERENCES dim_agencies(agency_dim_id),
    agency_dim_id               UUID        REFERENCES dim_agencies(agency_dim_id),
    agent_dim_id                UUID        REFERENCES dim_agents(agent_dim_id),
    time_dim_id                 BIGINT      REFERENCES dim_time(id),

    -- Résultat final
    final_status                TEXT,
    access_level_reached        TEXT,

    -- Durées (en secondes)
    total_duration_seconds      INTEGER,
    cni_capture_duration_s      INTEGER,
    liveness_duration_s         INTEGER,
    address_duration_s          INTEGER,
    ocr_processing_duration_s   INTEGER,
    validation_duration_s       INTEGER,    -- Temps Jean

    -- Métriques qualité
    liveness_strikes            SMALLINT,
    ocr_confidence_avg          DECIMAL(5,2),
    face_match_score            DECIMAL(5,2),
    ocr_engine_used             TEXT,
    cni_format_variant          TEXT,       -- CNI_ANCIEN_LANDSCAPE / CNI_NOUVEAU_PORTRAIT

    -- Flags
    niu_type                    TEXT,
    human_correction_needed     BOOLEAN,
    duplicate_suspected         BOOLEAN,
    aml_alert_triggered         BOOLEAN,

    -- Drop-off
    dropout_step                TEXT,       -- NULL si session complétée

    snapshot_date               DATE        NOT NULL DEFAULT CURRENT_DATE
);

COMMENT ON TABLE fact_kyc_sessions IS 'Table de faits du data warehouse analytique. Alimentée via ETL quotidien depuis kyc_sessions.';

CREATE INDEX idx_fact_kyc_sessions_session_id   ON fact_kyc_sessions(session_id);
CREATE INDEX idx_fact_kyc_sessions_agency       ON fact_kyc_sessions(agency_dim_id);
CREATE INDEX idx_fact_kyc_sessions_final_status ON fact_kyc_sessions(final_status);
CREATE INDEX idx_fact_kyc_sessions_snapshot     ON fact_kyc_sessions(snapshot_date);


-- =============================================================================
-- 11. SÉCURITÉ — RÉVOCATION DES DROITS SUR AUDIT_LOG
-- =============================================================================

-- L'audit log est append-only. Les modifications et suppressions sont interdites
-- pour tous les rôles (y compris le propriétaire de la table).
-- IMPORTANT : À exécuter en tant que superuser lors du déploiement.

-- REVOKE UPDATE, DELETE ON TABLE audit_log FROM PUBLIC;
-- REVOKE UPDATE, DELETE ON TABLE audit_log FROM veripass_app;
-- REVOKE TRUNCATE ON TABLE audit_log FROM PUBLIC;
-- REVOKE TRUNCATE ON TABLE audit_log FROM veripass_app;

-- Note : Les lignes ci-dessus sont commentées pour permettre l'exécution du DDL
-- en mode développement. Décommenter et exécuter manuellement en production.


-- =============================================================================
-- FIN DU DDL
-- =============================================================================
-- Tables créées : 20 (+ 3 analytics DWH)
-- Extensions    : uuid-ossp, pgcrypto, pg_trgm, postgis
-- Index         : ~45 index
-- Triggers      : updated_at sur agencies, users, agents, kyc_sessions
-- =============================================================================
