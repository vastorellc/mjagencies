/**
 * apps/web-main/src/jobs/tool-pdf-email-bridge.ts
 *
 * Drains the `tool-pdf-email` queue produced by the public tool flows
 * (packages/tools/src/actions/email-gate.ts and resend-pdf.ts) and re-enqueues
 * onto the `email-send` queue that the existing email worker consumes.
 *
 * Why this exists
 * ───────────────
 * The audit found that handleEmailGate / handleResendPdf both enqueue to
 * `tool-pdf-email`, but no worker ever subscribed. Every "Get my PDF" click
 * looked successful in the UI (modal POST returned ok:true) and then the
 * email never arrived. Symmetrical to the Stripe-events fix in 2169cfa.
 *
 * Architecture choice
 * ───────────────────
 * Rather than build a parallel email-sending pipeline, this worker bridges
 * `tool-pdf-email` → `email-send`. Benefits:
 *   1. Reuses the existing SMTP transport, warm-up gate, error handling,
 *      and Meta CAPI hooks that live in @mjagency/email's worker.
 *   2. The email subject/body are constructed once here and the rest of the
 *      delivery pipeline doesn't know it came from a tool flow.
 *   3. If we later add PDF attachments, that's a single edit to this bridge
 *      — no change to email-send / SMTP layer.
 *
 * Render contract
 * ───────────────
 * `renderToolResult()` already returns DOMPurify-sanitized HTML — we wrap
 * it in a minimal HTML email shell with the agency's brand color tokens
 * (rendered as inline CSS variables). Email clients that strip CSS still
 * render the metric values + disclaimer.
 *
 * Per-agency Redis isolation
 * ──────────────────────────
 * Producers use `keyPrefix: REDIS_KEY.bullPrefix(input.agencySlug)`, so we
 * spawn one Worker per agency mirroring that prefix scheme — same pattern
 * as the Stripe webhook bridge. Agency IDs are the canonical 12.
 */

import type { Worker, Job } from 'bullmq'
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'
import { getToolBySlug, renderToolResult } from '@mjagency/tools'
import type { ToolResult } from '@mjagency/tools'
import type { EmailJobData } from '@mjagency/email'

// ── Types ───────────────────────────────────────────────────────────────────

/** Wire shape produced by the public tool email-gate / resend-pdf handlers. */
export interface ToolPdfEmailJobData {
  email:          string
  toolSlug:       string
  toolResultJson: string
  agencySlug:     string
}

/** Dependency-injected port surface. Tests drive the router via this. */
export interface ToolPdfEmailDeps {
  enqueueEmail: (job: EmailJobData) => Promise<void>
  log:          (msg: string, fields?: Record<string, unknown>) => void
}

// ── Constants ───────────────────────────────────────────────────────────────

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

const AGENCY_IDS = [
  'ai', 'branding', 'ecommerce', 'engineering', 'finance', 'graphic',
  'growth', 'main', 'product', 'strategy', 'video', 'webdev',
] as const

// ── Pure router ─────────────────────────────────────────────────────────────

/**
 * Convert one `tool-pdf-email` job into one `email-send` job and enqueue it.
 *
 * Returns without throwing on permanent input errors (unknown tool slug,
 * malformed JSON) — those would only retry-storm BullMQ. Throws on
 * downstream enqueue failures so BullMQ's retry policy fires.
 */
export async function processToolPdfEmail(
  data: ToolPdfEmailJobData,
  deps: ToolPdfEmailDeps,
): Promise<void> {
  const { email, toolSlug, toolResultJson, agencySlug } = data

  const tool = getToolBySlug(toolSlug)
  if (!tool) {
    deps.log('tool_not_found_dropping', { toolSlug, agencySlug })
    return
  }

  let result: ToolResult
  try {
    result = JSON.parse(toolResultJson) as ToolResult
  } catch {
    deps.log('invalid_tool_result_json_dropping', { toolSlug, agencySlug })
    return
  }

  if (!result || typeof result !== 'object' || !Array.isArray(result.metrics)) {
    deps.log('tool_result_shape_invalid_dropping', { toolSlug, agencySlug })
    return
  }

  const fromAddress =
    process.env['EMAIL_FROM'] ??
    process.env['SMTP_FROM'] ??
    'noreply@mjagency.com'

  const sanitizedResultHtml = renderToolResult(result)

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
    <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">Your ${escapeHtml(tool.name)} report</h1>
    <p style="margin-bottom: 16px;">Thanks for using our ${escapeHtml(tool.name)}. Below are your results:</p>
    ${sanitizedResultHtml}
    <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;">
    <p style="font-size: 14px; color: #666;">
      Want a deeper analysis tailored to your business? Reply to this email or
      visit <a href="https://mjagency.com/contact">mjagency.com/contact</a>.
    </p>
  </body>
</html>`

  await deps.enqueueEmail({
    to:       email,
    from:     fromAddress,
    subject:  `Your ${tool.name} report`,
    html,
    agencyId: agencySlug,
  })

  deps.log('tool_pdf_email_bridged', { toolSlug, agencySlug })
}

/**
 * Minimal HTML escape for the tool name. The tool name is a developer-controlled
 * string (defined in `packages/tools/src/tools/*`) so this is a defensive
 * rather than required guard, but it costs nothing.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Worker bootstrap ────────────────────────────────────────────────────────

/** Start the bridge worker for ONE agency. */
export function startToolPdfEmailBridge(agencyId: string): Worker {
  const log = createLogger({ service: 'mjagency-tool-pdf-email-bridge', agencyId })

  const deps: ToolPdfEmailDeps = {
    enqueueEmail: async (job) => {
      const queue = createEncryptedQueue<EmailJobData>('email-send', {
        host:      REDIS_HOST,
        port:      REDIS_PORT,
        keyPrefix: REDIS_KEY.bullPrefix(job.agencyId),
      })
      // sensitiveData:true — the body has the visitor's email + their tool
      // results, both PII per CCPA. Encrypt at rest in Redis.
      await (queue as unknown as {
        add: (n: string, d: EmailJobData, o: object) => Promise<void>
      }).add('send', job, { sensitiveData: true })
    },

    log: (msg, fields) => log.info(fields ?? {}, msg),
  }

  return createEncryptedWorker<ToolPdfEmailJobData>(
    'tool-pdf-email',
    async (job: Job<ToolPdfEmailJobData>) => {
      // Defence-in-depth: refuse to bridge a job whose declared agencySlug
      // doesn't match the worker's. A mismatch means the Redis prefix
      // isolation broke; better to drop than to email a wrong-agency report.
      if (job.data.agencySlug !== agencyId) {
        log.warn(
          {
            jobAgency:    job.data.agencySlug,
            workerAgency: agencyId,
            toolSlug:     job.data.toolSlug,
          },
          'cross_tenant_tool_email_dropped',
        )
        return
      }
      await processToolPdfEmail(job.data, deps)
    },
    {
      host:      REDIS_HOST,
      port:      REDIS_PORT,
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    },
  )
}

/** Spawn one bridge per agency. Wired from `register-all-workers.ts`. */
export function registerToolPdfEmailBridges(): Worker[] {
  return AGENCY_IDS.map(startToolPdfEmailBridge)
}
