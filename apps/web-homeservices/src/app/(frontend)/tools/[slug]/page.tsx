/**
 * apps/web-homeservices/src/app/(frontend)/tools/[slug]/page.tsx
 *
 * Tool landing page route for the homeservices agency.
 * REQ-413: result is inline — NOT a separate indexed page.
 * REQ-124: benchmark expiry checked per tool.
 * ISR: generateStaticParams() pre-renders all 3 homeservices tools at build time.
 */
import { notFound } from 'next/navigation'
import { getToolBySlug, getToolsByAgency, loadBenchmarks } from '@mjagency/tools'
import { ToolPageTemplate } from '@mjagency/tools/pages'
import type { Metadata } from 'next'

const AGENCY_SLUG = 'homeservices'

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

  return (
    <ToolPageTemplate
      tool={tool}
      benchmarks={benchmarks}
      agencySlug={AGENCY_SLUG}
    />
  )
}
