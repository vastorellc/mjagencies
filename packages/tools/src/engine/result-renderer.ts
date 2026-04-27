/**
 * packages/tools/src/engine/result-renderer.ts
 *
 * Converts a ToolResult into a safe HTML string for inline rendering.
 * REQ-413: result is inline (id="tool-result"), NOT a separate page route.
 * REQ-402: confirmation page re-send CTA is handled by the email gate action.
 * CLAUDE.md: server-side DOMPurify before any HTML storage or delivery.
 *
 * The rendered HTML uses var(--mj-*) token class references via inline style attributes.
 * React components map these to the token system established in Phase 4.
 *
 * IMPORTANT: the returned string is already DOMPurify-sanitized.
 * Consumer components must pass this pre-sanitized string directly — never
 * pass raw user input to any HTML rendering context.
 */
import DOMPurify from 'isomorphic-dompurify'
import type { ToolResult, ToolOutputMetric } from './types.js'

function renderMetric(metric: ToolOutputMetric): string {
  if (metric.isPrimary) {
    return `<div class="tool-metric tool-metric--primary">
      <span class="tool-metric__value" style="font-size:var(--mj-text-size-4xl);font-weight:var(--mj-weight-bold);line-height:var(--mj-leading-tight);color:var(--mj-color-text-primary)">${metric.value}</span>
      <span class="tool-metric__label" style="font-size:var(--mj-text-size-sm);color:var(--mj-color-text-secondary)">${metric.label}</span>
      ${metric.description ? `<p class="tool-metric__description" style="font-size:var(--mj-text-size-base)">${metric.description}</p>` : ''}
    </div>`
  }
  return `<div class="tool-metric">
    <span class="tool-metric__value" style="font-size:var(--mj-text-size-2xl);font-weight:var(--mj-weight-bold)">${metric.value}</span>
    <span class="tool-metric__label" style="font-size:var(--mj-text-size-sm);color:var(--mj-color-text-secondary)">${metric.label}</span>
    ${metric.description ? `<p class="tool-metric__description">${metric.description}</p>` : ''}
  </div>`
}

function renderExpiryBadge(result: ToolResult): string {
  if (!result.benchmarkExpired) return ''
  // UI-SPEC: var(--mj-color-warning) background, role="status" yellow pill
  // Copy: "Benchmark data last updated [month year]. Results remain valid — updated benchmarks coming soon."
  return `<span role="status" class="benchmark-badge benchmark-badge--expired"
    style="background:var(--mj-color-warning);padding:var(--mj-space-1) var(--mj-space-2);border-radius:9999px;font-size:var(--mj-text-size-sm)">
    Benchmark data last updated ${result.benchmarkUpdatedLabel}. Results remain valid — updated benchmarks coming soon.
  </span>`
}

/**
 * Renders a ToolResult as a safe, sanitized HTML string.
 * Call this server-side before writing result HTML to any state or DB.
 * DOMPurify strips all scripts and event handlers (on* attributes).
 * ALLOWED_ATTR excludes any on* event handler attributes — T-10-01-02 mitigation.
 */
export function renderToolResult(result: ToolResult): string {
  const raw = `<section
    id="tool-result"
    data-print-region="tool-result"
    style="scroll-margin-top:var(--mj-space-16)"
    aria-label="Your Results">
    <h2 style="font-size:var(--mj-text-size-2xl);font-weight:var(--mj-weight-bold);line-height:var(--mj-leading-tight)">Your Results</h2>
    ${renderExpiryBadge(result)}
    <div class="tool-metrics" style="display:flex;flex-direction:column;gap:var(--mj-space-4)">
      ${result.metrics.map(renderMetric).join('\n')}
    </div>
    <p class="tool-disclaimer" style="font-size:var(--mj-text-size-sm);color:var(--mj-color-text-secondary);margin-top:var(--mj-space-6)">
      ${result.disclaimer}
    </p>
    <p class="benchmark-citation" style="font-size:var(--mj-text-size-sm);color:var(--mj-color-text-secondary)">
      ${result.benchmarkCitation}
    </p>
  </section>`

  // DOMPurify: allow style attributes (needed for token references) but strip scripts, event handlers
  return DOMPurify.sanitize(raw, {
    ALLOWED_ATTR: ['id', 'class', 'style', 'aria-label', 'role', 'data-print-region'],
    ALLOWED_TAGS: ['section', 'div', 'span', 'p', 'h2', 'h3'],
  })
}
