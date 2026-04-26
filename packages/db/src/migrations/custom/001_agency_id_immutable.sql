-- 001_agency_id_immutable.sql
-- Apply order: AFTER 0000_initial.sql
-- Purpose: Prevent agency_id from being changed after insert on all agency-scoped tables.
--
-- REQ-014: agency_id is immutable after creation.
-- T-02-002 mitigation: Blocks post-insert privilege escalation via agency_id mutation.
--
-- Idempotency: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS before CREATE TRIGGER.
-- Runs as migrations_runner (BYPASSRLS) — not affected by RLS context.

BEGIN;

-- Shared function used by all agency-scoped tables.
-- Uses BEFORE UPDATE OF agency_id (not generic BEFORE UPDATE) for performance:
-- the trigger only fires when the agency_id column is explicitly in the SET clause.
-- Reference: PostgreSQL 17 CREATE TRIGGER docs §column_list
CREATE OR REPLACE FUNCTION prevent_agency_id_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION
      'agency_id is immutable. Attempted change from % to % on table %',
      OLD.agency_id, NEW.agency_id, TG_TABLE_NAME
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on users table
DROP TRIGGER IF EXISTS enforce_agency_id_immutable ON users;
CREATE TRIGGER enforce_agency_id_immutable
  BEFORE UPDATE OF agency_id ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_agency_id_change();

-- Trigger on sessions table
DROP TRIGGER IF EXISTS enforce_agency_id_immutable ON sessions;
CREATE TRIGGER enforce_agency_id_immutable
  BEFORE UPDATE OF agency_id ON sessions
  FOR EACH ROW EXECUTE FUNCTION prevent_agency_id_change();

-- Trigger on permissions_vault table
DROP TRIGGER IF EXISTS enforce_agency_id_immutable ON permissions_vault;
CREATE TRIGGER enforce_agency_id_immutable
  BEFORE UPDATE OF agency_id ON permissions_vault
  FOR EACH ROW EXECUTE FUNCTION prevent_agency_id_change();

-- Note: audit_log is exempt — it has no agency_id update path (append-only via REVOKE).
-- Note: agencies table is exempt — it IS the agency record (agency_id is its own PK).
-- Note: _seed_state is exempt — it has no agency_id column.

COMMIT;
