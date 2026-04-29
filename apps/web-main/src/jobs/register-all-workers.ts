/**
 * apps/web-main/src/jobs/register-all-workers.ts
 *
 * Single entry point for booting every BullMQ worker in the platform.
 *
 * Background
 * ──────────
 * Eight worker files were authored across packages but never registered in
 * any instrumentation file, so their queues filled up in Redis without ever
 * being drained. This module is the missing wire: it bootstraps each worker
 * once at process start, scoped per-agency where required.
 *
 * Defensive bootstrap policy
 * ──────────────────────────
 * Each worker registration is wrapped in try/catch. If one worker fails to
 * start (missing env var, transient Redis blip during startup, broken import
 * after a refactor), the others still come up. The failure is logged with
 * enough context for ops to replay or fix without restarting the whole app.
 *
 * What this module does NOT do
 * ─────────────────────────────
 * - It does not register the CCPA erasure worker (`startErasureWorker`).
 *   That worker requires a `loadLegalHoldRules` callback that bootstraps the
 *   Payload local API, and starting it without legal-hold rules wired risks
 *   deleting data that should be retained for tax / esign defensibility.
 *   Wire that one explicitly when the legal-hold loader is built.
 *
 * - It does not register the Stripe webhook worker, the invoice worker, or
 *   the dunning worker — those have specific bootstrap order requirements
 *   and are registered directly in instrumentation.node.ts.
 */

import type { Worker } from 'bullmq'
import { createLogger } from '@mjagency/config'

import { createEmailWorker }       from '@mjagency/email'
import { createFormWorker }        from '@mjagency/forms'
import { createBookingWorker }     from '@mjagency/booking'
import { createCrmWorker }         from '@mjagency/crm'
import { createSmsWorker }         from '@mjagency/sms'
import { startCapiWorker }         from '@mjagency/meta-capi'
import { startOptOutFanoutWorker } from '@mjagency/compliance'
import { startEsignWorker }        from '@mjagency/esign'
import { startExpiryWorker }       from '@mjagency/proposals'

const log = createLogger({ service: 'mjagency-worker-bootstrap' })

/**
 * The 12 deployed agency IDs. Per-agency workers are spawned once for each.
 */
export const AGENCY_IDS = [
  'ai', 'branding', 'ecommerce', 'engineering', 'finance', 'graphic',
  'growth', 'main', 'product', 'strategy', 'video', 'webdev',
] as const

/**
 * Registry of per-agency worker registration functions. Each entry is invoked
 * once per agency. Tagged with a name so failures are attributable in logs.
 *
 * `register` may return a Worker (newer pattern) or void (older). We don't
 * collect the return values — graceful shutdown is handled at the BullMQ /
 * ioredis level when the process exits.
 */
interface PerAgencyWorker {
  name: string
  register: (agencyId: string) => Worker | void
}

const PER_AGENCY_WORKERS: ReadonlyArray<PerAgencyWorker> = [
  { name: 'email',           register: createEmailWorker       },
  { name: 'form',            register: createFormWorker        },
  { name: 'booking',         register: createBookingWorker     },
  { name: 'crm',             register: createCrmWorker         },
  { name: 'sms',             register: createSmsWorker         },
  { name: 'meta-capi',       register: startCapiWorker         },
  { name: 'opt-out-fanout',  register: startOptOutFanoutWorker },
]

/**
 * Platform-level workers (single instance, no per-agency loop). The agencyId
 * is carried in the job payload and read inside the worker for routing.
 */
interface PlatformWorker {
  name: string
  register: () => Worker | void
}

const PLATFORM_WORKERS: ReadonlyArray<PlatformWorker> = [
  { name: 'esign',            register: startEsignWorker  },
  { name: 'proposal-expiry',  register: startExpiryWorker },
]

/**
 * Bootstrap every worker at process start.
 *
 * Returns a structured result so that ops dashboards / startup logs can show
 * which workers came up and which failed. Failures are logged at WARN level
 * (not FATAL) — a partial worker fleet is better than no app at all.
 */
export function registerAllWorkers(): {
  registered: string[]
  failed:     Array<{ name: string; agencyId?: string; error: string }>
} {
  const registered: string[] = []
  const failed: Array<{ name: string; agencyId?: string; error: string }> = []

  for (const w of PER_AGENCY_WORKERS) {
    for (const agencyId of AGENCY_IDS) {
      try {
        w.register(agencyId)
        registered.push(`${w.name}:${agencyId}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log.warn(
          { worker: w.name, agencyId, err: message },
          'worker_register_failed',
        )
        failed.push({ name: w.name, agencyId, error: message })
      }
    }
  }

  for (const w of PLATFORM_WORKERS) {
    try {
      w.register()
      registered.push(w.name)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.warn({ worker: w.name, err: message }, 'worker_register_failed')
      failed.push({ name: w.name, error: message })
    }
  }

  log.info(
    {
      registered_count: registered.length,
      failed_count:     failed.length,
      registered,
      failed,
    },
    'worker_bootstrap_complete',
  )

  return { registered, failed }
}
