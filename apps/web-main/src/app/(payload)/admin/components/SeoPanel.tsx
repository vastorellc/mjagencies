'use client'
/**
 * SEO/AIO/GEO sidebar panel for Payload admin editor.
 * Phase 6: replaced Phase 5 stub with live plugin scoring via computeLiveScore server action.
 *
 * Uses useAllFormFields() with 500ms debounce to compute live scores without
 * hammering the server on every keystroke (RESEARCH.md Pitfall 2).
 *
 * REQ-071: Plugin engine called on every editor field change (debounced)
 * REQ-075: AIO TL;DR field with char counter + Regenerate button
 */
import React, { useEffect, useRef, useState } from 'react'
import { useAllFormFields, useDocumentInfo } from '@payloadcms/ui'
import { computeLiveScore, generateTldr } from '../../../../../actions/seo-score.js'
import type { LiveSeoScore } from '@mjagency/seo'

// ---------------------------------------------------------------------------
// ScoreBar — Component 1
// ---------------------------------------------------------------------------
interface ScoreBarProps {
  label: string
  score: number
  threshold: number
  isExpanded: boolean
  onToggle: () => void
  findings: Array<{ rule: string; passed: boolean; detail: string }>
}

function ScoreBar({
  label,
  score,
  threshold,
  isExpanded,
  onToggle,
  findings,
}: ScoreBarProps): React.ReactElement {
  const color =
    score >= 70
      ? 'var(--mj-color-success, #22c55e)'
      : score >= 40
        ? 'var(--mj-color-warning, #f59e0b)'
        : 'var(--mj-color-error, #ef4444)'

  return (
    <div style={{ marginBottom: 'var(--mj-space-2, 8px)' }}>
      <div
        role="button"
        tabIndex={0}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--mj-text-size-sm, 14px)',
          cursor: 'pointer',
        }}
        onClick={onToggle}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle()
        }}
      >
        <span style={{ color: 'var(--mj-color-text-secondary, #6b7280)' }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--mj-space-1, 4px)' }}>
          <span style={{ color, fontWeight: 600 }}>{score}</span>
          <span style={{ color: 'var(--mj-color-text-secondary, #6b7280)', fontSize: 'var(--mj-text-size-xs, 12px)' }}>
            {isExpanded ? '▾' : '▸'}
          </span>
        </span>
      </div>
      {/* Progress bar track with threshold tick */}
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          position: 'relative',
          height: 4,
          background: 'var(--mj-color-border, #e5e7eb)',
          borderRadius: 'var(--mj-radius-full, 9999px)',
          marginTop: 2,
        }}
      >
        {/* Score fill */}
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: color,
            borderRadius: 'var(--mj-radius-full, 9999px)',
            transition: 'width var(--mj-duration-slow, 300ms) var(--mj-ease-default, ease)',
          }}
        />
        {/* Threshold tick mark */}
        <div
          style={{
            position: 'absolute',
            top: -2,
            left: `${threshold}%`,
            width: 2,
            height: 8,
            background: 'var(--mj-color-text-secondary, #6b7280)',
            opacity: 0.35,
          }}
        />
      </div>
      {/* Findings list — shown when expanded */}
      {isExpanded && findings.length > 0 && (
        <ul
          style={{
            margin: 'var(--mj-space-1, 4px) 0 0 0',
            padding: '0 0 0 var(--mj-space-4, 16px)',
            maxHeight: 120,
            overflow: 'hidden',
            transition: 'max-height var(--mj-duration-base, 200ms) ease-out',
          }}
        >
          {findings.map((f, i) => (
            <li
              key={i}
              style={{
                fontSize: 'var(--mj-text-size-xs, 12px)',
                color: f.passed
                  ? 'var(--mj-color-text-secondary, #6b7280)'
                  : 'var(--mj-color-error, #ef4444)',
                lineHeight: 'var(--mj-leading-normal, 1.5)',
              }}
            >
              {f.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AggregateScoreDisplay — Component 2
// ---------------------------------------------------------------------------
interface AggregateScoreDisplayProps {
  score: number | null
  loading: boolean
  error: boolean
}

function AggregateScoreDisplay({
  score,
  loading,
  error,
}: AggregateScoreDisplayProps): React.ReactElement {
  const displayColor =
    score === null || loading
      ? 'var(--mj-color-text-secondary, #6b7280)'
      : error
        ? 'var(--mj-color-error, #ef4444)'
        : score >= 70
          ? 'var(--mj-color-success, #22c55e)'
          : score >= 40
            ? 'var(--mj-color-warning, #f59e0b)'
            : 'var(--mj-color-error, #ef4444)'

  return (
    <div
      aria-live="polite"
      style={{
        marginBottom: 'var(--mj-space-4, 16px)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 'var(--mj-text-size-xl, 20px)',
          fontWeight: 600,
          color: displayColor,
          lineHeight: 'var(--mj-leading-tight, 1.25)',
        }}
        title={error ? 'Score unavailable — check editor content' : undefined}
      >
        {loading ? '—' : error ? '!' : score ?? '—'}
      </div>
      <div
        style={{
          fontSize: 'var(--mj-text-size-xs, 12px)',
          color: 'var(--mj-color-text-secondary, #6b7280)',
        }}
      >
        Overall SEO Score
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TldrField — Component 3
// ---------------------------------------------------------------------------
interface TldrFieldProps {
  value: string
  onChange: (v: string) => void
  onRegenerate: () => void
  tldrLoading: boolean
  tldrError: boolean
}

function TldrField({
  value,
  onChange,
  onRegenerate,
  tldrLoading,
  tldrError,
}: TldrFieldProps): React.ReactElement {
  const charCount = value.length
  const counterColor =
    charCount > 120
      ? 'var(--mj-color-error, #ef4444)'
      : charCount > 110
        ? 'var(--mj-color-warning, #f59e0b)'
        : 'var(--mj-color-text-secondary, #6b7280)'

  const counterLabel =
    charCount > 110
      ? `${charCount}/120 — shorten before publishing`
      : `${charCount}/120`

  return (
    <div>
      <h4
        style={{
          fontSize: 'var(--mj-text-size-base, 14px)',
          fontWeight: 600,
          color: 'var(--mj-color-text-primary, #111827)',
          marginBottom: 'var(--mj-space-2, 8px)',
          marginTop: 0,
        }}
      >
        AIO Summary (TL;DR)
      </h4>
      <label
        htmlFor="seo-panel-tldr"
        style={{ display: 'none' }}
      >
        AIO Summary TL;DR
      </label>
      <textarea
        id="seo-panel-tldr"
        rows={3}
        maxLength={120}
        placeholder="One-sentence summary for AI answer engines. 120 chars max."
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        style={{
          width: '100%',
          resize: 'vertical',
          fontSize: 'var(--mj-text-size-sm, 14px)',
          color: 'var(--mj-color-text-primary, #111827)',
          border: '1px solid var(--mj-color-border, #e5e7eb)',
          borderRadius: 'var(--mj-radius-md, 6px)',
          padding: 'var(--mj-space-2, 8px)',
          background: 'var(--mj-color-bg-primary, #ffffff)',
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--mj-space-1, 4px)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--mj-text-size-xs, 12px)',
            color: counterColor,
          }}
        >
          {counterLabel}
        </span>
        <button
          type="button"
          disabled={tldrLoading}
          onClick={onRegenerate}
          style={{
            height: 28,
            padding: 'var(--mj-space-1, 4px) var(--mj-space-2, 8px)',
            fontSize: 'var(--mj-text-size-xs, 12px)',
            fontWeight: 600,
            background: 'var(--mj-color-bg-secondary, #f9fafb)',
            border: '1px solid var(--mj-color-brand-500, #6366f1)',
            borderRadius: 'var(--mj-radius-sm, 2px)',
            color: 'var(--mj-color-brand-500, #6366f1)',
            cursor: tldrLoading ? 'not-allowed' : 'pointer',
            opacity: tldrLoading ? 0.5 : 1,
            transition: 'opacity var(--mj-duration-fast, 100ms) var(--mj-ease-default, ease)',
          }}
        >
          {tldrLoading ? 'Generating…' : 'Regenerate'}
        </button>
      </div>
      {tldrError && (
        <div
          style={{
            marginTop: 'var(--mj-space-1, 4px)',
            fontSize: 'var(--mj-text-size-xs, 12px)',
            color: 'var(--mj-color-error, #ef4444)',
          }}
        >
          Unable to generate summary. Edit manually.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SeoPanel — Main Component
// ---------------------------------------------------------------------------
export default function SeoPanel(): React.ReactElement {
  const [fields] = useAllFormFields()
  const { id } = useDocumentInfo()
  const [scores, setScores] = useState<LiveSeoScore | null>(null)
  const [loading, setLoading] = useState(false)
  const [scoreError, setScoreError] = useState(false)
  const [tldrLoading, setTldrLoading] = useState(false)
  const [tldrError, setTldrError] = useState(false)
  const [tldrValue, setTldrValue] = useState<string>('')
  const [expandedBars, setExpandedBars] = useState<Record<string, boolean>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoGeneratedRef = useRef(false)

  // Suppress unused variable warning — id is available for future use
  void id

  // Sync tldr from form field on field changes
  useEffect(() => {
    const fieldVal = fields['aio_tldr']?.value as string | undefined
    if (fieldVal !== undefined) {
      setTldrValue(fieldVal)
    }
  }, [fields])

  // 500ms debounce score compute — prevents keystroke-per-request storm (RESEARCH.md Pitfall 2)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void (async () => {
        const agencyId = fields['agency_id']?.value as string | undefined
        if (!agencyId) return
        setLoading(true)
        setScoreError(false)
        try {
          const result = await computeLiveScore({
            content: fields['content']?.value,
            metaTitle: fields['meta_title']?.value as string | undefined,
            metaDescription: fields['meta_description']?.value as string | undefined,
            aioTldr: fields['aio_tldr']?.value as string | undefined,
            focusKeyword: fields['focus_keyword']?.value as string | undefined,
            pageType: fields['page_type']?.value as string | undefined,
            agencyId,
          })
          setScores(result)
        } catch {
          setScoreError(true)
        } finally {
          setLoading(false)
        }

        // Auto-generate TL;DR only when blank on first load (RESEARCH.md Pitfall 5)
        if (!autoGeneratedRef.current && !fields['aio_tldr']?.value) {
          autoGeneratedRef.current = true
          const agencySlug = fields['agency_slug']?.value as string | undefined
          if (agencySlug) {
            setTldrLoading(true)
            setTldrError(false)
            try {
              const draft = await generateTldr({
                agencyId,
                agencySlug,
                content: fields['content']?.value,
              })
              if (draft) setTldrValue(draft)
            } catch {
              /* silent — user can regenerate manually */
            } finally {
              setTldrLoading(false)
            }
          }
        }
      })()
    }, 500)
  }, [fields])

  const handleRegenerate = (): void => {
    const agencyId = fields['agency_id']?.value as string | undefined
    const agencySlug = fields['agency_slug']?.value as string | undefined
    if (!agencyId || !agencySlug) return
    setTldrLoading(true)
    setTldrError(false)
    void generateTldr({ agencyId, agencySlug, content: fields['content']?.value })
      .then((draft) => {
        if (draft) setTldrValue(draft)
      })
      .catch(() => {
        setTldrError(true)
      })
      .finally(() => {
        setTldrLoading(false)
      })
  }

  const toggleBar = (name: string): void => {
    setExpandedBars((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const thresholds = {
    seoClassic: 70,
    aioCitations: 60,
    geoChunking: 50,
  }

  return (
    <div
      aria-busy={loading}
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
        SEO / AIO / GEO
      </h3>

      {/* Aggregate score display — Component 2 */}
      <AggregateScoreDisplay
        score={scores?.aggregateScore ?? null}
        loading={loading}
        error={scoreError}
      />

      {/* Three score bars — Component 1 */}
      <ScoreBar
        label="seo-classic"
        score={scores?.seoClassicScore ?? 0}
        threshold={thresholds.seoClassic}
        isExpanded={expandedBars['seo-classic'] ?? false}
        onToggle={() => toggleBar('seo-classic')}
        findings={scores?.seoClassicFindings ?? []}
      />
      <ScoreBar
        label="aio-citations"
        score={scores?.aioCitationsScore ?? 0}
        threshold={thresholds.aioCitations}
        isExpanded={expandedBars['aio-citations'] ?? false}
        onToggle={() => toggleBar('aio-citations')}
        findings={scores?.aioCitationsFindings ?? []}
      />
      <ScoreBar
        label="geo-chunking"
        score={scores?.geoChunkingScore ?? 0}
        threshold={thresholds.geoChunking}
        isExpanded={expandedBars['geo-chunking'] ?? false}
        onToggle={() => toggleBar('geo-chunking')}
        findings={scores?.geoChunkingFindings ?? []}
      />

      {/* Separator */}
      <hr
        style={{
          margin: 'var(--mj-space-6, 24px) 0',
          border: 'none',
          borderTop: '1px solid var(--mj-color-border, #e5e7eb)',
        }}
      />

      {/* TL;DR field — Component 3 */}
      <TldrField
        value={tldrValue}
        onChange={setTldrValue}
        onRegenerate={handleRegenerate}
        tldrLoading={tldrLoading}
        tldrError={tldrError}
      />
    </div>
  )
}
