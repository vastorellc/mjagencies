/**
 * packages/builder/src/actions/publish-page.ts
 * REQ-131: publish via server action.
 * CLAUDE.md Rule 3: requireSession() as first line.
 * CLAUDE.md Puck Rules: save via server action with auth check.
 */
'use server'
import { requireSession } from '@mjagency/auth'
import { createLogger } from '@mjagency/config'

const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

export interface PublishPageInput {
  agencyId: string
  pageId: string
  puckData: object
  meta: { title: string; description: string; slug: string }
}

export interface PublishPageOutput {
  ok: boolean
  error?: string
}

export async function publishPage(input: PublishPageInput): Promise<PublishPageOutput> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  const log = createLogger({ service: 'mjagency-builder', agencyId: input.agencyId })

  const res = await fetch(`${PAYLOAD_URL}/api/pages/${input.pageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    body: JSON.stringify({
      status: 'published',
      puck_data: input.puckData,
      meta_title: input.meta.title,
      meta_description: input.meta.description,
      slug: input.meta.slug,
      published_at: new Date().toISOString(),
    }),
  })

  if (!res.ok) {
    log.error({ pageId: input.pageId, status: res.status }, 'Publish failed')
    return { ok: false, error: 'Changes could not be saved. Please check your connection and try again.' }
  }

  log.info({ pageId: input.pageId }, 'Page published')
  return { ok: true }
}
