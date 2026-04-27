/**
 * packages/ai/src/editor-actions.ts
 * Phase 7 — 20 AI editor action functions wrapping generateContent().
 * Replaces Phase 5 stubs in packages/cms/src/editor/ai-hooks-stub.ts.
 * REQ-081
 */
import { generateContent } from './generate-content.js'
import { AiBudgetExceededError } from './cost-cap.js'
import { PromptInjectionError } from './prompt-guard.js'
import type { ModelTier } from './model-routing.js'

export interface AiEditorActionResult {
  success: boolean
  text: string
  model: string
  error?: 'budget-exceeded' | 'no-litellm' | 'generation-failed'
}

interface RunOpts {
  agencySlug?: string
  brandVoiceContext?: string // Plan 07-04 supplies this
}

async function runAction(
  prompt: string,
  agencyId: string,
  tier: ModelTier,
  opts: RunOpts = {},
  systemPrompt?: string,
  maxTokens = 1500,
): Promise<AiEditorActionResult> {
  if (!process.env['LITELLM_API_URL'])
    return { success: false, text: '', model: 'stub', error: 'no-litellm' }
  try {
    const result = await generateContent({
      prompt,
      agencyId,
      agencySlug: opts.agencySlug ?? agencyId,
      pageType: 'blog',
      tier,
      systemPrompt,
      maxTokens,
    })
    return { success: true, text: result.text, model: result.model }
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return {
        success: false,
        text: 'AI budget exceeded for this agency.',
        model: 'budget-exceeded',
        error: 'budget-exceeded',
      }
    }
    if (err instanceof PromptInjectionError) {
      return {
        success: false,
        text: 'This input cannot be processed. Please rephrase.',
        model: 'guard-blocked',
        error: 'generation-failed',
      }
    }
    return { success: false, text: '', model: 'error', error: 'generation-failed' }
  }
}

// 1. Draft from title
export async function aiDraftFromTitle(
  title: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Draft a full article (1500+ words) from this title. Use ranges (e.g. 30-45%) NOT exact figures. Never invent statistics. Title:\n\n${title}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    2500,
  )
}

// 2. Rewrite (tier2-writing)
export async function aiRewrite(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Rewrite this text to improve clarity and flow. Keep the meaning intact. Return only the rewritten text:\n\n${selection}`,
    agencyId,
    'tier2-writing',
    opts,
  )
}

// 3. Shorten (tier2-writing)
export async function aiShorten(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Shorten this text to ~50% length, preserving meaning. Return only the shortened text:\n\n${selection}`,
    agencyId,
    'tier2-writing',
    opts,
  )
}

// 4. Expand (tier2-writing)
export async function aiExpand(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Expand this text with more detail and depth (~2x length). Use ranges not exact figures. Return only the expanded text:\n\n${selection}`,
    agencyId,
    'tier2-writing',
    opts,
  )
}

// 5. Simplify
export async function aiSimplify(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Rewrite this text at an 8th-grade reading level. Plain words, short sentences. Return only the simplified text:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
  )
}

// 6. Fix grammar
export async function aiFixGrammar(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Fix grammar, spelling, and punctuation. Do not change meaning or style. Return only the corrected text:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
  )
}

// 7. Tone: formal
export async function aiToneFormal(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Rewrite this in a formal, professional tone. Return only the rewritten text:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
  )
}

// 8. Tone: conversational
export async function aiToneConversational(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Rewrite this in a friendly, conversational tone. Return only the rewritten text:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
  )
}

// 9. Tone: persuasive
export async function aiTonePersuasive(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Rewrite this in a persuasive tone with clear benefits. No fake stats. Return only the rewritten text:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
  )
}

// 10. Summarize paragraph
export async function aiSummarizeParagraph(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Summarize this paragraph in one sentence (max 30 words). Return only the summary:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    100,
  )
}

// 11. Generate meta description
export async function aiMetaDescription(
  content: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Write a meta description for this page. EXACTLY 150-160 characters. Compelling, includes primary keyword. No quotes, no label, just the description:\n\n${content.slice(0, 3000)}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    100,
  )
}

// 12. Suggest H2 headings
export async function aiSuggestH2(
  content: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Suggest 5 H2 headings for this content. Return as a numbered list, one per line:\n\n${content.slice(0, 3000)}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    300,
  )
}

// 13. Write FAQ answer
export async function aiWriteFaqAnswer(
  question: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Write a clear, helpful FAQ answer (2-4 sentences) for this question. No exact stats — use ranges. Question:\n\n${question}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    300,
  )
}

// 14. Generate CTA text
export async function aiGenerateCta(
  context: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Write 3 CTA button text variants (max 5 words each) for this context. Return as a numbered list:\n\n${context}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    100,
  )
}

// 15. Translate to Spanish
export async function aiTranslateSpanish(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Translate this to Spanish (neutral Latin American Spanish). Return only the translation:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
  )
}

// 16. Add transition sentence
export async function aiAddTransition(
  beforeAndAfter: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Write one transition sentence to bridge these two passages. Return only the sentence:\n\n${beforeAndAfter}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    100,
  )
}

// 17. Bullet-point extraction
export async function aiBulletExtract(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Extract the key points from this text as a bullet list (max 7 bullets, max 12 words each). Return only the list:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    400,
  )
}

// 18. Counter-argument (steelman)
export async function aiCounterArgument(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Write the strongest possible counter-argument (steelman) to this position. Return only the counter-argument:\n\n${selection}`,
    agencyId,
    'tier1-bulk',
    opts,
  )
}

// 19. Suggest stat — anti-fab guard always applied
export async function aiSuggestStat(
  context: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  return runAction(
    `Suggest the TYPE of statistic (e.g. "industry growth rate", "customer satisfaction percentage") that would strengthen this passage. DO NOT invent specific numbers. Suggest where the writer should look for a real source. Return as: "Stat type: X. Source to find: Y." Context:\n\n${context}`,
    agencyId,
    'tier1-bulk',
    opts,
    undefined,
    200,
  )
}

// 20. Brand voice rewrite — uses brand_voice + brand_glossary context (Plan 07-04 supplies)
export async function aiBrandVoiceRewrite(
  selection: string,
  agencyId: string,
  opts?: RunOpts,
): Promise<AiEditorActionResult> {
  const ctx = opts?.brandVoiceContext ?? ''
  const sysPrompt = ctx
    ? `You are a brand voice editor. Apply this brand context strictly:\n${ctx}\nRewrite according to the tone, glossary terms, and avoid the banned phrases listed.`
    : undefined
  return runAction(
    `Rewrite this text in the agency brand voice. Return only the rewritten text:\n\n${selection}`,
    agencyId,
    'tier2-writing',
    opts,
    sysPrompt,
  )
}
