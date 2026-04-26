-- packages/db/src/migrations/custom/003_audit_triggers.sql
--
-- Custom migration: audit log hash chain trigger + per-table capture triggers.
-- Applied by Plan 02-06 extension to apply-custom.ts CUSTOM_FILES array.
--
-- This file sources the trigger functions from packages/db/src/audit/triggers.sql
-- and then attaches per-table capture triggers to the audited tables.
--
-- Audited tables at this plan:
--   users, sessions, permissions_vault, agencies
-- Future phases extend this list (Phase 5 collections, Phase 9 CRM tables, etc.)
--
-- Idempotency: each CREATE TRIGGER is preceded by DROP TRIGGER IF EXISTS.
-- The trigger functions themselves use CREATE OR REPLACE FUNCTION.
--
-- Security model:
--   - capture_audit_row() is SECURITY DEFINER (runs as migrations_runner)
--   - audit_log has REVOKE UPDATE, DELETE FROM PUBLIC (migration 002)
--   - App role can INSERT into audited tables but cannot tamper with audit_log

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- audit_log_hash_trigger()
-- BEFORE INSERT on audit_log — computes prev_hash + row_hash per stream
-- Per-stream chain keyed on (table_name, agency_id), FOR UPDATE prevents forks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_log_hash_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev_hash bytea;
  v_canonical text;
BEGIN
  SELECT row_hash INTO v_prev_hash
  FROM audit_log
  WHERE table_name = NEW.table_name AND agency_id = NEW.agency_id
  ORDER BY id DESC
  LIMIT 1
  FOR UPDATE;

  v_canonical := concat_ws('|',
    NEW.id::text, NEW.occurred_at::text, NEW.table_name, NEW.op, NEW.row_pk,
    COALESCE(NEW.actor_id::text, ''), NEW.agency_id::text, NEW.txid::text,
    COALESCE(NEW.correlation_id, ''),
    COALESCE(NEW.old_row::text, 'null'),
    COALESCE(NEW.new_row::text, 'null'),
    COALESCE(encode(v_prev_hash, 'hex'), 'genesis')
  );

  NEW.prev_hash := v_prev_hash;
  NEW.row_hash  := digest(v_canonical, 'sha256');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_hash_before_insert ON audit_log;
CREATE TRIGGER audit_log_hash_before_insert
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_hash_trigger();

-- ---------------------------------------------------------------------------
-- capture_audit_row()
-- AFTER INSERT/UPDATE/DELETE on audited tables
-- SECURITY DEFINER ensures trigger always has INSERT on audit_log
-- actor_id falls back to SYSTEM_ACTOR_ID when app.actor_id not set (Open Q4)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION capture_audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log (table_name, op, row_pk, actor_id, agency_id, old_row, new_row, correlation_id)
  VALUES (
    TG_TABLE_NAME, TG_OP, COALESCE(NEW.id::text, OLD.id::text),
    COALESCE(NULLIF(current_setting('app.actor_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid),
    COALESCE(NEW.agency_id, OLD.agency_id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    NULLIF(current_setting('app.correlation_id', true), '')
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Per-table audit triggers (attaches capture_audit_row to each audited table)
-- Future phases extend this list — the pattern is: any table needing 7-year audit trail

DROP TRIGGER IF EXISTS audit_users ON users;
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION capture_audit_row();

DROP TRIGGER IF EXISTS audit_sessions ON sessions;
CREATE TRIGGER audit_sessions
  AFTER INSERT OR UPDATE OR DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION capture_audit_row();

DROP TRIGGER IF EXISTS audit_permissions_vault ON permissions_vault;
CREATE TRIGGER audit_permissions_vault
  AFTER INSERT OR UPDATE OR DELETE ON permissions_vault
  FOR EACH ROW EXECUTE FUNCTION capture_audit_row();

DROP TRIGGER IF EXISTS audit_agencies ON agencies;
CREATE TRIGGER audit_agencies
  AFTER INSERT OR UPDATE OR DELETE ON agencies
  FOR EACH ROW EXECUTE FUNCTION capture_audit_row();

COMMIT;
