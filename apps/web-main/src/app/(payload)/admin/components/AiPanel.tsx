'use client'
/**
 * apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx
 *
 * AI editor toolbar panel for Payload admin editor (REQ-081).
 * Phase 7: real server-action wiring via 20 AI editor actions.
 *
 * Security note (T-05-04-01): All buttons call server actions that begin with
 * requireSession() + agencyId guard per CLAUDE.md §3.
 *
 * 20 actions distributed across 4 groups:
 *   Group A "Edit": rewriteSelection, shortenSelection, expandSelection, simplifySelection, fixGrammar, brandVoiceRewrite
 *   Group B "Tone": toneFormal, toneConversational, tonePersuasive
 *   Group C "Generate": draftFromTitle, generateMetaDescription, suggestH2Headings, writeFaqAnswer, generateCta, summarizeParagraph, addTransition, bulletExtract, counterArgument, suggestStat
 *   Group D "Translate": translateSpanish
 */
import React, { useState } from 'react'
import { useAllFormFields } from '@payloadcms/ui'
import {
  rewriteSelection,
  shortenSelection,
  expandSelection,
  simplifySelection,
  fixGrammar,
  brandVoiceRewrite,
  toneFormal,
  toneConversational,
  tonePersuasive,
  draftFromTitle,
  generateMetaDescription,
  suggestH2Headings,
  writeFaqAnswer,
  generateCta,
  summarizeParagraph,
  addTransition,
  bulletExtract,
  counterArgument,
  suggestStat,
  translateSpanish,
} from '../../../../../actions/ai-editor.js'
import type { AiActionInput } from '../../../../../actions/ai-editor.js'
import type { AiEditorActionResult } from '@mjagency/ai'

type ServerAction = (input: AiActionInput) => Promise<AiEditorActionResult>

interface ActionDef {
  label: string
  key: string
  action: ServerAction
  /** If true, the full content is passed (not just selection) */
  useFullContent?: boolean
}

const GROUP_A_EDIT: ActionDef[] = [
  { label: 'Rewrite', key: 'rewrite', action: rewriteSelection },
  { label: 'Shorten', key: 'shorten', action: shortenSelection },
  { label: 'Expand', key: 'expand', action: expandSelection },
  { label: 'Simplify', key: 'simplify', action: simplifySelection },
  { label: 'Fix Grammar', key: 'fix-grammar', action: fixGrammar },
  { label: 'Brand Voice', key: 'brand-voice', action: brandVoiceRewrite },
]

const GROUP_B_TONE: ActionDef[] = [
  { label: 'Formal', key: 'tone-formal', action: toneFormal },
  { label: 'Conversational', key: 'tone-conversational', action: toneConversational },
  { label: 'Persuasive', key: 'tone-persuasive', action: tonePersuasive },
]

const GROUP_C_GENERATE: ActionDef[] = [
  { label: 'Draft from Title', key: 'draft-from-title', action: draftFromTitle, useFullContent: true },
  { label: 'Meta Description', key: 'meta-description', action: generateMetaDescription, useFullContent: true },
  { label: 'H2 Headings', key: 'h2-headings', action: suggestH2Headings, useFullContent: true },
  { label: 'FAQ Answer', key: 'faq-answer', action: writeFaqAnswer },
  { label: 'CTA Text', key: 'cta-text', action: generateCta },
  { label: 'Summarize', key: 'summarize', action: summarizeParagraph },
  { label: 'Add Transition', key: 'add-transition', action: addTransition },
  { label: 'Bullet Points', key: 'bullet-extract', action: bulletExtract },
  { label: 'Counter Argument', key: 'counter-argument', action: counterArgument },
  { label: 'Suggest Stat', key: 'suggest-stat', action: suggestStat },
]

const GROUP_D_TRANSLATE: ActionDef[] = [
  { label: 'Translate ES', key: 'translate-spanish', action: translateSpanish },
]

interface GroupProps {
  title: string
  actions: ActionDef[]
  loading: boolean
  agencyId: string | undefined
  agencySlug: string | undefined
  brandVoiceContext: string | undefined
  selectedText: string
  fullContent: string
  onResult: (text: string) => void
  onError: (msg: string) => void
  onLoadingChange: (val: boolean) => void
}

