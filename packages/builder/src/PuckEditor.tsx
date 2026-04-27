/**
 * packages/builder/src/PuckEditor.tsx
 *
 * Server component — MUST be the outermost builder component.
 * REQ-132: server-side session check BEFORE rendering Puck.
 * CLAUDE.md Puck Rules:
 *   - Puck editor wrapped in server-side session check
 *   - Auth cookie enables UI toggle ONLY — server validates session + agency ownership
 *   - Puck outputs JSON, never dangerouslySetInnerHTML
 *   - All block components sanitize string inputs
 *
 * Usage in agency app:
 *   import { PuckEditor } from '@mjagency/builder'
 *   // In a Next.js page (Server Component):
 *   export default async function BuilderPage({ params }) {
 *     return <PuckEditor agencyId={AGENCY_ID} pageId={params.pageId} />
 *   }
 */
import { redirect } from 'next/navigation'
import { requireSession } from '@mjagency/auth'
import { computeLiveScore } from '@mjagency/seo'
import { PuckEditorClient } from './PuckEditorClient.js'

const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

interface PuckEditorProps {
  agencyId: string
  pageId: string
}

interface PayloadPageDoc {
  id: string
  title: string
  meta_title?: string
  meta_description?: string
  slug: string
  status: string
  puck_data?: object
  agency_id: string
}

export async function PuckEditor({ agencyId, pageId }: PuckEditorProps): Promise<React.ReactElement> {
  // CLAUDE.md Puck Rules: server-side session check — NOT cookie-only
  // requireSession() returns session or redirects to /login
  const session = await requireSession()

  // Agency ownership check — REQ-132
  if (session.agencyId !== agencyId) {
    redirect('/login')
  }

  // Fetch page data for initial state
  const pageRes = await fetch(`${PAYLOAD_URL}/api/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    cache: 'no-store',
  })

  if (!pageRes.ok) {
    redirect('/login')
  }

  const page = (await pageRes.json()) as PayloadPageDoc

  // Double-check page belongs to this agency (belt + suspenders)
  if (page.agency_id !== agencyId) {
    redirect('/login')
  }

  // Compute initial SEO score server-side
  let seoScore = 0
  try {
    const scoreResult = await computeLiveScore({
      agencyId,
      content: page.meta_title ?? page.title,
      metaDescription: page.meta_description ?? '',
    })
    seoScore = scoreResult.score
  } catch {
    // Non-fatal — editor still renders with score 0
  }

  return (
    <PuckEditorClient
      agencyId={agencyId}
      pageId={pageId}
      initialPuckData={page.puck_data ?? {}}
      initialMeta={{
        title: page.meta_title ?? page.title,
        description: page.meta_description ?? '',
        slug: page.slug,
      }}
      initialSeoScore={seoScore}
    />
  )
}
