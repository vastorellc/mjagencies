/**
 * packages/tools/src/engine/types.ts
 *
 * Core type contracts for the MJAgency tool engine.
 * REQ-120: 36 tools (3/agency × 12)
 * REQ-122: deterministic math — no LLM in calculation path
 * REQ-124: benchmarks carry 12-month expiry
 * REQ-406: benchmark expiry flags yellow warning, tool stays live
 * REQ-413: tool result inline only — NOT separate indexed page
 */

/** A single named input field for a tool's calculator form. */
export interface ToolInputField {
  /** Internal key used in ToolInput record */
  name: string
  /** Human-readable label shown in <label> element */
  label: string
  type: 'number' | 'select' | 'text'
  required: boolean
  /** For type='number': input[min] */
  min?: number
  /** For type='number': input[max] */
  max?: number
  /** For type='number': input[step] */
  step?: number
  /** For type='select': option values */
  options?: Array<{ label: string; value: string }>
  /** Placeholder shown when field is empty */
  placeholder?: string
}

/** A single result metric output by the calculator. */
export interface ToolOutputMetric {
  /** Internal key */
  name: string
  /** Human-readable label */
  label: string
  /** Formatted display value (number, %, $, etc.) */
  value: string
  /** Whether this is the primary display number (Display role, 36px bold) */
  isPrimary?: boolean
  /** Optional explanation shown below the value */
  description?: string
}

/** A benchmark dataset backing one or more tool calculations.
 *  REQ-124: includes updatedAt for 12-month expiry enforcement.
 *  REQ-406: tool stays live after expiry — only yellow badge shown.
 */
export interface BenchmarkDataset {
  /** Unique key matching the tool slug */
  key: string
  /** Human-readable source name for citation note */
  sourceName: string
  /** Year of publication for citation note */
  sourceYear: number
  /** URL to original source for verification */
  sourceUrl: string
  /** ISO 8601 date string — expiry checked against this + 12 months */
  updatedAt: string
  /** Benchmark values specific to each tool — typed per tool */
  data: Record<string, number | string>
}

/** Raw inputs submitted by the user through the calculator form.
 *  Keys match ToolInputField.name values.
 */
export type ToolInput = Record<string, string | number>

/** The complete result returned by a tool's calculate() function. */
export interface ToolResult {
  /** Primary and secondary output metrics */
  metrics: ToolOutputMetric[]
  /** Plain-text disclaimer shown below results */
  disclaimer: string
  /** Benchmark source citation text (constructed from BenchmarkDataset fields) */
  benchmarkCitation: string
  /** true if benchmark is >12 months old — triggers yellow BenchmarkBadge */
  benchmarkExpired: boolean
  /** Month/year of benchmark update for expiry badge copy */
  benchmarkUpdatedLabel: string
}

/** The definition of a single tool. Implement this interface for each of the 36 tools. */
export interface ToolDefinition {
  /** URL slug — must be unique, used as page path segment */
  slug: string
  /** Human-readable tool name */
  name: string
  /** Agency this tool belongs to (matches AGENCY_ID constant) */
  agencySlug: string
  /** Input fields rendered in the calculator form */
  fields: ToolInputField[]
  /** Key(s) into benchmark dataset(s) used by this tool */
  benchmarkKeys: string[]
  /**
   * Pure calculation function — MUST be deterministic with no randomness or LLM calls (REQ-122).
   * @param inputs — validated user inputs (keys match ToolInputField.name)
   * @param benchmarks — record of benchmark datasets keyed by BenchmarkDataset.key
   * @returns ToolResult with formatted metric values
   */
  calculate: (inputs: ToolInput, benchmarks: Record<string, BenchmarkDataset>) => ToolResult
}

/** A typed calculator function signature for standalone tool implementations. */
export type CalculatorFn = ToolDefinition['calculate']
