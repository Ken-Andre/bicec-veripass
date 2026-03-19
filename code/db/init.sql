-- Database initialization script for bicec-veripass
-- NOTE: Les tables sont créées et gérées par Alembic.
-- Ce fichier gère uniquement les extensions et les fonctions/triggers.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- PostGIS (optionnel, commenter si non disponible dans l'image)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- Fonction trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at (créés après les tables par Alembic)
-- Ces triggers sont idempotents grâce à DROP IF EXISTS
CREATE OR REPLACE FUNCTION create_updated_at_triggers()
RETURNS void AS $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY['users', 'agents', 'kyc_sessions', 'agencies'];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
            EXECUTE format('
                DROP TRIGGER IF EXISTS set_updated_at ON %I;
                CREATE TRIGGER set_updated_at
                    BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
            ', tbl, tbl);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
