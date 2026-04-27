/**
 * packages/seo/src/actions/compute-live-score.ts
 *
 * computeLiveScore() — adapter for the builder SEO score widget.
 * Wraps runPluginEngine with a simplified input signature suited for
 * the Puck builder context (title + meta description as content proxy).
 *
 * This provides a stable interface for packages/builder without
 * exposing the full PluginEngineInput complexity to the builder layer.
 *
 * The builder calls this server-side during initial render to seed the
 * SEO score widget. Live rescore on meta changes is handled client-side
 * via a debounced server action call.
 */

import { runPluginEngine } from '../engine.js'

export interface ComputeLiveScoreInput {
  agencyId: string
  /** Page title or meta title */
  content: string
  metaDescription?: string
  focusKeyword?: string
  pageType?: string
}

export interface ComputeLiveScoreOutput {
  /** Aggregate SEO score 0-100 */
  score: number
  breakdown: {
    seoClassic: number
    aioCitations: number
    geoChunking: number
  }
}

/**
 * Computes a live SEO score for the builder SEO widget.
 * Uses the Phase 6 plugin engine. Returns { score: 0 } on error
 * so the builder renders gracefully even when engine is unavailable.
 *
 * @param input - Agency ID + content to score
 * @returns Score 0-100 with plugin breakdown
 */
export async function computeLiveScore(
  input: ComputeLiveScoreInput,
): Promise<ComputeLiveScoreOutput> {
  // Build a minimal Lexical JSON document wrapping the title text
  // so the plugin engine can parse heading + word count signals.
  const lexicalDocument = {
    root: {
      children: [
        {
          children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: input.content, type: 'text', version: 1 }],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'heading',
          version: 1,
          tag: 'h1',
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }

  const result = await runPluginEngine({
    lexicalRaw: lexicalDocument,
    metaTitle: input.content,
    metaDescription: input.metaDescription ?? '',
    focusKeyword: input.focusKeyword,
    pageType: input.pageType ?? 'page',
    agencyId: input.agencyId,
  })

  return {
    score: result.aggregateScore,
    breakdown: {
      seoClassic: result.seoClassicScore,
      aioCitations: result.aioCitationsScore,
      geoChunking: result.geoChunkingScore,
    },
  }
}
