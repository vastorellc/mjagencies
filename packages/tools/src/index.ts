/**
 * packages/tools/src/index.ts
 * Barrel export for @mjagency/tools.
 * REQ-120, REQ-122, REQ-124, REQ-406, REQ-413
 */
export type {
  ToolDefinition,
  ToolInput,
  ToolResult,
  ToolOutputMetric,
  ToolInputField,
  BenchmarkDataset,
  CalculatorFn,
} from './engine/types.js'

export { runCalculator } from './engine/calculator.js'
export type { RunCalculatorInput, RunCalculatorOutput, RunCalculatorError } from './engine/calculator.js'

export { loadBenchmarks, isBenchmarkExpired, formatBenchmarkUpdatedLabel } from './engine/benchmark-loader.js'
export { renderToolResult } from './engine/result-renderer.js'

// Tool definitions
export { ALL_TOOLS, getToolBySlug, getToolsByAgency } from './tools/index.js'

// Email gate + resend
export { handleEmailGate } from './actions/email-gate.js'
export type { EmailGateInput, EmailGateJobData, EmailGateOutput } from './actions/email-gate.js'
export { handleResendPdf } from './actions/resend-pdf.js'
export type { ResendPdfInput, ResendPdfOutput } from './actions/resend-pdf.js'

// Page components
export {
  BenchmarkBadge,
  ToolResultSection,
  EmailGateModal,
  CalculatorForm,
  PdfConfirmationPage,
  ToolPageTemplate,
} from './pages/index.js'
