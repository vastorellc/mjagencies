/**
 * apps/web-main/src/app/api/sms/status/route.ts
 *
 * Shared Twilio SMS status callback endpoint.
 * Configured as the Twilio webhook URL in the Twilio dashboard.
 *
 * CLAUDE.md §7: raw body via req.text() for Twilio signature validation.
 * Delegates to handleTwilioStatusWebhook from @mjagency/sms.
 *
 * REQ-423
 */
export const runtime = 'nodejs'

import { handleTwilioStatusWebhook } from '@mjagency/sms'

export async function POST(req: Request): Promise<Response> {
  // Raw body for signature validation — MUST be called before any JSON parse (CLAUDE.md §7)
  const rawBody = await req.text()

  const sig = req.headers.get('x-twilio-signature') ?? ''
  const agencyId = req.headers.get('x-agency-id') ?? new URL(req.url).searchParams.get('agencyId') ?? ''

  if (!agencyId) {
    return Response.json({ error: 'Missing agencyId' }, { status: 400 })
  }

  // Full URL required for Twilio signature validation
  const requestUrl = req.url

  return handleTwilioStatusWebhook(rawBody, sig, requestUrl, agencyId)
}
