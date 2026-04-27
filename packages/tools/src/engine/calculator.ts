/**
 * packages/tools/src/engine/calculator.ts
 *
 * Orchestrates user input through a ToolDefinition.calculate() function.
 * REQ-122: deterministic, no LLM.
 * REQ-120: called by all 36 tool pages.
 */
import type { ToolDefinition, ToolInput, ToolResult, BenchmarkDataset } from './types.js'

export interface RunCalculatorInput {
  tool: ToolDefinition
  inputs: ToolInput
  benchmarks: Record<string, BenchmarkDataset>
}

export interface RunCalculatorOutput {
  ok: true
  result: ToolResult
}

export interface RunCalculatorError {
  ok: false
  error: string
  fieldErrors: Record<string, string>
}

/**
 * Validates inputs against field definitions, then calls tool.calculate().
 * Returns either RunCalculatorOutput or RunCalculatorError.
 * Never throws — all errors are returned as RunCalculatorError.
 */
export function runCalculator(
  input: RunCalculatorInput,
): RunCalculatorOutput | RunCalculatorError {
  const { tool, inputs, benchmarks } = input
  const fieldErrors: Record<string, string> = {}

  // Validate each required field
  for (const field of tool.fields) {
    const raw = inputs[field.name]
    if (field.required && (raw === undefined || raw === '' || raw === null)) {
      fieldErrors[field.name] = `Please enter a valid number for ${field.label}. Decimals are accepted.`
      continue
    }
    if (field.type === 'number' && raw !== undefined && raw !== '') {
      const n = Number(raw)
      if (Number.isNaN(n)) {
        fieldErrors[field.name] = `Please enter a valid number for ${field.label}. Decimals are accepted.`
        continue
      }
      if (field.min !== undefined && n < field.min) {
        fieldErrors[field.name] = `${field.label} must be between ${field.min} and ${field.max ?? 'unlimited'}. Please adjust and recalculate.`
        continue
      }
      if (field.max !== undefined && n > field.max) {
        fieldErrors[field.name] = `${field.label} must be between ${field.min ?? 0} and ${field.max}. Please adjust and recalculate.`
        continue
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'Validation failed', fieldErrors }
  }

  // Coerce string numbers to actual numbers for the calculate fn
  const coercedInputs: ToolInput = {}
  for (const field of tool.fields) {
    const raw = inputs[field.name]
    if (raw === undefined) continue
    coercedInputs[field.name] = field.type === 'number' ? Number(raw) : raw
  }

  const result = tool.calculate(coercedInputs, benchmarks)
  return { ok: true, result }
}
