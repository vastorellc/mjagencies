-- 0011_csp_reports_and_web_vitals.sql
-- Plan 11-07 — REQ-145 / REQ-146 D-08: CSP report sink + RUM persistence.
--
-- Tables:
--   csp_reports — platform-wide (no agency_id, no RLS) — receives Content-Security-Policy
--                 violation reports from all 13 apps' /api/csp-report endpoints.
--   web_vitals  — per-agency, RLS enabled — receives navigator.sendBeacon RUM events
--                 from WebVitalsReporter (LCP, INP, CLS, FCP, TTFB).
--
-- RLS pattern matches Phase 2 02-02 (USING + app.agency_id session var via SET LOCAL).

CREATE TABLE IF NOT EXISTS "csp_reports" (
  "id"                 bigserial PRIMARY KEY,
  "received_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "document_uri"       text,
  "blocked_uri"        text,
  "violated_directive" text,
  "original_policy"    text,
  "source_file"        text,
  "line_number"        integer,
  "agency_slug"        text
);

CREATE INDEX IF NOT EXISTS "csp_reports_received_idx"     ON "csp_reports" ("received_at");
CREATE INDEX IF NOT EXISTS "csp_reports_agency_slug_idx"  ON "csp_reports" ("agency_slug");
CREATE INDEX IF NOT EXISTS "csp_reports_directive_idx"    ON "csp_reports" ("violated_directive");

CREATE TABLE IF NOT EXISTS "web_vitals" (
  "id"               bigserial PRIMARY KEY,
  "agency_id"        uuid NOT NULL,
  "page_path"        text NOT NULL,
  "metric_name"      text NOT NULL,
  "value"            double precision NOT NULL,
  "rating"           text,
  "navigation_type"  text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "web_vitals_agency_metric_path_time_idx"
  ON "web_vitals" ("agency_id", "metric_name", "page_path", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "web_vitals_created_idx"
  ON "web_vitals" ("created_at");

ALTER TABLE "web_vitals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_vitals_agency_iso" ON "web_vitals"
  AS PERMISSIVE FOR ALL
  TO CURRENT_USER
  USING (agency_id = current_setting('app.agency_id', true)::uuid)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::uuid);

ALTER TABLE "web_vitals" ADD CONSTRAINT "web_vitals_metric_name_check"
  CHECK (metric_name IN ('LCP','INP','CLS','FCP','TTFB'));
