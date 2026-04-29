/**
 * apps/web-restaurant/src/app/(frontend)/tools/[slug]/page.tsx
 *
 * Tool landing page route for the restaurant agency.
 * REQ-413: result is inline — NOT a separate indexed page.
 * REQ-124: benchmark expiry checked per tool.
 * ISR: generateStaticParams() pre-renders all 3 restaurant tools at build time.
 */
import { notFound } from 'next/navigation'
import { getToolBySlug, getToolsByAgency, loadBenchmarks } from '@mjagency/tools'
import { ToolPageTemplate } from '@mjagency/tools/pages'
import { fetchPageBySlug } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'
import type { Metadata } from 'next'

const AGENCY_SLUG = 'restaurant'

interface ToolPageProps {
  params: Promise<{ slug: string }>
}

/** ISR: pre-render all tools for this agency at build time */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const tools = getToolsByAgency(AGENCY_SLUG)
  return tools.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params
  const tool = getToolBySlug(slug)
  if (!tool || tool.agencySlug !== AGENCY_SLUG) return {}
  return {
    title: tool.name,
    description: `Use the ${tool.name} to estimate your results with industry benchmarks.`,
  }
}

export default async function ToolPage({ params }: ToolPageProps): Promise<React.JSX.Element> {
  const { slug } = await params
  const tool = getToolBySlug(slug)

  // Guard: tool must exist AND belong to this agency
  if (!tool || tool.agencySlug !== AGENCY_SLUG) {
    notFound()
  }

  // Load benchmarks server-side (static JSON import — no runtime DB query)
  const benchmarks = await loadBenchmarks(AGENCY_SLUG, tool.benchmarkKeys)

  // CMS marketing content (featured_image hero) — keyed by tool slug.
  // Tool calculator data and CMS marketing data are decoupled (D-03 in
  // 999.1-CONTEXT.md): tools package owns calculation logic, CMS owns
  // imagery + copy. Conditional render — if no CMS record, no hero.
  const cmsPage = await fetchPageBySlug(AGENCY_SLUG, slug)

  return (
    <>
      {cmsPage?.featured_image && (
        <MjImage
          cloudflareImageId={cmsPage.featured_image.cloudflare_image_id}
          alt={cmsPage.featured_image.alt_text}
          width={cmsPage.featured_image.width}
          height={cmsPage.featured_image.height}
          priority
          sizes="(min-width: 1280px) 1200px, 100vw"
          style={{ borderRadius: 'var(--mj-radius-lg)', marginBottom: 'var(--mj-space-12)' }}
        />
      )}
      <ToolPageTemplate
        tool={tool}
        benchmarks={benchmarks}
        agencySlug={AGENCY_SLUG}
      />
    </>
  )
}
