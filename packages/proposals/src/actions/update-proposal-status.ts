/**
 * packages/proposals/src/actions/update-proposal-status.ts
 * Handles sign and decline actions from the public proposal page.
 * POST actions require HMAC verification of the proposal token (UI-SPEC security notes).
 * REQ-134: email notifications gated on email warm-up completion check.
 */
import { createHmac, timingSafeEqual } from 'crypto'
import { createLogger } from '@mjagency/config'
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'

const PROPOSAL_HMAC_SECRET = process.env['PROPOSAL_HMAC_SECRET'] ?? ''
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

export interface ProposalActionInput {
  token: string
  action: 'sign' | 'decline'
  /** HMAC-SHA256 signature of token using PROPOSAL_HMAC_SECRET */
  hmacSignature: string
  signatureDataUri?: string
}

export interface ProposalActionOutput {
  ok: boolean
  error?: string
}

/**
 * Checks whether email warm-up for the given agency is complete.
 * REQ-134: 35-day warm-up must complete before sequence/tool/proposal emails activate.
 * Looks up warm-up status from Payload REST API (email_warmup_status collection).
 */
async function isEmailWarmupComplete(agencyId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${PAYLOAD_URL}/api/email_warmup_status?where[agency_id][equals]=${agencyId}&limit=1`,
      { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
    )
    const data = await res.json() as { docs: Array<{ status: string; warmup_complete: boolean }> }
    return data.docs[0]?.warmup_complete === true
  } catch {
    // If warm-up status cannot be determined, default to blocking email dispatch
    return false
  }
}

export async function handleProposalAction(input: ProposalActionInput): Promise<ProposalActionOutput> {
  const log = createLogger({ service: 'mjagency-proposals', agencyId: 'unknown' })

  // Verify HMAC before any state change (timingSafeEqual prevents timing attacks)
  const expected = createHmac('sha256', PROPOSAL_HMAC_SECRET).update(input.token).digest('hex')
  if (!timingSafeEqual(Buffer.from(input.hmacSignature, 'hex'), Buffer.from(expected, 'hex'))) {
    return { ok: false, error: 'Invalid signature' }
  }

  // Fetch proposal by token
  const findRes = await fetch(
    `${PAYLOAD_URL}/api/proposals?where[token][equals]=${input.token}&limit=1`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
  )
  const findData = await findRes.json() as { docs: Array<{ id: string; status: string; agency_id: string }> }

  if (!findData.docs.length) {
    return { ok: false, error: 'Proposal not found' }
  }

  const proposal = findData.docs[0]!

  if (proposal.status === 'expired' || proposal.status === 'grace' || proposal.status === 'nurture') {
    return { ok: false, error: 'This proposal has expired. Contact the agency for an extension.' }
  }

  const now = new Date().toISOString()
  const updateData = input.action === 'sign'
    ? { status: 'signed', signed_at: now }
    : { status: 'declined', declined_at: now }

  await fetch(`${PAYLOAD_URL}/api/proposals/${proposal.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    body: JSON.stringify(updateData),
  })

  // REQ-134: gate notification email on warm-up completion
  // Only enqueue notification if warm-up is complete for this agency
  const warmupReady = await isEmailWarmupComplete(proposal.agency_id)
  if (warmupReady) {
    const emailQueue = createEncryptedQueue<{ agencyId: string; proposalId: string; action: string }>(
      'email-send',
      {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        keyPrefix: REDIS_KEY.bullPrefix(proposal.agency_id),
      },
    )
    await emailQueue.add('proposal-notification', {
      agencyId: proposal.agency_id,
      proposalId: proposal.id,
      action: input.action,
    }, { sensitiveData: true })
    log.info({ proposalId: proposal.id, action: input.action }, 'Proposal notification email enqueued (warm-up complete)')
  } else {
    log.info({ proposalId: proposal.id, action: input.action }, 'Proposal notification email skipped — warm-up not complete (REQ-134)')
  }

  log.info({ proposalId: proposal.id, action: input.action }, 'Proposal action processed')
  return { ok: true }
}
