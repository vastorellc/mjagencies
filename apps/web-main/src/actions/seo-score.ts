'use server'
/**
 * apps/web-main/src/actions/seo-score.ts
 *
 * Server actions for live SEO scoring and TL;DR generation.
 * CLAUDE.md Rule 3: auth check mandatory as first lines of every server action.
 * CLAUDE.md Rule 8: agency isolation — session.agencyId must match input.agencyId.
 *
 * REQ-071, REQ-072: computeLiveScore calls runPluginEngine
 * REQ-075: generateTldr generates AIO TL;DR via LiteLLM
 */
import { requireSession } from '@mjagency/auth'
import { runPluginEngine } from '@mjagency/seo'
import type { PluginEngineInput, LiveSeoScore } from '@mjagency/seo'

export interface ComputeLiveScoreInput {
  content: unknown
  metaTitle?: string
  metaDescription?: string
  focusKeyword?: string
  aioTldr?: string
  pageType?: string
  agencyId: string
}

export async function computeLiveScore(input: ComputeLiveScoreInput): Promise<LiveSeoScore> {
  // CLAUDE.md Rule 3: auth check as first lines
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  const engineInput: PluginEngineInput = {
    lexicalRaw: input.content,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    focusKeyword: input.focusKeyword,
    aioTldr: input.aioTldr,
    pageType: input.pageType,
    agencyId: input.agencyId,
  }
  return runPluginEngine(engineInput)
}

export interface GenerateTldrInput {
  agencyId: string
  agencySlug: string
  content: unknown
}

export async function generateTldr(input: GenerateTldrInput): Promise<string> {
  // CLAUDE.md Rule 3: auth check as first lines
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  // Fallback: if LITELLM_API_URL absent, return '' (D-06)
  if (!process.env['LITELLM_API_URL']) return ''

  const { generateContent } = await import('@mjagency/ai')
  const contentStr =
    typeof input.content === 'string'
      ? input.content
      : JSON.stringify(input.content).slice(0, 3000)

  const result = await generateContent({
    prompt: `Write a single-sentence summary (max 120 characters) of this page content for AI answer engines. Return only the summary text, no quotes, no label:\n\n${contentStr}`,
    agencySlug: input.agencySlug,
    pageType: 'blog',
    maxTokens: 80,
  })
  // Truncate to 120 chars if model over-generates
  return result.slice(0, 120)
}
