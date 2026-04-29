/**
 * apps/web-main/src/jobs/__tests__/tool-pdf-email-bridge.test.ts
 *
 * Unit tests for the tool-pdf-email → email-send bridge.
 *
 * The BullMQ / Redis surface isn't tested here (integration concern). Instead
 * we drive `processToolPdfEmail(data, deps)` with mock dependencies and verify:
 *
 *   - Permanent input errors (unknown tool slug, malformed JSON, bad result
 *     shape) DROP silently — log and return — so BullMQ doesn't retry-storm.
 *   - Valid input enqueues an email-send job whose to / subject / html /
 *     agencyId fields match the wire contract that @mjagency/email expects.
 *   - The rendered HTML body contains the actual metric values from the tool
 *     result (so we know renderToolResult was actually invoked, not stubbed).
 *   - Tool name is HTML-escaped (defensive, even though tool names are
 *     developer-controlled).
 *   - enqueueEmail rejection propagates so BullMQ retries a transient send
 *     failure (NOT swallowed).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks for the @mjagency/tools surface ─────────────────────────
const mocks = vi.hoisted(() => ({
  getToolBySlug:    vi.fn(),
  renderToolResult: vi.fn(),
}))

vi.mock('@mjagency/tools', () => ({
  getToolBySlug:    mocks.getToolBySlug,
  renderToolResult: mocks.renderToolResult,
}))

const { processToolPdfEmail } = await import('../tool-pdf-email-bridge.js')

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<{
  enqueueEmail: ReturnType<typeof vi.fn>
  log:          ReturnType<typeof vi.fn>
}> = {}): {
  deps: {
    enqueueEmail: ReturnType<typeof vi.fn>
    log:          ReturnType<typeof vi.fn>
  }
} {
  return {
    deps: {
      enqueueEmail: overrides.enqueueEmail ?? vi.fn(async () => undefined),
      log:          overrides.log          ?? vi.fn(),
    },
  }
}

const SAMPLE_RESULT = {
  metrics: [
    { value: '$42,000',  label: 'Annual savings', isPrimary: true },
    { value: '12 months', label: 'Payback period' },
  ],
  disclaimer: 'Estimates only — not financial advice.',
  benchmarkCitation: 'Source: Industry benchmarks 2025',
  benchmarkExpired: false,
  benchmarkUpdatedLabel: 'March 2025',
}

const VALID_INPUT = (overrides: Partial<{ email: string; toolSlug: string; toolResultJson: string; agencySlug: string }> = {}) => ({
  email:          'visitor@example.com',
  toolSlug:       'roi-calculator',
  toolResultJson: JSON.stringify(SAMPLE_RESULT),
  agencySlug:     'finance',
  ...overrides,
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('processToolPdfEmail — permanent input errors drop silently (no BullMQ retry)', () => {
  beforeEach(() => {
    mocks.getToolBySlug.mockReset()
    mocks.renderToolResult.mockReset()
  })

  it('Test 1: unknown tool slug → log + return, no email enqueued', async () => {
    mocks.getToolBySlug.mockReturnValue(undefined)
    const { deps } = makeDeps()

    await processToolPdfEmail(VALID_INPUT({ toolSlug: 'made-up-tool' }), deps)

    expect(deps.enqueueEmail).not.toHaveBeenCalled()
    expect(deps.log).toHaveBeenCalledWith(
      'tool_not_found_dropping',
      expect.objectContaining({ toolSlug: 'made-up-tool', agencySlug: 'finance' }),
    )
  })

  it('Test 2: malformed JSON in toolResultJson → log + return, no enqueue', async () => {
    mocks.getToolBySlug.mockReturnValue({ slug: 'x', name: 'X', agencySlug: 'finance' })
    const { deps } = makeDeps()

    await processToolPdfEmail(VALID_INPUT({ toolResultJson: '{not valid' }), deps)

    expect(deps.enqueueEmail).not.toHaveBeenCalled()
    expect(deps.log).toHaveBeenCalledWith(
      'invalid_tool_result_json_dropping',
      expect.any(Object),
    )
  })

  it('Test 3: result missing metrics array → log + return (shape guard)', async () => {
    mocks.getToolBySlug.mockReturnValue({ slug: 'x', name: 'X', agencySlug: 'finance' })
    const { deps } = makeDeps()

    await processToolPdfEmail(
      VALID_INPUT({ toolResultJson: JSON.stringify({ disclaimer: 'no metrics here' }) }),
      deps,
    )

    expect(deps.enqueueEmail).not.toHaveBeenCalled()
    expect(deps.log).toHaveBeenCalledWith(
      'tool_result_shape_invalid_dropping',
      expect.any(Object),
    )
  })
})

describe('processToolPdfEmail — happy path enqueues a well-formed email-send job', () => {
  beforeEach(() => {
    mocks.getToolBySlug.mockReset()
    mocks.renderToolResult.mockReset()
    mocks.getToolBySlug.mockReturnValue({
      slug: 'roi-calculator',
      name: 'ROI Calculator',
      agencySlug: 'finance',
    })
    mocks.renderToolResult.mockReturnValue(
      '<section id="tool-result">FAKE_RESULT_HTML</section>',
    )
  })

  it('Test 4: enqueues email-send with correct to / from / subject / agencyId', async () => {
    const { deps } = makeDeps()

    await processToolPdfEmail(VALID_INPUT(), deps)

    expect(deps.enqueueEmail).toHaveBeenCalledTimes(1)
    const job = deps.enqueueEmail.mock.calls[0]![0] as Record<string, string>
    expect(job.to).toBe('visitor@example.com')
    expect(job.subject).toBe('Your ROI Calculator report')
    expect(job.agencyId).toBe('finance')
    // from defaults to noreply@mjagency.com when EMAIL_FROM/SMTP_FROM are unset
    expect(job.from).toBeTruthy()
  })

  it('Test 5: email body contains the rendered tool result HTML', async () => {
    const { deps } = makeDeps()

    await processToolPdfEmail(VALID_INPUT(), deps)

    const job = deps.enqueueEmail.mock.calls[0]![0] as Record<string, string>
    expect(job.html).toContain('FAKE_RESULT_HTML')
    expect(job.html).toContain('ROI Calculator')
    expect(mocks.renderToolResult).toHaveBeenCalledWith(SAMPLE_RESULT)
  })

  it('Test 6: tool name with HTML metacharacters is escaped in the email body', async () => {
    mocks.getToolBySlug.mockReturnValueOnce({
      slug: 'evil',
      name: 'Cool Calc <script>alert(1)</script> & Friends',
      agencySlug: 'finance',
    })
    const { deps } = makeDeps()

    await processToolPdfEmail(VALID_INPUT({ toolSlug: 'evil' }), deps)

    const job = deps.enqueueEmail.mock.calls[0]![0] as Record<string, string>
    expect(job.html).not.toContain('<script>alert(1)</script>')
    expect(job.html).toContain('&lt;script&gt;')
    expect(job.html).toContain('&amp;')
  })

  it('Test 7: agencySlug round-trips into the email job (cross-tenant safety)', async () => {
    const { deps } = makeDeps()

    await processToolPdfEmail(VALID_INPUT({ agencySlug: 'web-ecommerce' }), deps)

    const job = deps.enqueueEmail.mock.calls[0]![0] as Record<string, string>
    expect(job.agencyId).toBe('web-ecommerce')
    expect(job.agencyId).not.toBe('finance')
  })

  it('Test 8: success path logs tool_pdf_email_bridged with toolSlug + agencySlug', async () => {
    const { deps } = makeDeps()

    await processToolPdfEmail(VALID_INPUT(), deps)

    expect(deps.log).toHaveBeenCalledWith(
      'tool_pdf_email_bridged',
      expect.objectContaining({ toolSlug: 'roi-calculator', agencySlug: 'finance' }),
    )
  })
})

describe('processToolPdfEmail — transient errors propagate (BullMQ retries)', () => {
  beforeEach(() => {
    mocks.getToolBySlug.mockReset()
    mocks.renderToolResult.mockReset()
    mocks.getToolBySlug.mockReturnValue({ slug: 'x', name: 'X', agencySlug: 'finance' })
    mocks.renderToolResult.mockReturnValue('<section>html</section>')
  })

  it('Test 9: enqueueEmail rejection propagates so BullMQ retries (not swallowed)', async () => {
    const { deps } = makeDeps({
      enqueueEmail: vi.fn(async () => {
        throw new Error('redis unavailable')
      }),
    })

    await expect(processToolPdfEmail(VALID_INPUT(), deps)).rejects.toThrow(
      'redis unavailable',
    )
  })
})
