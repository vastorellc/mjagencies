/**
 * packages/tools/src/__tests__/result-renderer.test.ts
 *
 * Unit tests for renderToolResult — converts a ToolResult into a sanitized
 * HTML string for inline rendering AND email body inclusion.
 *
 * The output crosses TWO trust boundaries:
 *   1. Server → Browser (inline render via dangerouslySetInnerHTML)
 *   2. Server → Email recipient (renderToolResult output is wrapped in an
 *      HTML email shell by the tool-pdf-email bridge worker)
 *
 * If a XSS vector slips past DOMPurify here, it lands in BOTH browser DOM
 * AND email clients. We lock in:
 *   - Script tags / event handlers / javascript: URIs are stripped
 *   - The expected wrapper element + class names ARE preserved
 *   - Metric values, labels, descriptions, disclaimer, citation all appear
 *   - Expired-benchmark badge appears only when result.benchmarkExpired
 */

import { describe, it, expect } from 'vitest'
import { renderToolResult } from '../engine/result-renderer.js'
import type { ToolResult } from '../engine/types.js'

// ── Helpers ───────────────────────────────────────────────────────────────

const VALID_RESULT = (overrides: Partial<ToolResult> = {}): ToolResult => ({
  metrics: [
    { value: '$42,000', label: 'Annual savings', isPrimary: true, description: 'Based on industry benchmarks' },
    { value: '12 months', label: 'Payback period', isPrimary: false },
  ],
  disclaimer:            'Estimates only — not financial advice.',
  benchmarkCitation:     'Source: Industry benchmarks Q1 2025',
  benchmarkExpired:      false,
  benchmarkUpdatedLabel: 'March 2025',
  ...overrides,
} as ToolResult)

// ── Output structure ──────────────────────────────────────────────────────

describe('renderToolResult — basic output structure', () => {
  it('Test 1: returns a non-empty string wrapped in <section id="tool-result">', () => {
    const html = renderToolResult(VALID_RESULT())
    expect(html).toContain('<section')
    expect(html).toContain('id="tool-result"')
    expect(html).toContain('aria-label="Your Results"')
  })

  it('Test 2: includes all metric values, labels, and descriptions', () => {
    const html = renderToolResult(VALID_RESULT())
    expect(html).toContain('$42,000')
    expect(html).toContain('Annual savings')
    expect(html).toContain('Based on industry benchmarks')
    expect(html).toContain('12 months')
    expect(html).toContain('Payback period')
  })

  it('Test 3: primary metric uses larger fontSize than secondary metrics', () => {
    const html = renderToolResult(VALID_RESULT())
    // Primary: 4xl size token; Secondary: 2xl. Both must appear.
    expect(html).toMatch(/font-size:var\(--mj-text-size-4xl\)/)
    expect(html).toMatch(/font-size:var\(--mj-text-size-2xl\)/)
  })

  it('Test 4: includes the disclaimer text', () => {
    const html = renderToolResult(VALID_RESULT({
      disclaimer: 'Test disclaimer — for testing only.',
    }))
    expect(html).toContain('Test disclaimer — for testing only.')
  })

  it('Test 5: includes the benchmark citation', () => {
    const html = renderToolResult(VALID_RESULT({
      benchmarkCitation: 'Source: Custom 2026',
    }))
    expect(html).toContain('Source: Custom 2026')
  })

  it('Test 6: omits the description div when metric.description is unset', () => {
    const html = renderToolResult(VALID_RESULT({
      metrics: [{ value: '5%', label: 'Rate', isPrimary: true }],
    }))
    expect(html).not.toContain('tool-metric__description')
  })
})

// ── Expired-benchmark badge ──────────────────────────────────────────────

describe('renderToolResult — expired-benchmark badge', () => {
  it('Test 7: benchmarkExpired:false → no badge rendered', () => {
    const html = renderToolResult(VALID_RESULT({ benchmarkExpired: false }))
    expect(html).not.toContain('benchmark-badge--expired')
    expect(html).not.toContain('Benchmark data last updated')
  })

  it('Test 8: benchmarkExpired:true → badge rendered with role="status" and update label', () => {
    const html = renderToolResult(VALID_RESULT({
      benchmarkExpired:      true,
      benchmarkUpdatedLabel: 'October 2024',
    }))
    expect(html).toContain('role="status"')
    expect(html).toContain('benchmark-badge--expired')
    expect(html).toContain('Benchmark data last updated October 2024')
    expect(html).toContain('updated benchmarks coming soon')
  })
})

// ── Sanitization (T-10-01-02) ─────────────────────────────────────────────

describe('renderToolResult — DOMPurify sanitization (T-10-01-02)', () => {
  it('Test 9: strips <script> tags injected via metric value', () => {
    const html = renderToolResult(VALID_RESULT({
      metrics: [{
        value: '<script>alert("XSS")</script>$1,000',
        label: 'Score',
        isPrimary: true,
      }],
    }))
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert("XSS")')
    expect(html).not.toContain('alert(&quot;XSS&quot;)') // also not the encoded form
  })

  it('Test 10: strips on* event handlers from any injected element', () => {
    const html = renderToolResult(VALID_RESULT({
      disclaimer: '<span onclick="steal()">click me</span>',
    }))
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('steal()')
  })

  it('Test 11: strips <iframe> injection attempts', () => {
    const html = renderToolResult(VALID_RESULT({
      benchmarkCitation: '<iframe src="https://evil.example/x"></iframe>Source: real',
    }))
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('evil.example')
  })

  it('Test 12: strips <a href> elements (not in ALLOWED_TAGS)', () => {
    // The renderer\'s ALLOWED_TAGS are section/div/span/p/h2/h3 only.
    // Anchors injected through user content must be stripped because we
    // can\'t safely vet href values inline.
    const html = renderToolResult(VALID_RESULT({
      disclaimer: '<a href="javascript:alert(1)">click</a>',
    }))
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('javascript:')
  })

  it('Test 13: keeps the structural class names + style attributes intact', () => {
    // Critical: stripping too aggressively would break the email render.
    // We rely on style/class attributes for visual fidelity in clients
    // that don\'t apply the page CSS.
    const html = renderToolResult(VALID_RESULT())
    expect(html).toContain('class="tool-metric')
    expect(html).toContain('style=')
    expect(html).toContain('var(--mj-')
  })

  it('Test 14: preserves data-print-region for the print-only stylesheet hook', () => {
    const html = renderToolResult(VALID_RESULT())
    expect(html).toContain('data-print-region="tool-result"')
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────

describe('renderToolResult — edge cases', () => {
  it('Test 15: empty metrics array still produces a valid section (no metric rows)', () => {
    const html = renderToolResult(VALID_RESULT({ metrics: [] }))
    expect(html).toContain('<section')
    expect(html).not.toContain('tool-metric--primary')
  })

  it('Test 16: special characters in metric values are not double-escaped (& and <)', () => {
    const html = renderToolResult(VALID_RESULT({
      metrics: [{
        value: 'Q4 2024 & Q1 2025',
        label: 'Period',
        isPrimary: true,
      }],
    }))
    // The ampersand should appear as the entity (or literal — DOMPurify is
    // permissive on this) but never as a broken sequence.
    expect(html).toMatch(/Q4 2024 (&|&amp;) Q1 2025/)
  })
})
