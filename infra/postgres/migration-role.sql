-- migration-role.sql
-- Applied once per agency DB by gen-postgres-init.sh at DB provisioning time.
-- Creates the BYPASSRLS migrations_runner role and grants schema privileges.
--
-- Purpose: T-02-003 mitigation — privilege separation between:
--   - migrations_runner (DDL + BYPASSRLS): used only by Plan 02-03 migration runner
--   - <slug>_user (DML only, RLS enforced): used by app code via PgBouncer
--
-- The migrations_runner role is GLOBAL (shared across all DBs in the Postgres instance).
-- The per-DB grants (GRANT CREATE ON DATABASE ...) are applied per agency DB.
--
-- SEC-09: migrations_runner has BYPASSRLS; per-agency app roles do NOT.
--
-- Env var substitution performed by gen-postgres-init.sh:
--   :MIGRATIONS_DB_PASSWORD  → $MIGRATIONS_DB_PASSWORD (from Doppler / .env)
--   :DB_NAME                 → <slug>_db (per agency)
--   :APP_ROLE                → <slug>_user (per agency)
--
-- Note: MIGRATIONS_DB_PASSWORD uses Doppler-managed value at runtime.
-- Dev placeholder: see .env.example for MIGRATIONS_DB_PASSWORD.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrations_runner') THEN
    CREATE ROLE migrations_runner WITH LOGIN PASSWORD :'MIGRATIONS_DB_PASSWORD' BYPASSRLS;
  END IF;
END$$;

-- Grant DDL on the current database (each invocation runs against one DB)
GRANT CREATE, CONNECT ON DATABASE :"DB_NAME" TO migrations_runner;
GRANT ALL ON SCHEMA public TO migrations_runner;

-- Default privileges so future tables created by migrations_runner are accessible
-- to the per-agency app role after each new migration
ALTER DEFAULT PRIVILEGES FOR ROLE migrations_runner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"APP_ROLE";

ALTER DEFAULT PRIVILEGES FOR ROLE migrations_runner IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO :"APP_ROLE";
