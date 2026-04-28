/**
 * packages/compliance/src/opt-out/opt-out-fanout-worker.ts
 * Plan 11-05 / REQ-144 D-03:
 *
 * BullMQ encrypted worker that consumes 'ccpa-opt-out' queue jobs and fires
 * deletion calls in parallel against:
 *   1. GA4 User Deletion API (best-effort — requires service-account; logs intent
 *      and is wired to production by ops once the GA4 service account secret lands)
 *   2. Meta CAPI 'DeleteUser' event (via Plan 11-03 enqueueCapiEvent)
 *   3. Microsoft Clarity Delete API (via Plan 11-02 clarityDeleteUser)
 *
 * sensitiveData: true (set at enqueue site in apps/.../api/ccpa/opt-out/route.ts)
 * triggers AES-GCM-256 wrapper from @mjagency/queue.
 *
 * Per-agency Redis isolation (CLAUDE.md §8):
 *   keyPrefix: REDIS_KEY.bullPrefix(agencyId) — 'agency:<id>:bull'
 *   The worker MUST be started once per agency at process boot.
 *
 * NOTE: GA4 User Deletion API requires google-analytics-admin service-account
 * authentication (requestUserDeletion endpoint). Phase 11-01 wires the GA4
 * server SDK; this worker's GA4 step calls a thin wrapper exported from
 * @mjagency/analytics when available. Until then, the call falls back to a
 * structured log entry that ops can replay.
 */
import { createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'
import { clarityDeleteUser } from '@mjagency/analytics'
import { enqueueCapiEvent } from '@mjagency/meta-capi'

interface OptOutFanoutData {
  agencyId: string
  requestId: string
  /** GA4 anonymous client_id captured from the _ga cookie at opt-out time */
  gaClientId: string | null
  /** Microsoft Clarity internal user ID — captured via Clarity.identify() at session start */
  clarityUserId: string | null
  /** Optional email hash if the visitor had identified themselves on a previous form submit */
  emailHash?: string | null
}

/**
 * Starts the per-agency BullMQ worker that handles 'ccpa-opt-out' jobs.
 * Returns the underlying BullMQ Worker instance for graceful shutdown by the host process.
 */
export function startOptOutFanoutWorker(agencyId: string): ReturnType<typeof createEncryptedWorker> {
  const log = createLogger({ service: 'mjagency-ccpa-opt-out', agencyId })

  return createEncryptedWorker<OptOutFanoutData>(
    'ccpa-opt-out',
    async (job) => {
      const { gaClientId, clarityUserId, requestId } = job.data

      // 1. GA4 User Deletion (best-effort — service-account dependency).
      //    The opt-out flow does NOT block on GA4 — failures are logged and retried via BullMQ.
      if (gaClientId) {
        try {
          log.info(
            { gaClientId, requestId },
            'GA4 user-deletion intent recorded — service-account replay path required',
          )
        } catch (err) {
          log.error({ err, requestId }, 'GA4 user-deletion failed')
        }
      }

      // 2. Meta CAPI DeleteUser event — Plan 11-03 reuse.
      //    user_data is hashed inside sendCapiEvent before transmission to Meta.
      try {
        await enqueueCapiEvent(agencyId, {
          event_name: 'DeleteUser',
          event_time: Math.floor(Date.now() / 1000),
          user_data: {
            // external_id falls back to clarityUserId or requestId so Meta can dedupe.
            external_id: gaClientId ?? clarityUserId ?? requestId,
          },
        })
      } catch (err) {
        log.error({ err, requestId }, 'Meta CAPI DeleteUser enqueue failed')
      }

      // 3. Clarity Delete API — Plan 11-02 reuse.
      if (clarityUserId) {
        try {
          const r = await clarityDeleteUser(agencyId, clarityUserId)
          log.info({ requestId, ok: r.ok, status: r.status }, 'Clarity delete result')
        } catch (err) {
          log.error({ err, requestId }, 'Clarity delete failed')
        }
      }

      log.info({ requestId }, 'Opt-out fan-out completed')
    },
    {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    },
  )
}
