-- 0012_ccpa_erasure_records_and_consent_log.sql
-- Plan 11-05 — REQ-144 D-03 / D-07: hash-chained CCPA erasure audit trail + consent state log.
--
-- Tables:
--   ccpa_erasure_records — per-agency, RLS enabled, IMMUTABLE (no UPDATE / no DELETE).
--                          Hash chain: record_hash = sha256(prev_hash + request_id + system + occurred_at + JSON.result)
--                          One row per (request_id, system) — 7 systems per request: postgres, redis, r2,
--                          ga4, meta_capi, clarity, litellm.
--   consent_log         — per-agency, RLS enabled, append-only. Captures consent transitions.
--                          PII discipline: emails and IPs are SHA-256 hashed before insert.
--
-- RLS pattern matches Phase 2 02-02 (USING + app.agency_id session var via SET LOCAL).

CREATE TABLE IF NOT EXISTS "ccpa_erasure_records" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agency_id"     uuid NOT NULL,
  "request_id"    text NOT NULL,
  "system"        text NOT NULL,
  "result"        jsonb NOT NULL,
  "occurred_at"   timestamp with time zone NOT NULL DEFAULT NOW(),
  "prev_hash"     text,
  "record_hash"   text NOT NULL
);

CREATE INDEX IF NOT EXISTS "ccpa_erasure_agency_request_idx"
  ON "ccpa_erasure_records" ("agency_id", "request_id");
CREATE INDEX IF NOT EXISTS "ccpa_erasure_request_idx"
  ON "ccpa_erasure_records" ("request_id");
CREATE INDEX IF NOT EXISTS "ccpa_erasure_occurred_idx"
  ON "ccpa_erasure_records" ("occurred_at");

ALTER TABLE "ccpa_erasure_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccpa_erasure_records_agency_iso" ON "ccpa_erasure_records"
  AS PERMISSIVE FOR ALL
  TO CURRENT_USER
  USING (agency_id = (current_setting('app.agency_id', true))::uuid)
  WITH CHECK (agency_id = (current_setting('app.agency_id', true))::uuid);

ALTER TABLE "ccpa_erasure_records" ADD CONSTRAINT "ccpa_erasure_records_system_check"
  CHECK (system IN ('postgres','redis','r2','ga4','meta_capi','clarity','litellm'));

CREATE TABLE IF NOT EXISTS "consent_log" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agency_id"        uuid NOT NULL,
  "email_hash"       text,
  "clarity_user_id"  text,
  "ga_client_id"     text,
  "ip_hash"          text NOT NULL,
  "user_agent"       text,
  "action"           text NOT NULL,
  "occurred_at"      timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "consent_log_agency_action_time_idx"
  ON "consent_log" ("agency_id", "action", "occurred_at");
CREATE INDEX IF NOT EXISTS "consent_log_email_hash_idx"
  ON "consent_log" ("email_hash");

ALTER TABLE "consent_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_log_agency_iso" ON "consent_log"
  AS PERMISSIVE FOR ALL
  TO CURRENT_USER
  USING (agency_id = (current_setting('app.agency_id', true))::uuid)
  WITH CHECK (agency_id = (current_setting('app.agency_id', true))::uuid);

ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_action_check"
  CHECK (action IN ('opt_out','opt_in','erasure_requested','erasure_confirmed','erasure_completed'));