function ActionGroup({
  title,
  actions,
  loading,
  agencyId,
  agencySlug,
  brandVoiceContext,
  selectedText,
  fullContent,
  onResult,
  onError,
  onLoadingChange,
}: GroupProps): React.ReactElement {
  return (
    <div style={{ marginBottom: 'var(--mj-space-3, 12px)' }}>
      <div
        style={{
          fontSize: 'var(--mj-text-size-xs, 11px)',
          fontWeight: 600,
          color: 'var(--mj-color-text-secondary, #6b7280)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--mj-space-2, 8px)',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mj-space-2, 8px)' }}>
        {actions.map(({ label, key, action, useFullContent }) => (
          <button
            key={key}
            type="button"
            disabled={loading || !agencyId}
            onClick={async (e) => {
              e.preventDefault()
              if (!agencyId) {
                onError('Missing agency context')
                return
              }
              onLoadingChange(true)
              onError('')
              onResult('')
              try {
                const text = useFullContent ? fullContent : selectedText
                const result = await action({
                  text,
                  agencyId,
                  agencySlug,
                  brandVoiceContext,
                })
                if (!result.success) {
                  if (result.error === 'budget-exceeded') onError('Monthly AI budget reached')
                  else if (result.error === 'no-litellm') onError('AI not configured')
                  else onError('Generation failed')
                } else {
                  onResult(result.text)
                }
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Unknown error')
              } finally {
                onLoadingChange(false)
              }
            }}
            style={{
              padding: '4px 10px',
              fontSize: 'var(--mj-text-size-xs, 11px)',
              backgroundColor: 'var(--mj-color-surface, #f9fafb)',
              border: '1px solid var(--mj-color-border, #e5e7eb)',
              borderRadius: 'var(--mj-radius-sm, 4px)',
              cursor: loading || !agencyId ? 'not-allowed' : 'pointer',
              color: 'var(--mj-color-text-primary, #111827)',
              opacity: loading || !agencyId ? 0.5 : 1,
              transition: 'opacity var(--mj-duration-fast, 100ms) var(--mj-ease-default, ease)',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AiPanel(): React.ReactElement {
  const [fields] = useAllFormFields()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [lastResult, setLastResult] = useState<string>('')

  // Read agency context and content from Payload form fields
  const agencyId = fields['agency_id']?.value as string | undefined
  const agencySlug = fields['agency_slug']?.value as string | undefined
  const brandVoiceContext = fields['brand_voice_context']?.value as string | undefined
  const contentRaw = fields['content']?.value
  const fullContent =
    typeof contentRaw === 'string'
      ? contentRaw
      : JSON.stringify(contentRaw ?? '').slice(0, 6000)
  // Selection: Phase 8 wires real Lexical selection; for Phase 7 use full content as input
  const selectedText = fullContent

  const groupProps = {
    loading,
    agencyId,
    agencySlug,
    brandVoiceContext,
    selectedText,
    fullContent,
    onResult: setLastResult,
    onError: setError,
    onLoadingChange: setLoading,
  }

  return (
    <div
      style={{
        padding: 'var(--mj-space-4, 16px)',
        border: '1px solid var(--mj-color-border, #e5e7eb)',
        borderRadius: 'var(--mj-radius-md, 6px)',
        marginTop: 'var(--mj-space-4, 16px)',
        background: 'var(--mj-color-bg-primary, #ffffff)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--mj-font-heading, inherit)',
          fontSize: 'var(--mj-text-size-base, 14px)',
          fontWeight: 600,
          marginBottom: 'var(--mj-space-4, 16px)',
          marginTop: 0,
          color: 'var(--mj-color-text-primary, #111827)',
          lineHeight: 'var(--mj-leading-tight, 1.25)',
        }}
      >
        AI Assistant
      </h3>

      {/* Loading indicator */}
      {loading && (
        <div
          aria-live="polite"
          style={{
            marginBottom: 'var(--mj-space-3, 12px)',
            fontSize: 'var(--mj-text-size-xs, 11px)',
            color: 'var(--mj-color-text-secondary, #6b7280)',
          }}
        >
          Generating…
        </div>
      )}

      {/* Error display */}
      {error !== '' && (
        <div
          role="alert"
          style={{
            marginBottom: 'var(--mj-space-3, 12px)',
            padding: 'var(--mj-space-2, 8px) var(--mj-space-3, 12px)',
            background: 'var(--mj-color-error-bg, #fef2f2)',
            border: '1px solid var(--mj-color-error, #ef4444)',
            borderRadius: 'var(--mj-radius-sm, 4px)',
            fontSize: 'var(--mj-text-size-xs, 11px)',
            color: 'var(--mj-color-error, #ef4444)',
          }}
        >
          {error}
        </div>
      )}

      {/* Group A: Edit */}
      <ActionGroup title="Edit" actions={GROUP_A_EDIT} {...groupProps} />

      {/* Group B: Tone */}
      <ActionGroup title="Tone" actions={GROUP_B_TONE} {...groupProps} />

      {/* Group C: Generate */}
      <ActionGroup title="Generate" actions={GROUP_C_GENERATE} {...groupProps} />

      {/* Group D: Translate */}
      <ActionGroup title="Translate" actions={GROUP_D_TRANSLATE} {...groupProps} />

      {/* Result display */}
      {lastResult !== '' && (
        <div style={{ marginTop: 'var(--mj-space-4, 16px)' }}>
          <div
            style={{
              fontSize: 'var(--mj-text-size-xs, 11px)',
              fontWeight: 600,
              color: 'var(--mj-color-text-secondary, #6b7280)',
              marginBottom: 'var(--mj-space-1, 4px)',
            }}
          >
            Result — copy and paste into editor:
          </div>
          <textarea
            readOnly
            rows={6}
            value={lastResult}
            aria-label="AI generated result"
            style={{
              width: '100%',
              resize: 'vertical',
              fontSize: 'var(--mj-text-size-sm, 13px)',
              color: 'var(--mj-color-text-primary, #111827)',
              border: '1px solid var(--mj-color-border, #e5e7eb)',
              borderRadius: 'var(--mj-radius-md, 6px)',
              padding: 'var(--mj-space-2, 8px)',
              background: 'var(--mj-color-surface, #f9fafb)',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              marginTop: 'var(--mj-space-1, 4px)',
              fontSize: 'var(--mj-text-size-xs, 11px)',
              color: 'var(--mj-color-text-secondary, #6b7280)',
              fontStyle: 'italic',
            }}
          >
            Insert at cursor: Phase 8 plan wires Lexical cursor insertion.
          </div>
        </div>
      )}
    </div>
  )
}
