/**
 * packages/testing/src/qa-matrix/types.ts
 *
 * QA matrix type definitions for Phase 12 launch QA.
 * REQ-150, REQ-151, REQ-157
 *
 * QaReport is the top-level result produced by the full QA suite
 * (turbo test) and consumed by QaReportView in the Payload admin
 * at /admin/qa-report.
 */

export type QaCheckCategory =
  | 'auth-flows'
  | 'public-pages'
  | 'form-submissions'
  | 'crm-lead-creation'
  | 'booking-flow'
  | 'ccpa-erasure'
  | 'ga4-sgtm'
  | 'rum-dashboard'
  | 'owasp-zap'
  | 'lighthouse-ci'

export type QaCheckState = 'pass' | 'fail' | 'skip' | 'pending'

export interface QaCheckResult {
  category: QaCheckCategory
  state: QaCheckState
  detail?: string
}

export interface QaMatrixRow {
  agencySlug: string
  checks: QaCheckResult[]
}

export interface QaReport {
  generatedAt: string
  rows: QaMatrixRow[]
}
