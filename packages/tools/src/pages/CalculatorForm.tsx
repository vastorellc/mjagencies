/**
 * packages/tools/src/pages/CalculatorForm.tsx
 * UI-SPEC Surface 1 — tool calculator form.
 * States: idle | calculating | result-shown | error
 * Calculate button disabled until all required fields valid.
 * Result renders inline via ToolResultSection (id=tool-result).
 */
'use client'
import { useState, type FormEvent } from 'react'
import type { ToolDefinition, ToolInput, ToolResult, BenchmarkDataset } from '../engine/types.js'
import { runCalculator } from '../engine/calculator.js'
import { ToolResultSection } from './ToolResultSection.js'
import { EmailGateModal } from './EmailGateModal.js'

interface CalculatorFormProps {
  tool: ToolDefinition
  benchmarks: Record<string, BenchmarkDataset>
  agencySlug: string
}

export function CalculatorForm({ tool, benchmarks, agencySlug }: CalculatorFormProps): React.JSX.Element {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ToolResult | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)

  const allRequiredFilled = tool.fields
    .filter((f) => f.required)
    .every((f) => inputs[f.name] !== undefined && inputs[f.name] !== '')

  function handleChange(name: string, value: string): void {
    setInputs((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    const coerced: ToolInput = {}
    for (const [k, v] of Object.entries(inputs)) {
      coerced[k] = v
    }
    const out = runCalculator({ tool, inputs: coerced, benchmarks })
    if (out.ok) {
      setResult(out.result)
      setFieldErrors({})
      setTimeout(() => {
        document.getElementById('tool-result')?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } else {
      setFieldErrors(out.fieldErrors)
    }
  }

  return (
    <div
      style={{
        background: 'var(--mj-color-bg-primary)',
        padding: 'var(--mj-space-6)',
        borderRadius: '8px',
      }}
    >
      <form onSubmit={handleSubmit} noValidate>
        {result === null && (
          <h2
            style={{
              fontSize: 'var(--mj-text-size-xl)',
              fontWeight: 'var(--mj-weight-bold)',
              lineHeight: 'var(--mj-leading-tight)',
              marginBottom: 'var(--mj-space-6)',
              color: 'var(--mj-color-text-secondary)',
            }}
          >
            Enter Your Numbers to Get Started
          </h2>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mj-space-8)' }}>
          {tool.fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`field-${field.name}`}
                style={{
                  fontSize: 'var(--mj-text-size-sm)',
                  display: 'block',
                  marginBottom: 'var(--mj-space-2)',
                  fontWeight: 'var(--mj-weight-normal)',
                }}
              >
                {field.label}
                {field.required && ' *'}
              </label>
              {field.type === 'select' && field.options ? (
                <select
                  id={`field-${field.name}`}
                  value={inputs[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required={field.required}
                  aria-describedby={fieldErrors[field.name] ? `error-${field.name}` : undefined}
                  style={{
                    width: '100%',
                    padding: 'var(--mj-space-2) var(--mj-space-4)',
                    fontSize: 'var(--mj-text-size-base)',
                    border: `1px solid ${fieldErrors[field.name] ? 'var(--mj-color-error)' : 'var(--mj-color-border)'}`,
                    borderRadius: '4px',
                    outline: 'none',
                    minHeight: '44px',
                  }}
                >
                  <option value="">Select an option</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`field-${field.name}`}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={inputs[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.placeholder ?? ''}
                  required={field.required}
                  aria-describedby={fieldErrors[field.name] ? `error-${field.name}` : undefined}
                  style={{
                    width: '100%',
                    padding: 'var(--mj-space-2) var(--mj-space-4)',
                    fontSize: 'var(--mj-text-size-base)',
                    border: `1px solid ${fieldErrors[field.name] ? 'var(--mj-color-error)' : 'var(--mj-color-border)'}`,
                    borderRadius: '4px',
                    outline: 'none',
                    minHeight: '44px',
                  }}
                />
              )}
              {fieldErrors[field.name] && (
                <p
                  id={`error-${field.name}`}
                  role="alert"
                  style={{
                    color: 'var(--mj-color-error)',
                    fontSize: 'var(--mj-text-size-sm)',
                    marginTop: 'var(--mj-space-1)',
                  }}
                >
                  {fieldErrors[field.name]}
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={!allRequiredFilled}
          style={{
            marginTop: 'var(--mj-space-8)',
            padding: 'var(--mj-space-4) var(--mj-space-8)',
            background: allRequiredFilled
              ? 'var(--mj-color-brand-500)'
              : 'var(--mj-color-bg-secondary)',
            color: allRequiredFilled
              ? 'var(--mj-color-text-on-brand)'
              : 'var(--mj-color-text-disabled)',
            fontSize: 'var(--mj-text-size-base)',
            fontWeight: 'var(--mj-weight-bold)',
            border: 'none',
            borderRadius: '4px',
            cursor: allRequiredFilled ? 'pointer' : 'not-allowed',
            minHeight: '44px',
          }}
        >
          Calculate My Results
        </button>
      </form>

      <ToolResultSection result={result} />

      {result !== null && (
        <div style={{ marginTop: 'var(--mj-space-6)' }}>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              padding: 'var(--mj-space-4) var(--mj-space-8)',
              background: 'var(--mj-color-brand-500)',
              color: 'var(--mj-color-text-on-brand)',
              fontSize: 'var(--mj-text-size-base)',
              fontWeight: 'var(--mj-weight-bold)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Get the Full PDF Report
          </button>
        </div>
      )}

      {result !== null && (
        <EmailGateModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          toolSlug={tool.slug}
          toolResult={result}
          agencySlug={agencySlug}
        />
      )}
    </div>
  )
}
