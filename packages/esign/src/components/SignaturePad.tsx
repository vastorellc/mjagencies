/**
 * packages/esign/src/components/SignaturePad.tsx
 * UI-SPEC: react-signature-canvas wrapper.
 * Canvas: full container width × 120px minimum height (ESIGN Act usability).
 * Sign CTA disabled until canvas has strokes (non-empty).
 * WCAG 2.2 AA: role="img", aria-label, 44px minimum touch targets.
 * Dynamic import: canvas APIs unavailable in SSR — ssr: false guards against Next.js build errors.
 */
'use client'
import { useRef, useState, useCallback } from 'react'
import type SignatureCanvas from 'react-signature-canvas'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with canvas (canvas APIs unavailable in Node.js/SSR)
const ReactSignatureCanvas = dynamic(
  () => import('react-signature-canvas').then((m) => m.default),
  { ssr: false },
)

export interface SignaturePadProps {
  onSignatureChange: (dataUri: string | null) => void
}

export function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  const handleEnd = useCallback(() => {
    if (!sigRef.current) return
    const empty = sigRef.current.isEmpty()
    setIsEmpty(empty)
    if (!empty) {
      onSignatureChange(sigRef.current.toDataURL('image/png'))
    }
  }, [onSignatureChange])

  const handleClear = useCallback(() => {
    sigRef.current?.clear()
    setIsEmpty(true)
    onSignatureChange(null)
  }, [onSignatureChange])

  return (
    <div>
      <div
        role="img"
        aria-label="Signature canvas. Sign using mouse, touch, or stylus."
        style={{
          border: isEmpty
            ? '2px solid var(--mj-color-border)'
            : '2px solid var(--mj-color-border-focus)',
          borderRadius: '4px',
          background: 'var(--mj-color-bg-primary)',
          width: '100%',
          minHeight: '120px',
        }}
      >
        <ReactSignatureCanvas
          ref={sigRef}
          canvasProps={{
            style: { width: '100%', minHeight: '120px', display: 'block' },
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — aria-hidden is valid on canvas but not in ReactSignatureCanvas types
            'aria-hidden': 'true',
          }}
          onEnd={handleEnd}
        />
      </div>
      <button
        type="button"
        onClick={handleClear}
        style={{
          marginTop: 'var(--mj-space-2)',
          padding: 'var(--mj-space-2) var(--mj-space-4)',
          fontSize: 'var(--mj-text-size-sm)',
          background: 'transparent',
          border: '1px solid var(--mj-color-border)',
          borderRadius: '4px',
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        Clear Signature
      </button>
    </div>
  )
}
