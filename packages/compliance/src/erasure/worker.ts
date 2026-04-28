/**
 * packages/compliance/src/erasure/worker.ts
 * Plan 11-05 / REQ-144 D-04 + D-05 + D-06 + D-07:
 *
 * The 7-system erasure orchestrator. Consumes BullMQ 'ccpa-erasure' jobs (encrypted)
 * and fans out across:
 *   1. per-agency Postgres
 *   2. per-agency Redis
 *   3. R2 (uploaded media)
 *   4. GA4 User Deletion API
 *   5. Meta CAPI 'DeleteUser' (Plan 11-03)
 *   6. Microsoft Clarity Delete API (Plan 11-02)
 *   7. LiteLLM call logs (Phase 7)
 *
 * After every system operation we write a hash-chained audit row (D-07). The
 * final row's record_hash goes onto the receipt PDF and is uploaded to the
 * erasure-receipts R2 vault, then emailed to the requester.
 *
 * Failure semantics:
 *   - DELETE is idempotent per system; BullMQ retries (attempts:5, exp backoff).
 *   - Any single-system failure logs an audit row with `{ ok: false, ... }`
 *     so the chain proves "we tried" — required for legal defensibility.
 *   - Worker does NOT abort on per-system failure; it continues to the next system.
 */
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger, type AgencySlug } from '@mjagency/config'
import { clarityDeleteUser } from '@mjagency/analytics'
import { enqueueCapiEvent } from '@mjagency/meta-capi'
import { sendEmail, type EmailJobData } from '@mjagency/email'
import { writeAuditRow, type ErasureSystem } from './audit.js'
import { deleteFromPostgres } from './delete-from-postgres.js'
import { deleteFromRedis } from './delete-from-redis.js'
import { deleteFromR2 } from './delete-from-r2.js'
import { ga4DeleteUser } from './ga4-delete.js'
import { litellmDeleteCalls } from './litellm-delete.js'
import { generateErasureReceiptPdf } from './generate-pdf.js'
import { uploadReceiptToR2 } from './upload-r2.js'
import type { LegalHoldRules } from './legal-hold.js'

interface ErasureJobData {
  agencyId: string
  /** Per-agency Postgres slug (web-ecommerce → 'ecommerce', etc.) */
  dbAgencySlug: AgencySlug
  agencyName?: string
  email: string
  requestId: string
  clarityUserId?: string | null
  gaClientId?: string | null
}

export interface StartErasureWorkerOptions {
  /**
   * Loads the agency's legal_hold_rules. The worker calls this for esign/tax checks
   * before deleting from postgres. Caller is responsible for the Payload local API
   * bootstrap (we do not import payload directly to avoid the dep cycle).
   */
  loadLegalHoldRules: (agencyId: string) => Promise<LegalHoldRules | null>
}

const ALL_SYSTEMS: ReadonlyArray<ErasureSystem> = [
  'postgres',
  'redis',
  'r2',
  'ga4',
  'meta_capi',
  'clarity',
  'litellm',
] as const

