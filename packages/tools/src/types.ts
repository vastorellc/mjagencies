/**
 * Tool engine contracts. M001 = types only; M010 (Phase 10) ships 36 real
 * tools (3 per agency × 12) with deterministic math (REQ-122 — no LLM in
 * the math path) and 12-month benchmark expiry (REQ-124).
 */

export interface ToolInput {
  readonly fieldId: string
  readonly value: number | string | boolean
}

export interface ToolOutput {
  readonly fieldId: string
  readonly value: number | string
  readonly unit?: string
}

/** Pure deterministic compute — no LLM, no I/O (REQ-122). */
export type Calculator = (inputs: readonly ToolInput[]) => readonly ToolOutput[]

export interface BenchmarkSource {
  readonly source: string         // e.g., "BLS 2025-Q4", "HubSpot 2025 State of Marketing"
  readonly capturedAt: string     // ISO date — 12-month expiry enforced (REQ-124)
  readonly url?: string
}

export interface ToolDefinition {
  readonly id: string
  readonly agencySlug: string
  readonly title: string
  readonly inputs: readonly { id: string; label: string; type: 'number' | 'text' | 'select' }[]
  readonly outputs: readonly { id: string; label: string; unit?: string }[]
  readonly calculator: Calculator
  readonly benchmarks: readonly BenchmarkSource[]
}
