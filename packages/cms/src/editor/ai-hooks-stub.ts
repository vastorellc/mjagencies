/**
 * packages/cms/src/editor/ai-hooks-stub.ts
 *
 * AI editor action hooks (REQ-055).
 * Phase 5: all functions returned stub responses (isStub: true).
 * Phase 7: implementations delegate to @mjagency/ai (isStub: false).
 *
 * Back-compatibility: external callers keep the same signatures and AiActionResult shape.
 * Functions that are not in the Phase 7 feature list (aiSuggestInternalLinks, aiAltText)
 * log a warning and return a fallback response — they will be wired in a later phase.
 *
 * IMPORTANT: These are SERVER functions (called from server actions, not from client directly).
 * Every caller must have requireSession() as the first line (CLAUDE.md §3).
 */

export interface AiActionResult {
  success: boolean
  text: string
  /** Stub flag — false in Phase 7 now that real AI is wired */
  isStub: false
}

/** Wraps a single AiEditorActionResult into AiActionResult for back-compat */
function wrap(text: string, success: boolean): AiActionResult {
  return { success, text, isStub: false }
}

/** Rewrite selected text — delegates to aiRewrite (returns array of 1 for back-compat) */
export async function aiRewrite(selection: string, agencyId: string): Promise<AiActionResult[]> {
  const { aiRewrite: realRewrite } = await import('@mjagency/ai')
  const result = await realRewrite(selection, agencyId)
  // Stub used to return 3 variants; real returns 1 — wrap in array for back-compat
  return [wrap(result.text, result.success)]
}

/** Expand selected text */
export async function aiExpand(selection: string, agencyId: string): Promise<AiActionResult> {
  const { aiExpand: realExpand } = await import('@mjagency/ai')
  const result = await realExpand(selection, agencyId)
  return wrap(result.text, result.success)
}

/** Shorten selected text */
export async function aiShorten(selection: string, agencyId: string): Promise<AiActionResult> {
  const { aiShorten: realShorten } = await import('@mjagency/ai')
  const result = await realShorten(selection, agencyId)
  return wrap(result.text, result.success)
}

/** Rewrite in brand voice (Plan 07-04 wires the context loader) */
export async function aiBrandVoiceRewrite(
  selection: string,
  agencyId: string,
): Promise<AiActionResult> {
  const { aiBrandVoiceRewrite: realBrandVoice } = await import('@mjagency/ai')
  const result = await realBrandVoice(selection, agencyId)
  return wrap(result.text, result.success)
}

/** Generate FAQ from content — delegates to aiWriteFaqAnswer */
export async function aiGenerateFaq(
  content: string,
  agencyId: string,
): Promise<AiActionResult> {
  const { aiWriteFaqAnswer } = await import('@mjagency/ai')
  const result = await aiWriteFaqAnswer(content, agencyId)
  return wrap(result.text, result.success)
}

/**
 * Suggest internal links — NOT in Phase 7 feature list.
 * Will be wired in a later phase (Phase 8 / link graph plan).
 * Returns empty success so callers don't crash.
 */
export async function aiSuggestInternalLinks(
  _content: string,
  _agencyId: string,
): Promise<AiActionResult> {
  console.warn('[ai-hooks-stub] aiSuggestInternalLinks: not yet wired — Phase 8 scope')
  return wrap('', true)
}

/**
 * Auto-generate AIO TL;DR — delegates to aiSummarizeParagraph.
 * Note: full TL;DR generation is handled by generateTldr() in apps/web-main/src/actions/seo-score.ts.
 * This wrapper provides back-compat for direct callers of the stub.
 */
export async function aiTldr(content: string, agencyId: string): Promise<AiActionResult> {
  const { aiSummarizeParagraph } = await import('@mjagency/ai')
  const result = await aiSummarizeParagraph(content, agencyId)
  return wrap(result.text, result.success)
}

/** Suggest meta description */
export async function aiMetaDescription(
  content: string,
  agencyId: string,
): Promise<AiActionResult> {
  const { aiMetaDescription: realMetaDesc } = await import('@mjagency/ai')
  const result = await realMetaDesc(content, agencyId)
  return wrap(result.text, result.success)
}

/**
 * Suggest alt text for image — NOT in Phase 7 feature list.
 * Will be wired in a later phase (Phase 8 / media/vision plan).
 * Returns empty success so callers don't crash.
 */
export async function aiAltText(
  _imageUrl: string,
  _agencyId: string,
): Promise<AiActionResult> {
  console.warn('[ai-hooks-stub] aiAltText: not yet wired — Phase 8 scope')
  return wrap('', true)
}
