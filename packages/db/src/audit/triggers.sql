-- packages/db/src/audit/triggers.sql
--
-- Source-of-truth SQL for audit log hash trigger + per-table capture triggers.
-- This file is sourced verbatim into 003_audit_triggers.sql.
--
-- Hash chain implementation (RESEARCH §5.2, pitfall 8.6):
--   - audit_log_hash_trigger(): computes row_hash = sha256(canonical_string || prev_hash)
--   - Per-stream chain: keyed on (table_name, agency_id) to prevent forking under concurrency
--   - SELECT ... FOR UPDATE locks the stream head before computing the new hash link
--
-- Security:
--   - capture_audit_row() is SECURITY DEFINER — fires even when app role lacks INSERT on audit_log
--   - actor_id falls back to SYSTEM_ACTOR_ID (00000000-0000-0000-0000-000000000001) when
--     app.actor_id is not set in the current transaction (Open Q4 resolution)
--   - pgcrypto is used ONLY for SHA-256 digest in the trigger chain
--     (NOT for AES-GCM — that is application-layer via Node crypto, pitfall 8.7)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- audit_log_hash_trigger()
-- BEFORE INSERT trigger on audit_log — computes prev_hash + row_hash
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_log_hash_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev_hash bytea;
  v_canonical text;
BEGIN
  -- Per-stream chain (pitfall 8.6): lock on (table_name, agency_id) stream head.
  -- FOR UPDATE prevents concurrent INSERTs from seeing the same prev_hash,
  -- which would fork the chain.
  SELECT row_hash INTO v_prev_hash
  FROM audit_log
  WHERE table_name = NEW.table_name AND agency_id = NEW.agency_id
  ORDER BY id DESC
  LIMIT 1
  FOR UPDATE;

  -- Canonical string: all fields that uniquely identify the row's content.
  -- Using concat_ws('|', ...) to separate fields — same format the TS verifier uses.
  -- COALESCE ensures NULL fields produce empty strings or literal 'null'/'genesis'
  -- so the canonical string is deterministic.
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

CREATE TRIGGER audit_log_hash_before_insert
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_hash_trigger();

-- ---------------------------------------------------------------------------
-- capture_audit_row()
-- AFTER INSERT/UPDATE/DELETE trigger applied to audited tables
-- SECURITY DEFINER: runs as trigger owner (migrations_runner) — always has
-- INSERT privilege on audit_log even when the invoking app role does not.
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
