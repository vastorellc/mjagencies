-- packages/db/src/migrations/custom/004_partition_audit_log.sql
--
-- Custom migration: convert audit_log to monthly RANGE-partitioned table.
-- Applied by Plan 02-06 via apply-custom.ts CUSTOM_FILES array (entry 004).
--
-- Partition extension is currently manual. Phase 11 ships a cron task
-- (pg_partman or custom plpgsql function called from cron) for ongoing
-- partition maintenance. Until then, operators must add new partitions
-- monthly — see docs/runbooks/vault-audit.md.
--
-- Initial month: 2026-04 (Plan 02-06 date: 2026-04-26).
-- 14 partitions created: 2026-04 through 2027-05.
-- Operators running this migration later get older partitions — fine.
-- Data in those partitions accumulates from first write.
--
-- 7-year retention (REQ-018):
--   Partitions older than 7 years are DETACHED (not dropped) and stored
--   as read-only archival tables. pgBackRest full backups (Plan 02-05) cover them.
--
-- Strategy: CREATE TABLE audit_log_new (PARTITION BY RANGE) → copy data → rename.
-- Postgres 17 does not support ALTER TABLE ... PARTITION BY RANGE in-place;
-- recreation is required. The migration is wrapped in a transaction for atomicity.
--
-- Schema mirrors packages/db/src/schema/audit-log.ts exactly.

BEGIN;

-- Step 1: Create new partitioned table with same schema as audit_log
CREATE TABLE IF NOT EXISTS audit_log_new (
  id         bigserial,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  table_name  text NOT NULL,
  op          text NOT NULL CHECK (op IN ('INSERT', 'UPDATE', 'DELETE')),
  row_pk      text NOT NULL,
  actor_id    uuid,
  agency_id   uuid NOT NULL,
  db_user     text NOT NULL DEFAULT CURRENT_USER,
  txid        bigint NOT NULL DEFAULT txid_current(),
  correlation_id text,
  old_row     jsonb,
  new_row     jsonb,
  prev_hash   bytea,
  row_hash    bytea NOT NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Step 2: Copy existing audit_log data into audit_log_new
-- (audit_log may be empty at first migration — this is a no-op in that case)
INSERT INTO audit_log_new
SELECT
  id, occurred_at, table_name, op, row_pk, actor_id, agency_id,
  db_user, txid, correlation_id, old_row, new_row, prev_hash, row_hash
FROM audit_log;

-- Step 3: Create initial monthly partitions (14 months: 2026-04 through 2027-05)
-- Static SQL — deterministic and inspectable. No PL/pgSQL loop per plan.

CREATE TABLE IF NOT EXISTS audit_log_2026_04 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS audit_log_2026_05 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS audit_log_2026_06 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS audit_log_2026_07 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS audit_log_2026_08 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS audit_log_2026_09 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS audit_log_2026_10 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS audit_log_2026_11 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS audit_log_2026_12 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS audit_log_2027_01 PARTITION OF audit_log_new
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

CREATE TABLE IF NOT EXISTS audit_log_2027_02 PARTITION OF audit_log_new
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

CREATE TABLE IF NOT EXISTS audit_log_2027_03 PARTITION OF audit_log_new
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

CREATE TABLE IF NOT EXISTS audit_log_2027_04 PARTITION OF audit_log_new
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

CREATE TABLE IF NOT EXISTS audit_log_2027_05 PARTITION OF audit_log_new
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

-- Step 4: Drop old audit_log (after data migration) and rename new table
DROP TABLE audit_log;
ALTER TABLE audit_log_new RENAME TO audit_log;

-- Step 5: Re-apply REVOKE to the new audit_log table (was on the old one)
-- This mirrors the REVOKE in 002_force_rls_and_app_role.sql for the new table
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- Step 6: Indexes on the partitioned parent (Postgres 17 propagates to partitions)
CREATE INDEX IF NOT EXISTS audit_log_agency_id_idx ON audit_log (agency_id);
CREATE INDEX IF NOT EXISTS audit_log_table_agency_idx ON audit_log (table_name, agency_id);
CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx ON audit_log (occurred_at DESC);

COMMIT;
