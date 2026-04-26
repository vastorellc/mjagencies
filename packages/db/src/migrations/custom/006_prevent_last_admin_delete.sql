-- packages/db/src/migrations/custom/006_prevent_last_admin_delete.sql
-- Plan 03-06 — DB backstop for REQ-028/REQ-400 (agency owner self-delete block).
-- Fires BEFORE DELETE on users; raises if removing the last admin in the agency.
-- Idempotent via DROP TRIGGER IF EXISTS.
--
-- Defense-in-depth: This trigger is Layer 2. Layer 1 is the server-action guard
-- assertNotAgencyOwner() in packages/auth/src/guards.ts. This trigger fires even
-- if the guard is bypassed (e.g. direct SQL, future bugs, migrations_runner DML).
--
-- ERRCODE: integrity_constraint_violation (23000) — callers can catch this specifically.
-- Threat: T-03-022 (last admin self-delete → agency becomes unmanageable).

BEGIN;

CREATE OR REPLACE FUNCTION prevent_last_admin_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF (
      SELECT COUNT(*) FROM users
      WHERE agency_id = OLD.agency_id AND role = 'admin'
    ) = 1 THEN
      RAISE EXCEPTION 'Cannot delete the last admin user for agency %', OLD.agency_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_delete_trigger ON users;
CREATE TRIGGER prevent_last_admin_delete_trigger
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_last_admin_delete();

COMMIT;
