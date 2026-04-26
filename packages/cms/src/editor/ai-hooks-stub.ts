/**
 * packages/cms/src/editor/ai-hooks-stub.ts
 *
 * AI editor action stubs (REQ-055).
 * Phase 5: all functions return a clearly labeled stub response.
 * Phase 7: replaces stub implementations with real LiteLLM Flash-Lite calls via @mjagency/ai.
 *
 * IMPORTANT: These are SERVER functions (called from server actions, not from client directly).
 * When Phase 7 wires real calls, requireSession() will be the first line.
 */

export interface AiActionResult {
  success: boolean
  text: string
  /** Stub flag — false in Phase 7 when real AI is wired */
  isStub: true
}

const STUB_RESULT = (action: string): AiActionResult => ({
  success: true,
  text: `[Phase 5 stub — ${action} will use LiteLLM Flash-Lite in Phase 7]`,
  isStub: true,
})

/** Rewrite selected text in 3 variants (stub) */
export async function aiRewrite(_selection: string, _agencyId: string): Promise<AiActionResult[]> {
  return [STUB_RESULT('ai-rewrite variant 1'), STUB_RESULT('ai-rewrite variant 2'), STUB_RESULT('ai-rewrite variant 3')]
}

/** Expand selected text (stub) */
export async function aiExpand(_selection: string, _agencyId: string): Promise<AiActionResult> {
  return STUB_RESULT('ai-expand')
}

/** Shorten selected text (stub) */
export async function aiShorten(_selection: string, _agencyId: string): Promise<AiActionResult> {
  return STUB_RESULT('ai-shorten')
}

/** Rewrite in brand voice (stub) */
export async function aiBrandVoiceRewrite(_selection: string, _agencyId: string): Promise<AiActionResult> {
  return STUB_RESULT('ai-brand-voice-rewrite')
}

/** Generate FAQ from content (stub) */
export async function aiGenerateFaq(_content: string, _agencyId: string): Promise<AiActionResult> {
  return STUB_RESULT('ai-generate-faq')
}

/** Suggest internal links (stub) */
export async function aiSuggestInternalLinks(_content: string, _agencyId: string): Promise<AiActionResult> {
  return STUB_RESULT('ai-suggest-internal-links')
}

/** Auto-generate AIO TL;DR <=120 chars (stub) */
export async function aiTldr(_content: string, _agencyId: string): Promise<AiActionResult> {
  return STUB_RESULT('ai-tldr-auto-generate')
}

/** Suggest meta description <=160 chars (stub) */
export async function aiMetaDescription(_content: string, _agencyId: string): Promise<AiActionResult> {
  return STUB_RESULT('ai-meta-description-suggest')
}

/** Suggest alt text for image (stub) */
export async function aiAltText(_imageUrl: string, _agencyId: string): Promise<AiActionResult> {
  return STUB_RESULT('ai-alt-text')
}
