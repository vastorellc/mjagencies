/**
 * packages/proposals/src/actions/create-proposal.ts
 * REQ-125: proposal creation with 14-day expiry.
 * CLAUDE.md Rule 3: requireSession() as first line.
 */
'use server'
import { randomBytes } from 'crypto'
import { requireSession } from '@mjagency/auth'
import { createLogger } from '@mjagency/config'

export interface CreateProposalInput {
  agencyId: string
  contactId?: string
  dealId?: string
  title: string
  bodyJson: object
}

export interface CreateProposalOutput {
  ok: boolean
  proposalId?: string
  publicUrl?: string
  error?: string
}

const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

export async function createProposal(input: CreateProposalInput): Promise<CreateProposalOutput> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  const log = createLogger({ service: 'mjagency-proposals', agencyId: input.agencyId })

  // Generate cryptographically random 32-byte hex token
  const token = randomBytes(32).toString('hex')

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const graceEndsAt = new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000)

  const proposalData = {
    agency_id: input.agencyId,
    title: input.title,
    token,
    status: 'active',
    body_json: input.bodyJson,
    contact_id: input.contactId,
    deal_id: input.dealId,
    sent_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    grace_ends_at: graceEndsAt.toISOString(),
  }

  const res = await fetch(`${PAYLOAD_URL}/api/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    body: JSON.stringify(proposalData),
  })

  if (!res.ok) {
    log.error({ status: res.status }, 'Failed to create proposal')
    return { ok: false, error: 'Failed to create proposal. Please try again.' }
  }

  const created = await res.json() as { id: string }
  const publicUrl = `/proposals/${token}`

  log.info({ proposalId: created.id }, 'Proposal created')
  return { ok: true, proposalId: created.id, publicUrl }
}