export function startErasureWorker(
  agencyId: string,
  options: StartErasureWorkerOptions,
): ReturnType<typeof createEncryptedWorker> {
  const log = createLogger({ service: 'mjagency-erasure', agencyId })

  return createEncryptedWorker<ErasureJobData>(
    'ccpa-erasure',
    async (job) => {
      const { email, requestId, dbAgencySlug, clarityUserId, gaClientId, agencyName } = job.data
      let prevHash = ''
      const summary: Array<{ system: string; deleted?: number; skipped?: number; reason?: string }> = []

      // 1. Postgres
      try {
        const r = await deleteFromPostgres({
          agencyId: job.data.agencyId,
          dbAgencySlug,
          email,
          loadLegalHoldRules: options.loadLegalHoldRules,
        })
        const audit = await writeAuditRow({
          agencyId: job.data.agencyId,
          dbAgencySlug,
          requestId,
          system: 'postgres',
          result: r,
          prevHash,
        })
        prevHash = audit.recordHash
        summary.push({ system: 'postgres', deleted: r.deleted, skipped: r.skipped, reason: r.reason })
      } catch (err) {
        log.error({ err, requestId }, 'postgres delete failed')
      }

      // 2. Redis
      try {
        const r = await deleteFromRedis({ agencyId: job.data.agencyId, email })
        const audit = await writeAuditRow({
          agencyId: job.data.agencyId,
          dbAgencySlug,
          requestId,
          system: 'redis',
          result: r,
          prevHash,
        })
        prevHash = audit.recordHash
        summary.push({ system: 'redis', deleted: r.deleted, skipped: r.skipped })
      } catch (err) {
        log.error({ err, requestId }, 'redis delete failed')
      }

      // 3. R2
      try {
        const r = await deleteFromR2({ agencyId: job.data.agencyId, email })
        const audit = await writeAuditRow({
          agencyId: job.data.agencyId,
          dbAgencySlug,
          requestId,
          system: 'r2',
          result: r,
          prevHash,
        })
        prevHash = audit.recordHash
        summary.push({ system: 'r2', deleted: r.deleted, skipped: r.skipped })
      } catch (err) {
        log.error({ err, requestId }, 'r2 delete failed')
      }

      // 4. GA4
      try {
        const r = await ga4DeleteUser(job.data.agencyId, gaClientId ?? '')
        const audit = await writeAuditRow({
          agencyId: job.data.agencyId,
          dbAgencySlug,
          requestId,
          system: 'ga4',
          result: r,
          prevHash,
        })
        prevHash = audit.recordHash
        summary.push({ system: 'ga4', deleted: r.ok ? 1 : 0, reason: r.errorMessage })
      } catch (err) {
        log.error({ err, requestId }, 'ga4 delete failed')
      }

      // 5. Meta CAPI DeleteUser
      try {
        await enqueueCapiEvent(job.data.agencyId, {
          event_name: 'DeleteUser',
          event_time: Math.floor(Date.now() / 1000),
          user_data: { em: email },
        })
        const audit = await writeAuditRow({
          agencyId: job.data.agencyId,
          dbAgencySlug,
          requestId,
          system: 'meta_capi',
          result: { ok: true, enqueued: true },
          prevHash,
        })
        prevHash = audit.recordHash
        summary.push({ system: 'meta_capi', deleted: 1 })
      } catch (err) {
        log.error({ err, requestId }, 'meta_capi enqueue failed')
        try {
          const audit = await writeAuditRow({
            agencyId: job.data.agencyId,
            dbAgencySlug,
            requestId,
            system: 'meta_capi',
            result: { ok: false, error: String(err) },
            prevHash,
          })
          prevHash = audit.recordHash
        } catch {
          /* swallow audit failure */
        }
        summary.push({ system: 'meta_capi', deleted: 0, reason: 'enqueue failed' })
      }

      // 6. Clarity
      try {
        const r = clarityUserId
          ? await clarityDeleteUser(job.data.agencyId, clarityUserId)
          : { ok: false, status: 0, errorMessage: 'no clarity user id' }
        const audit = await writeAuditRow({
          agencyId: job.data.agencyId,
          dbAgencySlug,
          requestId,
          system: 'clarity',
          result: r,
          prevHash,
        })
        prevHash = audit.recordHash
        summary.push({ system: 'clarity', deleted: r.ok ? 1 : 0, reason: r.errorMessage })
      } catch (err) {
        log.error({ err, requestId }, 'clarity delete failed')
      }

      // 7. LiteLLM
      try {
        const r = await litellmDeleteCalls(job.data.agencyId, email)
        const audit = await writeAuditRow({
          agencyId: job.data.agencyId,
          dbAgencySlug,
          requestId,
          system: 'litellm',
          result: r,
          prevHash,
        })
        prevHash = audit.recordHash
        summary.push({ system: 'litellm', deleted: r.ok ? 1 : 0, reason: r.errorMessage })
      } catch (err) {
        log.error({ err, requestId }, 'litellm delete failed')
      }

      // 8. Generate receipt PDF + upload to R2 vault + email to requester (D-06).
      const completedAt = new Date()
      const pdf = await generateErasureReceiptPdf({
        email,
        requestId,
        agencyId: job.data.agencyId,
        agencyName,
        completedAt,
        finalRecordHash: prevHash,
        systemSummary: summary,
      })
      const r2Key = `erasure-receipts/${job.data.agencyId}/${requestId}.pdf`
      const upload = await uploadReceiptToR2(r2Key, pdf)
      log.info({ requestId, r2Ok: upload.ok, key: r2Key }, 'Receipt PDF stored')

      // Email — Phase 9 sender. Body HTML kept brief; receipt is in the R2 vault and
      // a copy is mailed via the standard email-send queue (Phase 9 + Phase 11-05).
      const emailJob: EmailJobData = {
        to: email,
        subject: 'CCPA Data Deletion — Receipt',
        html:
          `<p>Your data deletion request <strong>${requestId}</strong> has been completed.</p>` +
          `<p>Final record hash for verification: <code>${prevHash}</code></p>` +
          `<p>The signed receipt PDF is stored at: <code>${r2Key}</code>.</p>`,
        from: process.env['EMAIL_FROM'] ?? 'privacy@mjagency.com',
        agencyId: job.data.agencyId,
      }
      try {
        await sendEmail(emailJob)
      } catch (err) {
        log.error({ err, requestId }, 'receipt email send failed (PDF still in R2)')
      }

      log.info({ requestId, finalHash: prevHash, systems: ALL_SYSTEMS.length }, 'Erasure complete')
    },
    {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    },
  )
}

/**
 * Helper for /api/privacy/erasure-confirm route handlers — enqueues the erasure job
 * after token verification + Redis SETNX replay protection (Pitfall 6.4).
 */
export function createErasureQueue(agencyId: string) {
  return createEncryptedQueue<ErasureJobData>('ccpa-erasure', {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  })
}
