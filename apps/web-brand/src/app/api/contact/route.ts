// Public contact form endpoint. No auth check — public API route by design (not a server action).
export const runtime = 'nodejs'

import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'
import { createLogger } from '@mjagency/config'
import type { FormSubmissionJobData } from '@mjagency/forms'

const log = createLogger({ service: 'mjagency-contact-route' })

export async function POST(req: Request): Promise<Response> {
  const body = await req.json() as Record<string, unknown>

  if (body['_hp']) {
    return Response.json({ ok: true })
  }

  const agencyId = req.headers.get('x-agency-id') ?? (body['agencyId'] as string | undefined)
  if (!agencyId) {
    return Response.json({ error: 'Missing agency' }, { status: 400 })
  }

  const name = (body['name'] as string | undefined) ?? ''
  const email = (body['email'] as string | undefined) ?? ''
  const message = (body['message'] as string | undefined) ?? ''
  const phone = body['phone'] as string | undefined

  if (!name.trim() || !email.trim() || !message.trim()) {
    return Response.json({ error: 'Missing required fields' }, { status: 422 })
  }

  // Plan 11-03 — capture client IP + UA at request time so the form worker can
  // include them in the Meta CAPI Lead event (Pitfall 3.5: ip+ua fallback identifier).
  const clientIp = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? undefined
  const clientUserAgent = req.headers.get('user-agent') ?? undefined

  const jobData: FormSubmissionJobData = {
    agencyId,
    name: name.trim(),
    email: email.trim(),
    phone: phone?.trim(),
    message: message.trim(),
    utmSource: body['utm_source'] as string | undefined,
    utmMedium: body['utm_medium'] as string | undefined,
    utmCampaign: body['utm_campaign'] as string | undefined,
    clientIp,
    clientUserAgent,
  }

  const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
  const queue = createEncryptedQueue<FormSubmissionJobData>('form-submissions', {
    host: redisHost,
    port: redisPort,
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  })

  await (queue as unknown as {
    add: (name: string, data: FormSubmissionJobData, opts: Record<string, unknown>) => Promise<void>
  }).add('process-form', jobData, { sensitiveData: true })

  log.info({ agencyId }, 'Form submission enqueued')
  return Response.json({ ok: true })
}
