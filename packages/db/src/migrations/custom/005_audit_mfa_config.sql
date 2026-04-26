-- packages/db/src/migrations/custom/005_audit_mfa_config.sql
--
-- Plan 03-02 — adds:
--   1. agency_id immutability trigger (mirrors 001 pattern)
--   2. FORCE ROW LEVEL SECURITY (mirrors 002 pattern)
--   3. capture_audit_row() per-table trigger (mirrors 003 pattern)
--   4. App-role DML grants
--
-- Idempotency: DROP TRIGGER IF EXISTS preceding each CREATE TRIGGER.
--
-- Prerequisites (must be applied before this file):
--   - 0001_mfa_config.sql (creates mfa_config table + RLS enable + policy)
--   - 001_agency_id_immutable.sql (defines prevent_agency_id_change() function)
--   - 002_force_rls_and_app_role.sql (defines app role + FORCE RLS pattern)
--   - 003_audit_triggers.sql (defines capture_audit_row() function)

BEGIN;

-- 1) agency_id immutability
--    Prevents updates to the agency_id column after insert (same pattern as all
--    agency-scoped tables — prevent_agency_id_change() defined in migration 001).
DROP TRIGGER IF EXISTS enforce_agency_id_immutable ON mfa_config;
CREATE TRIGGER enforce_agency_id_immutable
  BEFORE UPDATE OF agency_id ON mfa_config
  FOR EACH ROW EXECUTE FUNCTION prevent_agency_id_change();

-- 2) FORCE RLS
--    Even the table owner (migrations_runner) must satisfy RLS policies.
--    Without FORCE, migrations_runner silently bypasses RLS during integration tests
--    (pitfall 8.4 from Phase 2 RESEARCH). Mirrors 002_force_rls_and_app_role.sql pattern.
ALTER TABLE mfa_config FORCE ROW LEVEL SECURITY;

-- 3) Audit trigger
--    capture_audit_row() defined in 003_audit_triggers.sql (Plan 02-06).
--    Fires AFTER INSERT/UPDATE/DELETE — captures old_row/new_row to audit_log.
--    Plan 03-06 audit emit covers MFA enable/disable/recovery-use events.
DROP TRIGGER IF EXISTS audit_mfa_config ON mfa_config;
CREATE TRIGGER audit_mfa_config
  AFTER INSERT OR UPDATE OR DELETE ON mfa_config
  FOR EACH ROW EXECUTE FUNCTION capture_audit_row();

-- 4) App-role DML grants — :'app_role' substituted by apply-custom.ts to <slug>_user
--    The <slug>_user role is the application role used for all DML (never migrations_runner).
--    Migration 002 creates the role; this grant allows it to read/write mfa_config.
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_config TO :"app_role";

COMMIT;
