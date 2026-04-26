'use client'
/**
 * AI editor panel stub (REQ-055 AI editor hooks).
 * Phase 5: buttons call stub functions and display stub response text.
 * Phase 7: wires real LiteLLM calls via server actions.
 *
 * Security note (T-05-04-01): these buttons call stub server actions.
 * Phase 7 ensures every server action begins with requireSession() per CLAUDE.md §3.
 */
import React, { useState } from 'react'
import type { SyntheticEvent } from 'react'

interface AiPanelProps {
  agencyId?: string
}

export default function AiPanel({ agencyId = '' }: AiPanelProps): React.ReactElement {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const runStub = async (action: string): Promise<void> => {
    setLoading(true)
    // Phase 5 stub: show inline stub message without a real API call
    await new Promise<void>((r) => setTimeout(r, 300))
    setResult(
      `[Phase 5 stub — ${action} will use LiteLLM in Phase 7] (agencyId: ${agencyId || 'unknown'})`,
    )
    setLoading(false)
  }

  const actions = [
    { label: 'AI Rewrite', key: 'ai-rewrite' },
    { label: 'AI Expand', key: 'ai-expand' },
    { label: 'AI Shorten', key: 'ai-shorten' },
    { label: 'Generate FAQ', key: 'ai-generate-faq' },
    { label: 'Auto TL;DR', key: 'ai-tldr' },
    { label: 'Suggest Meta Desc', key: 'ai-meta-description' },
  ]

  return (
    <div
      style={{
        padding: 'var(--mj-space-4, 16px)',
        border: '1px solid var(--mj-color-border, #e5e7eb)',
        borderRadius: 'var(--mj-radius-md, 6px)',
        marginTop: 'var(--mj-space-2, 8px)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--mj-font-heading, inherit)',
          fontSize: 'var(--mj-text-base, 14px)',
          fontWeight: 600,
          marginBottom: 'var(--mj-space-3, 12px)',
          color: 'var(--mj-color-text-primary, #111827)',
        }}
      >
        AI Assistant (Phase 7)
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mj-space-2, 8px)' }}>
        {actions.map(({ label, key }) => (
          <button
            key={key}
            onClick={(e: SyntheticEvent) => {
              e.preventDefault()
              void runStub(key)
            }}
            disabled={loading}
            style={{
              padding: '4px 12px',
              fontSize: 'var(--mj-text-xs, 11px)',
              backgroundColor: 'var(--mj-color-surface, #f9fafb)',
              border: '1px solid var(--mj-color-border, #e5e7eb)',
              borderRadius: 'var(--mj-radius-sm, 4px)',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--mj-color-text-primary, #111827)',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {result !== '' && (
        <div
          style={{
            marginTop: 'var(--mj-space-3, 12px)',
            fontSize: 'var(--mj-text-xs, 11px)',
            color: 'var(--mj-color-text-secondary, #6b7280)',
            fontStyle: 'italic',
          }}
        >
          {result}
        </div>
      )}
    </div>
  )
}
