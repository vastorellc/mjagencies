import { unstable_cache } from 'next/cache'

const PAYLOAD_API_BASE = process.env['PAYLOAD_API_URL'] ?? 'http://localhost:3000'

export interface CmsPage {
  id: string
  slug: string
  title: string
  meta_title?: string
  meta_description?: string
  canonical_url?: string
  aio_tldr?: string
  ai_disclosure_required?: boolean
  featured_image?: {
    cloudflare_image_id: string
    alt_text: string
    width: number
    height: number
    blurhash?: string
  }
  faqs?: Array<{ question: string; answer: string }>
  content?: unknown
  status: 'published' | 'draft' | 'scheduled'
  page_type?: string
}

export function fetchPageBySlug(agencyId: string, slug: string): Promise<CmsPage | null> {
  return unstable_cache(
    async () => {
      const url = new URL(`${PAYLOAD_API_BASE}/api/pages`)
      url.searchParams.set('where[agency_id][equals]', agencyId)
      url.searchParams.set('where[slug][equals]', slug)
      url.searchParams.set('where[status][equals]', 'published')
      url.searchParams.set('limit', '1')

      const res = await fetch(url.toString(), {
        next: { tags: [`agency:${agencyId}:page:${slug}`, `agency:${agencyId}:collection:pages`] },
      })
      if (!res.ok) return null
      const data = await res.json() as { docs: CmsPage[] }
      return data.docs[0] ?? null
    },
    [`page-${agencyId}-${slug}`],
    { tags: [`agency:${agencyId}:page:${slug}`, `agency:${agencyId}:collection:pages`], revalidate: 60 },
  )()
}

export function fetchPagesIndex(agencyId: string, pageType?: string): Promise<CmsPage[]> {
  const cacheKey = pageType ? `pages-${agencyId}-${pageType}` : `pages-${agencyId}`
  const tag = `agency:${agencyId}:collection:pages`

  return unstable_cache(
    async () => {
      const url = new URL(`${PAYLOAD_API_BASE}/api/pages`)
      url.searchParams.set('where[agency_id][equals]', agencyId)
      url.searchParams.set('where[status][equals]', 'published')
      if (pageType) url.searchParams.set('where[page_type][equals]', pageType)
      url.searchParams.set('limit', '100')
      url.searchParams.set('sort', 'sort_order')

      const res = await fetch(url.toString(), {
        next: { tags: [tag] },
      })
      if (!res.ok) return []
      const data = await res.json() as { docs: CmsPage[] }
      return data.docs
    },
    [cacheKey],
    { tags: [tag], revalidate: 60 },
  )()
}

export async function fetchAllPageSlugs(agencyId: string): Promise<string[]> {
  const pages = await fetchPagesIndex(agencyId)
  return pages.map(p => p.slug)
}
