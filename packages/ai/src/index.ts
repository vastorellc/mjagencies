/**
 * @mjagency/ai — LiteLLM integration for content generation and AI editor features.
 * Phase 5: generateContent() for content sprint (calls real LiteLLM or stub if env missing).
 * Phase 7: full AI editor features wired with per-agency cost caps and model routing.
 */
export { generateContent } from './generate-content.js'
export type { GenerateContentParams, GenerateContentResult } from './generate-content.js'

// Phase 7: per-agency cost cap enforcement (REQ-080)
export {
  checkAgencyCostCap,
  recordAgencySpend,
  getAgencyLiteLLMKey,
  resetMonthlySpend,
  AiBudgetExceededError,
} from './cost-cap.js'

// Phase 7: model routing by tier
export { getModelForTier, MODEL_ROUTING } from './model-routing.js'
export type { ModelTier } from './model-routing.js'

// Phase 7: 20 AI editor action functions (REQ-081)
export {
  aiDraftFromTitle,
  aiRewrite,
  aiShorten,
  aiExpand,
  aiSimplify,
  aiFixGrammar,
  aiToneFormal,
  aiToneConversational,
  aiTonePersuasive,
  aiSummarizeParagraph,
  aiMetaDescription,
  aiSuggestH2,
  aiWriteFaqAnswer,
  aiGenerateCta,
  aiTranslateSpanish,
  aiAddTransition,
  aiBulletExtract,
  aiCounterArgument,
  aiSuggestStat,
  aiBrandVoiceRewrite,
} from './editor-actions.js'
export type { AiEditorActionResult } from './editor-actions.js'

// Phase 7: per-agency brand voice context loader (REQ-083)
export { getBrandVoiceContext } from './brand-context.js'
