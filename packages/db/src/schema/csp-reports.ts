/**
 * packages/db/src/schema/csp-reports.ts
 *
 * Platform-wide CSP violation report sink (no agency_id, no RLS) — receives
 * Content-Security-Policy-Report-Only violation reports from anonymous browsers
 * across all 13 apps (web-main + 12 agency apps).
 *
 * REQ-145 / REQ-146 D-08 Stage 1 — Report-Only mode collects violations for
 * 14 days before flipping to enforcing CSP via CSP_ENFORCING=true env var.
 *
 * No RLS: violation reports come from public anonymous browsers and are read
 * only by super_admin via the platform admin dashboard (added in Plan 11-04).
 * Tenant tagging is best-effort via agency_slug derived from request Host header.
 */
import { pgTable, bigserial, text, timestamp, integer, index } from 'drizzle-orm/pg-core'

export const cspReports = pgTable(
  'csp_reports',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    documentUri: text('document_uri'),
    blockedUri: text('blocked_uri'),
    violatedDirective: text('violated_directive'),
    originalPolicy: text('original_policy'),
    sourceFile: text('source_file'),
    lineNumber: integer('line_number'),
    /** Best-effort tag derived from per-app handler constant (not authenticated) */
    agencySlug: text('agency_slug'),
  },
  (t) => [
    index('csp_reports_received_idx').on(t.receivedAt),
    index('csp_reports_agency_slug_idx').on(t.agencySlug),
    index('csp_reports_directive_idx').on(t.violatedDirective),
  ],
)
