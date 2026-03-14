-- Database initialization script for bicec-veripass

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The vp_user is created by the environment variables in docker-compose.yml
-- Here we grant additional permissions if needed, but the default 
-- POSTGRES_USER in the image will own the database.

-- Table append-only for audit log (as specified in §11.3)
-- We'll just create the table structure here, partitions might need dynamic SQL or script setup
CREATE TABLE IF NOT EXISTS audit_log (
    id             BIGSERIAL PRIMARY KEY,
    table_name     TEXT NOT NULL,
    record_id      TEXT NOT NULL,
    action         TEXT NOT NULL,
    old_data       JSONB,
    new_data       JSONB,
    changed_fields TEXT,
    performed_by   TEXT NOT NULL,
    performed_at   TIMESTAMPTZ DEFAULT NOW(),
    client_ip      INET
);

-- Note: Partitioning logic can be added later as the volume grows.
