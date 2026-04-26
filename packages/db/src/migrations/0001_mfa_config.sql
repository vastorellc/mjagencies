-- 0001_mfa_config.sql
-- Plan 03-02 — adds mfa_config agency-scoped table.
-- Apply order: after 0000_initial.sql, before custom/005_audit_mfa_config.sql.
--
-- This migration is manually written, faithful to drizzle-kit output format.
-- (drizzle-kit not available in CI per Phase 2 02-01 SUMMARY decision.)
--
-- Tables: mfa_config
--   - agency-scoped (agency_id NOT NULL)
--   - RLS ENABLED (FORCE RLS applied by custom/005_audit_mfa_config.sql)
--   - Unique constraint on (agency_id, user_id) — prevents duplicate MFA configs
--   - recovery_hashes text[] — 8 bcrypt slots, empty string = used slot
--   - TOTP secret NOT stored here — lives in permissions_vault under
--     key 'mfa.totp_secret.<userId>' (Plan 02-06 vault helpers, AES-GCM-256)

CREATE TABLE "mfa_config" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agency_id"        uuid NOT NULL,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "user_id"          uuid NOT NULL UNIQUE,
  "recovery_hashes"  text[] NOT NULL,
  "mfa_enabled_at"   timestamp with time zone,
  "last_verified_at" timestamp with time zone,
  "failed_attempts"  integer NOT NULL DEFAULT 0,
  "lockout_until"    timestamp with time zone
);

CREATE UNIQUE INDEX "mfa_config_agency_user_idx" ON "mfa_config" ("agency_id", "user_id");

ALTER TABLE "mfa_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfa_config_agency_isolation" ON "mfa_config"
  AS PERMISSIVE FOR ALL
  TO CURRENT_USER
  USING (agency_id = current_setting('app.agency_id', true)::uuid)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::uuid);
