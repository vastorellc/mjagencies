'use server'
/**
 * apps/web-main/src/actions/ai-editor.ts
 * Phase 7 — server actions for 20 AI editor toolbar features (REQ-081).
 * CLAUDE.md Rule 3: every action begins with requireSession() + agencyId guard.
 * CLAUDE.md Rule 8: agency isolation — session.agencyId must match input.agencyId.
 */
import { requireSession } from '@mjagency/auth'
import type { AiEditorActionResult } from '@mjagency/ai'

export interface AiActionInput {
  text: string // selection or full content depending on action
  agencyId: string
  agencySlug?: string
  brandVoiceContext?: string // Plan 07-04 supplies; for now optional
}

// 1. Draft from title
export async function draftFromTitle(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiDraftFromTitle } = await import('@mjagency/ai')
  return aiDraftFromTitle(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 2. Rewrite selection
export async function rewriteSelection(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiRewrite } = await import('@mjagency/ai')
  return aiRewrite(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 3. Shorten selection
export async function shortenSelection(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiShorten } = await import('@mjagency/ai')
  return aiShorten(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 4. Expand selection
export async function expandSelection(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiExpand } = await import('@mjagency/ai')
  return aiExpand(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 5. Simplify selection
export async function simplifySelection(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiSimplify } = await import('@mjagency/ai')
  return aiSimplify(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 6. Fix grammar
export async function fixGrammar(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiFixGrammar } = await import('@mjagency/ai')
  return aiFixGrammar(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 7. Tone: formal
export async function toneFormal(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiToneFormal } = await import('@mjagency/ai')
  return aiToneFormal(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 8. Tone: conversational
export async function toneConversational(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiToneConversational } = await import('@mjagency/ai')
  return aiToneConversational(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 9. Tone: persuasive
export async function tonePersuasive(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiTonePersuasive } = await import('@mjagency/ai')
  return aiTonePersuasive(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 10. Summarize paragraph
export async function summarizeParagraph(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiSummarizeParagraph } = await import('@mjagency/ai')
  return aiSummarizeParagraph(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 11. Generate meta description
export async function generateMetaDescription(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiMetaDescription } = await import('@mjagency/ai')
  return aiMetaDescription(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 12. Suggest H2 headings
export async function suggestH2Headings(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiSuggestH2 } = await import('@mjagency/ai')
  return aiSuggestH2(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 13. Write FAQ answer
export async function writeFaqAnswer(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiWriteFaqAnswer } = await import('@mjagency/ai')
  return aiWriteFaqAnswer(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 14. Generate CTA text
export async function generateCta(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiGenerateCta } = await import('@mjagency/ai')
  return aiGenerateCta(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 15. Translate to Spanish
export async function translateSpanish(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiTranslateSpanish } = await import('@mjagency/ai')
  return aiTranslateSpanish(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 16. Add transition sentence
export async function addTransition(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiAddTransition } = await import('@mjagency/ai')
  return aiAddTransition(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 17. Bullet-point extraction
export async function bulletExtract(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiBulletExtract } = await import('@mjagency/ai')
  return aiBulletExtract(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 18. Counter-argument / steelman
export async function counterArgument(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiCounterArgument } = await import('@mjagency/ai')
  return aiCounterArgument(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 19. Suggest stat category — anti-fabrication guard always applied
export async function suggestStat(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  const { aiSuggestStat } = await import('@mjagency/ai')
  return aiSuggestStat(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext: input.brandVoiceContext,
  })
}

// 20. Brand voice rewrite
export async function brandVoiceRewrite(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  const { aiBrandVoiceRewrite, getBrandVoiceContext } = await import('@mjagency/ai')

  // Load per-agency brand context if not provided by caller (Plan 07-04)
  let brandVoiceContext = input.brandVoiceContext ?? ''
  if (!brandVoiceContext) {
    const { getPayload } = await import('payload')
    const config = await import('@payload-config')
    const payload = await getPayload({ config: config.default })
    brandVoiceContext = await getBrandVoiceContext(input.agencyId, payload)
  }

  return aiBrandVoiceRewrite(input.text, input.agencyId, {
    agencySlug: input.agencySlug,
    brandVoiceContext,
  })
}
