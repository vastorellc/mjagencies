import { unstable_cache } from 'next/cache'
import type { CmsPage } from './fetch-pages.js'

export interface CmsPost {
  id: string
  slug: string
  title: string
  excerpt?: string
  aio_tldr?: string
  ai_disclosure_required?: boolean
  featured_image?: CmsPage['featured_image']
  author?: { name: string; bio?: string; avatar?: CmsPage['featured_image'] }
  category?: { title: string; slug: string }
  content?: unknown
  publishedAt?: string
  status: 'published' | 'draft' | 'scheduled'
}

export function fetchPostBySlug(agencyId: string, slug: string): Promise<CmsPost | null> {
  return unstable_cache(
    async () => {
      const url = new URL(`${(process.env['PAYLOAD_API_URL'] ?? 'http://localhost:3000')}/api/posts`)
      url.searchParams.set('where[agency_id][equals]', agencyId)
      url.searchParams.set('where[slug][equals]', slug)
      url.searchParams.set('where[status][equals]', 'published')
      url.searchParams.set('limit', '1')

      const res = await fetch(url.toString(), {
        next: { tags: [`agency:${agencyId}:post:${slug}`, `agency:${agencyId}:collection:posts`] },
      })
      if (!res.ok) return null
      const data = await res.json() as { docs: CmsPost[] }
      return data.docs[0] ?? null
    },
    [`post-${agencyId}-${slug}`],
    { tags: [`agency:${agencyId}:post:${slug}`, `agency:${agencyId}:collection:posts`], revalidate: 60 },
  )()
}

export function fetchPostsIndex(agencyId: string, limit = 20, page = 1): Promise<{ posts: CmsPost[]; totalDocs: number }> {
  return unstable_cache(
    async () => {
      const url = new URL(`${(process.env['PAYLOAD_API_URL'] ?? 'http://localhost:3000')}/api/posts`)
      url.searchParams.set('where[agency_id][equals]', agencyId)
      url.searchParams.set('where[status][equals]', 'published')
      url.searchParams.set('sort', '-publishedAt')
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('page', String(page))

      const res = await fetch(url.toString(), {
        next: { tags: [`agency:${agencyId}:collection:posts`] },
      })
      if (!res.ok) return { posts: [], totalDocs: 0 }
      const data = await res.json() as { docs: CmsPost[]; totalDocs: number }
      return { posts: data.docs, totalDocs: data.totalDocs }
    },
    [`posts-index-${agencyId}-${page}`],
    { tags: [`agency:${agencyId}:collection:posts`], revalidate: 60 },
  )()
}

export async function fetchAllPostSlugs(agencyId: string): Promise<string[]> {
  const { posts } = await fetchPostsIndex(agencyId, 1000, 1)
  return posts.map(p => p.slug)
}
