/**
 * packages/cms/src/admin-views/QaReportView.tsx
 *
 * Plan 12-01 — Surface 3: QA Report matrix (REQ-150, REQ-151, REQ-157).
 * Registered at /admin/qa-report via admin.components.views.QaReport in
 * build-payload-config.ts.
 *
 * SECURITY:
 *   - CLAUDE.md §3 (Pitfall 4.4): requireSession() is the FIRST call. Payload
 *     custom admin views do NOT auto-authenticate — without this, any browser
 *     could load the view.
 *   - T-12-01-01: super_admin role check before rendering any matrix data.
 *   - T-12-01-02: view scoped to super_admin only; no agency-scoped data exposed.
 *   - T-12-01-04: qa-results.json read from fixed path at .planning/qa-results.json;
 *     no user-controlled path input.
 *
 * CSS:
 *   - Zero inline style attributes (Pitfall 4.5 — CSP nonce blocks inline styles).
 *   - All styling via dashboard-page, dashboard-table, rum-pill class names
 *     defined in packages/ui/src/dashboard/dashboard.css.
 */
import 'server-only'
import type * as React from 'react'
import { redirect } from 'next/navigation'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { requireSession } from '@mjagency/auth'
import type { QaReport } from '@mjagency/testing'

const AGENCY_SLUGS = [
  'web-ai',
  'web-branding',
  'web-construction',
  'web-dental',
  'web-ecommerce',
  'web-financial',
  'web-fitness',
  'web-homeservices',
  'web-legal',
  'web-realestate',
  'web-restaurant',
  'web-spa',
] as const

const QA_CHECKS = [
  'Auth Flows',
  'Public Pages',
  'Form Submissions',
  'CRM Lead Creation',
  'Booking Flow',
  'CCPA Erasure',
  'GA4 / sGTM',
  'RUM Dashboard',
  'OWASP ZAP',
  'Lighthouse CI',
] as const

function loadQaReport(): QaReport | null {
  const reportPath = join(process.cwd(), '.planning', 'qa-results.json')
  if (!existsSync(reportPath)) return null
  try {
    return JSON.parse(readFileSync(reportPath, 'utf-8')) as QaReport
  } catch {
    return null
  }
}

export default async function QaReportView(): Promise<React.ReactElement> {
  // CLAUDE.md §3 + Pitfall 4.4: requireSession FIRST. Throws via redirect()
  // for unauthenticated requests (handled by Next.js).
  const session = await requireSession()

  // T-12-01-01 + T-12-01-02: super_admin only — redirect non-super_admin roles.
  if (session.role !== 'super_admin') {
    redirect('/admin')
  }

  const report = loadQaReport()

  const totalChecks = AGENCY_SLUGS.length * QA_CHECKS.length
  let passed = 0
  let failed = 0
  let pending = 0

  if (report) {
    for (const row of report.rows) {
      for (const check of row.checks) {
        if (check.state === 'pass') passed++
        else if (check.state === 'fail') failed++
        else pending++
      }
    }
  }

  function getBadgeClass(state: string): string {
    switch (state) {
      case 'pass': return 'rum-pill rum-pill--pass'
      case 'fail': return 'rum-pill rum-pill--fail'
      case 'skip': return 'rum-pill rum-pill--skip'
      default: return 'rum-pill rum-pill--pending'
    }
  }

  function getBadgeText(state: string): string {
    switch (state) {
      case 'pass': return 'PASS'
      case 'fail': return 'FAIL'
      case 'skip': return 'SKIP'
      default: return '—'
    }
  }

  function getCheckState(row: QaReport['rows'][0] | undefined, checkIndex: number): string {
    if (!row) return 'pending'
    return row.checks[checkIndex]?.state ?? 'pending'
  }

  return (
    <main className="dashboard-page" aria-label="QA Report">
      <header className="dashboard-page__header">
        <h1 className="dashboard-page__title">QA Report</h1>
      </header>
      {report ? (
        <p className="dashboard-page__subtitle">
          {AGENCY_SLUGS.length} agencies &times; {QA_CHECKS.length} checks = {totalChecks} checks total.{' '}
          {passed} passed &middot; {failed} failed &middot; {pending} pending.
        </p>
      ) : (
        <p>QA matrix is not yet populated. Run the full QA suite with <code>turbo test</code> to generate results.</p>
      )}
      <div className="dashboard-table-wrapper">
        <table className="dashboard-table" aria-label="QA matrix results">
          <thead>
            <tr>
              <th scope="col">Agency</th>
              {QA_CHECKS.map(col => (
                <th key={col} scope="col">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AGENCY_SLUGS.map((slug) => {
              const row = report?.rows.find(r => r.agencySlug === slug)
              return (
                <tr key={slug}>
                  <th scope="row">{slug}</th>
                  {QA_CHECKS.map((_col, i) => {
                    const state = getCheckState(row, i)
                    return (
                      <td key={i}>
                        <span className={getBadgeClass(state)}>{getBadgeText(state)}</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}
