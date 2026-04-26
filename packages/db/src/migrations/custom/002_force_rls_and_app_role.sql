-- 002_force_rls_and_app_role.sql
-- Apply order: AFTER 001_agency_id_immutable.sql
-- Purpose: Apply FORCE ROW LEVEL SECURITY to all agency-scoped tables,
--          revoke UPDATE/DELETE on audit_log, and grant DML to per-agency app role.
--
-- FORCE ROW LEVEL SECURITY (pitfall 8.4 mitigation):
--   Without FORCE, the table owner (migrations_runner) bypasses RLS silently.
--   Integration tests run as <slug>_user, which IS subject to RLS — but during
--   development if a table owner connection is used accidentally, policies are skipped.
--   FORCE ensures even the table owner must satisfy RLS policies, making test
--   results representative of production behavior.
--
-- audit_log append-only enforcement (pitfall 8.8 mitigation):
--   RLS on audit_log would cause a circular dependency: the audit trigger fires
--   when INSERT/UPDATE/DELETE happens, but the trigger itself tries to insert
--   into audit_log, which then checks RLS again. To avoid this, audit_log has
--   NO RLS. Instead, we REVOKE UPDATE/DELETE from PUBLIC so the app role can
--   only INSERT (append) to audit_log.
--
-- Template substitution:
--   This file uses :'app_role' as a placeholder for the per-agency role name
--   (e.g., brand_user, ecommerce_user, etc.).
--   The Plan 02-03 migration runner performs regex substitution before applying:
--     Replace :'app_role' with the actual slug_user role name.
--   This avoids psql variable syntax which is not supported by drizzle-orm migrator.

BEGIN;

-- ============================================================
-- FORCE ROW LEVEL SECURITY on agency-scoped tables
-- ============================================================
-- Drizzle's enableRLS() emits ENABLE ROW LEVEL SECURITY.
-- FORCE is a separate DDL command that cannot be expressed in Drizzle schema.
-- Applied here to ensure the table owner (migrations_runner with BYPASSRLS)
-- is NOT exempt from policies during ad-hoc queries.

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE permissions_vault FORCE ROW LEVEL SECURITY;

-- audit_log: NO RLS (pitfall 8.8) — append-only via REVOKE instead
-- agencies: NO RLS — bootstrap data, enforced at app layer (super_admin only)
-- _seed_state: NO RLS — no agency_id column, internal bookkeeping

-- ============================================================
-- audit_log: append-only enforcement
-- ============================================================
-- Revoke UPDATE and DELETE from PUBLIC so the per-agency app role cannot modify
-- or delete audit records. INSERT remains (app role can append audit entries).
-- Plan 02-06 will wire the SECURITY DEFINER trigger that inserts into audit_log.

REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- ============================================================
-- Per-agency DML grants for app role
-- ============================================================
-- Grant SELECT, INSERT, UPDATE, DELETE on all agency-scoped tables to the app role.
-- audit_log: only INSERT (UPDATE/DELETE revoked above from PUBLIC).
-- agencies: SELECT only — the app role should not modify the agencies registry.
--
-- NOTE: :'app_role' is a template placeholder.
-- Plan 02-03 migration runner substitutes this with the actual role before applying.
-- For direct psql application: psql -v app_role=brand_user -f this_file.sql

GRANT SELECT, INSERT, UPDATE, DELETE ON users TO :'app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO :'app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON permissions_vault TO :'app_role';
GRANT INSERT ON audit_log TO :'app_role';
GRANT SELECT ON agencies TO :'app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON _seed_state TO :'app_role';

-- Sequence grants for bigserial audit_log.id
GRANT USAGE ON SEQUENCE audit_log_id_seq TO :'app_role';

COMMIT;
