/**
 * packages/builder/src/actions/save-draft.ts
 * Auto-save draft without publishing.
 * CLAUDE.md Rule 3: requireSession() as first line.
 */
'use server'
import { requireSession } from '@mjagency/auth'
import { createLogger } from '@mjagency/config'

const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

export interface SaveDraftInput {
  agencyId: string
  pageId: string
  puckData: object
}

export async function saveDraft(input: SaveDraftInput): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  const log = createLogger({ service: 'mjagency-builder', agencyId: input.agencyId })

  const res = await fetch(`${PAYLOAD_URL}/api/pages/${input.pageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    body: JSON.stringify({ status: 'draft', puck_data: input.puckData }),
  })

  if (!res.ok) {
    log.error({ pageId: input.pageId }, 'Auto-save draft failed')
    return { ok: false, error: 'Changes could not be saved.' }
  }

  return { ok: true }
}
