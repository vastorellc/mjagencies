/**
 * apps/web-main/src/jobs/erasure-worker.ts
 *
 * Bootstraps the CCPA §1798.105 right-to-erasure worker that drains the
 * `ccpa-erasure` queue. Without this, an erasure request sits in Redis
 * forever — the user-facing modal returns 200 OK and nothing actually
 * deletes. That is both a launch blocker and a regulatory exposure.
 *
 * The fan-out worker itself (7-system orchestrator: Postgres, Redis, R2,
 * GA4, Meta CAPI, Clarity, LiteLLM) lives in
 * `packages/compliance/src/erasure/worker.ts` and was already implemented.
 * It just had no registration site because of the loadLegalHoldRules
 * dependency that this file now satisfies.
 *
 * loadLegalHoldRules contract
 * ───────────────────────────
 * The worker invokes `loadLegalHoldRules(agencyId)` before deleting from
 * Postgres so it can SKIP esign records / invoices / tax records that
 * fall under regulated retention regimes (ESIGN Act 7yr, IRS 7yr, HIPAA
 * if enabled). Skipped rows still get audit-trail entries proving the
 * deletion request was acknowledged.
 *
 * Returning `null` from the loader is INTENTIONALLY SAFE: shouldHonorLegalHold()
 * defaults to a 7-year ESIGN retention, which means esign records are
 * protected. Contacts and form submissions (which carry no legal hold)
 * are still deleted. Net behavior on a stub loader: legally defensible.
 *
 * Per-agency override mechanism
 * ─────────────────────────────
 * If a specific agency needs different retention (e.g. a healthcare client
 * needs HIPAA), set env vars at deploy time:
 *
 *   LEGAL_HOLD_<AGENCY_UPPER>_ESIGN_YEARS=7      // 0 = allow esign deletion
 *   LEGAL_HOLD_<AGENCY_UPPER>_TAX_YEARS=7        // 0 = no tax retention
 *   LEGAL_HOLD_<AGENCY_UPPER>_HIPAA=true         // opt into HIPAA hold
 *
 * Examples (in .env.example):
 *   LEGAL_HOLD_FINANCE_TAX_YEARS=7
 *   LEGAL_HOLD_HEALTHCARE_HIPAA=true
 *
 * Future work (deferred — operational decision, not launch-blocking):
 *   Move per-agency rules into a Payload `settings` collection field so the
 *   admin UI can manage them without redeploys. The loader contract here
 *   is unchanged when that happens.
 */

import type { Worker } from 'bullmq'
import { startErasureWorker, type LegalHoldRules } from '@mjagency/compliance'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-erasure-bootstrap' })

/**
 * Canonical list of deployed agencies. Mirror of the same constant in
 * stripe-webhook-worker.ts and register-all-workers.ts. When this list
 * eventually moves to a shared package, all three call sites update at once.
 */
const AGENCY_IDS = [
  'ai', 'branding', 'ecommerce', 'engineering', 'finance', 'graphic',
  'growth', 'main', 'product', 'strategy', 'video', 'webdev',
] as const

/** Convert "web-finance" / "finance" → "WEB_FINANCE" / "FINANCE" for env-var lookup. */
function envKey(agencyId: string): string {
  return agencyId.toUpperCase().replace(/-/g, '_')
}

/** Parse an integer env var; return undefined if absent or unparseable. */
function readIntEnv(name: string): number | undefined {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return undefined
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Loader: read per-agency legal-hold overrides from env, otherwise return null
 * to signal "use the safe defaults baked into shouldHonorLegalHold".
 *
 * Exported separately so unit tests can drive it in isolation.
 */
export async function loadLegalHoldRules(
  agencyId: string,
): Promise<LegalHoldRules | null> {
  const upper = envKey(agencyId)

  const esignYears = readIntEnv(`LEGAL_HOLD_${upper}_ESIGN_YEARS`)
  const taxYears   = readIntEnv(`LEGAL_HOLD_${upper}_TAX_YEARS`)
  const hipaa      = process.env[`LEGAL_HOLD_${upper}_HIPAA`] === 'true'

  // No overrides set → return null. shouldHonorLegalHold falls back to:
  //   - esign_record:   7yr (skip)   ← ESIGN Act default
  //   - tax_record:     0yr (delete) ← no tax retention by default
  //   - medical_record: not retained ← HIPAA opt-in only
  if (esignYears === undefined && taxYears === undefined && !hipaa) {
    return null
  }

  const rules: LegalHoldRules = {}
  if (esignYears !== undefined) rules.esign_retention_years = esignYears
  if (taxYears !== undefined)   rules.tax_retention_years   = taxYears
  if (hipaa)                     rules.hipaa_required        = true
  return rules
}

/**
 * Register one erasure worker per agency. Mirrors the per-agency pattern
 * used by stripe-webhook-worker.ts and tool-pdf-email-bridge.ts.
 *
 * Defensive bootstrap: a single agency's worker failing to start does NOT
 * abort the others (matches the policy in register-all-workers.ts).
 */
export function registerErasureWorkers(): Worker[] {
  const workers: Worker[] = []
  for (const agencyId of AGENCY_IDS) {
    try {
      const w = startErasureWorker(agencyId, { loadLegalHoldRules })
      workers.push(w)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.warn({ agencyId, err: message }, 'erasure_worker_register_failed')
    }
  }
  log.info({ count: workers.length, total: AGENCY_IDS.length }, 'erasure_workers_registered')
  return workers
}
