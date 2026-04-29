/**
 * packages/cms/src/lib/fetch-case-studies.ts
 *
 * Server-side fetchers for the `case-studies` Payload collection.
 * Mirrors the CmsPage / CmsPost pattern (unstable_cache + ISR cache tags
 * keyed on agency_id), so case-studies/[slug] routes get the same
 * cache-purge guarantees as other content.
 *
 * Backlog 999.1 Pre-D — required by case-studies/[slug]/page.tsx routes.
 */
import { unstable_cache } from 'next/cache'

const PAYLOAD_API_BASE = process.env['PAYLOAD_API_URL'] ?? 'http://localhost:3000'

export interface CmsCaseStudy {
  id: string
  slug: string
  title: string
  client: string
  challenge: string
  solution: string
  results: string
  meta_title?: string
  meta_description?: string
  canonical_url?: string
  aio_tldr?: string
  featured_image?: {
    cloudflare_image_id: string
    alt_text: string
    width: number
    height: number
    blurhash?: string
  }
  content?: unknown
  status: 'published' | 'draft' | 'archived'
}

const collectionTag = (agencyId: string): string =>
  `agency:${agencyId}:collection:case-studies`

const recordTag = (agencyId: string, slug: string): string =>
  `agency:${agencyId}:case-study:${slug}`

export function fetchCaseStudyBySlug(
  agencyId: string,
  slug: string,
): Promise<CmsCaseStudy | null> {
  return unstable_cache(
    async () => {
      const url = new URL(`${PAYLOAD_API_BASE}/api/case-studies`)
      url.searchParams.set('where[agency_id][equals]', agencyId)
      url.searchParams.set('where[slug][equals]', slug)
      url.searchParams.set('where[status][equals]', 'published')
      url.searchParams.set('limit', '1')

      const res = await fetch(url.toString(), {
        next: { tags: [recordTag(agencyId, slug), collectionTag(agencyId)] },
      })
      if (!res.ok) return null
      const data = (await res.json()) as { docs: CmsCaseStudy[] }
      return data.docs[0] ?? null
    },
    [`case-study-${agencyId}-${slug}`],
    {
      tags: [recordTag(agencyId, slug), collectionTag(agencyId)],
      revalidate: 60,
    },
  )()
}

export function fetchCaseStudiesIndex(
  agencyId: string,
  limit = 50,
): Promise<CmsCaseStudy[]> {
  return unstable_cache(
    async () => {
      const url = new URL(`${PAYLOAD_API_BASE}/api/case-studies`)
      url.searchParams.set('where[agency_id][equals]', agencyId)
      url.searchParams.set('where[status][equals]', 'published')
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('sort', '-updatedAt')

      const res = await fetch(url.toString(), {
        next: { tags: [collectionTag(agencyId)] },
      })
      if (!res.ok) return []
      const data = (await res.json()) as { docs: CmsCaseStudy[] }
      return data.docs
    },
    [`case-studies-${agencyId}`],
    { tags: [collectionTag(agencyId)], revalidate: 60 },
  )()
}

export async function fetchAllCaseStudySlugs(agencyId: string): Promise<string[]> {
  const items = await fetchCaseStudiesIndex(agencyId, 1000)
  return items.map((c) => c.slug)
}
