/**
 * apps/web-realestate/src/app/api/csp-report/route.ts
 *
 * Public POST endpoint receiving Content-Security-Policy violation reports from anonymous
 * browsers. The browser sends Content-Type: application/csp-report with body shape:
 *   { "csp-report": { "document-uri": "...", "blocked-uri": "...", ... } }
 *
 * No auth — middleware matcher excludes /api/* (verified by csp-nonce.test.ts).
 * Inserts to platform-wide csp_reports table (no agency_id, no RLS).
 *
 * Pitfall 9.1: scanner User-Agents (ZAP, sqlmap, etc.) are dropped to avoid table pollution.
 *
 * REQ-145 / Plan 11-07.
 */
export const runtime = 'nodejs' // postgres-js requires Node, not Edge

import 'server-only'
import { createAgencyDb, cspReports } from '@mjagency/db'

const AGENCY_SLUG = 'web-realestate'
/**
 * Agency database slug used to obtain a Postgres connection. The csp_reports table
 * is platform-wide (no RLS), but each app still connects via its own per-agency pool —
 * we use 'brand' (the platform-anchor agency) to satisfy the createAgencyDb contract.
 */
const DB_AGENCY: 'brand' = 'brand'

const SCANNER_UA_REGEX = /ZAP\/|HeadlessChrome|sqlmap|nikto|wpscan/i

interface CspReportBody {
  'document-uri'?: string
  'blocked-uri'?: string
  'violated-directive'?: string
  'original-policy'?: string
  'source-file'?: string
  'line-number'?: number
}

export async function POST(req: Request): Promise<Response> {
  // Drop scanner UAs (Pitfall 9.1)
  const ua = req.headers.get('user-agent') ?? ''
  if (SCANNER_UA_REGEX.test(ua)) {
    return new Response(null, { status: 204 })
  }

  let report: CspReportBody | undefined
  try {
    const text = await req.text()
    if (!text) return new Response(null, { status: 204 })
    const parsed = JSON.parse(text) as { 'csp-report'?: CspReportBody } & CspReportBody
    report = parsed['csp-report'] ?? (parsed as CspReportBody)
  } catch {
    return new Response(null, { status: 204 })
  }
  if (!report) return new Response(null, { status: 204 })

  try {
    const password = process.env['DB_APP_PASSWORD']
    if (!password) {
      // No DB available in this environment — silently drop (best-effort sink).
      return new Response(null, { status: 204 })
    }
    const db = createAgencyDb(DB_AGENCY, password)
    await db.insert(cspReports).values({
      documentUri: report['document-uri'] ?? null,
      blockedUri: report['blocked-uri'] ?? null,
      violatedDirective: report['violated-directive'] ?? null,
      originalPolicy: report['original-policy'] ?? null,
      sourceFile: report['source-file'] ?? null,
      lineNumber: typeof report['line-number'] === 'number' ? report['line-number'] : null,
      agencySlug: AGENCY_SLUG,
    })
  } catch {
    // Never surface DB errors to the public endpoint
  }

  return new Response(null, { status: 204 })
}
