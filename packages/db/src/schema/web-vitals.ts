/**
 * packages/db/src/schema/web-vitals.ts
 *
 * Per-agency RUM (Real User Monitoring) events table. Receives navigator.sendBeacon
 * POSTs from WebVitalsReporter (Phase 8) — five core metrics (LCP, INP, CLS, FCP, TTFB).
 *
 * RLS enabled — Phase 2 pattern (USING + app.agency_id session var).
 * Plan 11-04 dashboard reads percentile_cont(0.75) over this table for the
 * LCP / INP / CLS p75 cards.
 *
 * REQ-145 supplementary — RESEARCH §Critical Discovery: this table did not exist
 * before Plan 11-07; Phase 8 WebVitalsReporter was gtag-only (no Postgres persistence).
 */
import { pgTable, bigserial, uuid, text, doublePrecision, timestamp, index } from 'drizzle-orm/pg-core'

export const webVitals = pgTable(
  'web_vitals',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    agencyId: uuid('agency_id').notNull(),
    pagePath: text('page_path').notNull(),
    /** 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB' — CHECK enforced at SQL layer */
    metricName: text('metric_name').notNull(),
    value: doublePrecision('value').notNull(),
    /** 'good' | 'needs-improvement' | 'poor' (web-vitals package output) */
    rating: text('rating'),
    /** 'navigate' | 'reload' | 'back-forward' | 'prerender' | 'restore' */
    navigationType: text('navigation_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('web_vitals_agency_metric_path_time_idx').on(
      t.agencyId,
      t.metricName,
      t.pagePath,
      t.createdAt,
    ),
    index('web_vitals_created_idx').on(t.createdAt),
  ],
)

export const webVitalsRlsSql = `
  ALTER TABLE web_vitals ENABLE ROW LEVEL SECURITY;
  CREATE POLICY web_vitals_agency_iso ON web_vitals
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);
  ALTER TABLE web_vitals ADD CONSTRAINT web_vitals_metric_name_check
    CHECK (metric_name IN ('LCP','INP','CLS','FCP','TTFB'));
`
