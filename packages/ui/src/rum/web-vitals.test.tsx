import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { WebVitalsReporter } from './web-vitals.js'
import type { Metric } from 'web-vitals'

// Capture the metric handlers registered by the component
const metricHandlers: Map<string, (metric: Metric) => void> = new Map()

vi.mock('web-vitals', () => ({
  onLCP: vi.fn((fn: (m: Metric) => void) => { metricHandlers.set('LCP', fn) }),
  onINP: vi.fn((fn: (m: Metric) => void) => { metricHandlers.set('INP', fn) }),
  onCLS: vi.fn((fn: (m: Metric) => void) => { metricHandlers.set('CLS', fn) }),
  onFCP: vi.fn((fn: (m: Metric) => void) => { metricHandlers.set('FCP', fn) }),
  onTTFB: vi.fn((fn: (m: Metric) => void) => { metricHandlers.set('TTFB', fn) }),
}))

function makeMetric(name: string, value: number, id: string): Metric {
  return { name, value, id, delta: value, entries: [], navigationType: 'navigate' } as Metric
}

describe('WebVitalsReporter', () => {
  let gtagMock: ReturnType<typeof vi.fn>

  afterEach(() => {
    vi.clearAllMocks()
    metricHandlers.clear()
    delete (window as typeof window & { gtag?: unknown }).gtag
  })

  it('renders null (no DOM output)', () => {
    const { container } = render(<WebVitalsReporter ga4MeasurementId="G-TEST123" />)
    expect(container.children).toHaveLength(0)
  })

  it('fires LCP event to GA4 with correct payload', async () => {
    gtagMock = vi.fn()
    ;(window as typeof window & { gtag: typeof gtagMock }).gtag = gtagMock

    await act(async () => {
      render(<WebVitalsReporter ga4MeasurementId="G-TEST123" />)
      await new Promise(r => setTimeout(r, 0))
    })

    const lcpHandler = metricHandlers.get('LCP')
    expect(lcpHandler).toBeDefined()
    lcpHandler!(makeMetric('LCP', 1500, 'v3-abc'))

    expect(gtagMock).toHaveBeenCalledWith('event', 'LCP', {
      value: 1500,
      event_category: 'Web Vitals',
      event_label: 'v3-abc',
      non_interaction: true,
      send_to: 'G-TEST123',
    })
  })

  it('multiplies CLS value by 1000 before sending', async () => {
    gtagMock = vi.fn()
    ;(window as typeof window & { gtag: typeof gtagMock }).gtag = gtagMock

    await act(async () => {
      render(<WebVitalsReporter ga4MeasurementId="G-TEST123" />)
      await new Promise(r => setTimeout(r, 0))
    })

    const clsHandler = metricHandlers.get('CLS')
    clsHandler!(makeMetric('CLS', 0.05, 'v3-def'))

    expect(gtagMock).toHaveBeenCalledWith('event', 'CLS', expect.objectContaining({
      value: 50,
    }))
  })

  it('does not throw when window.gtag is undefined', async () => {
    await act(async () => {
      render(<WebVitalsReporter ga4MeasurementId="G-TEST123" />)
      await new Promise(r => setTimeout(r, 0))
    })

    const lcpHandler = metricHandlers.get('LCP')
    expect(() => lcpHandler?.(makeMetric('LCP', 1200, 'v3-xyz'))).not.toThrow()
  })

  it('registers all 5 metric handlers', async () => {
    await act(async () => {
      render(<WebVitalsReporter ga4MeasurementId="G-TEST123" />)
      await new Promise(r => setTimeout(r, 0))
    })

    expect(metricHandlers.has('LCP')).toBe(true)
    expect(metricHandlers.has('INP')).toBe(true)
    expect(metricHandlers.has('CLS')).toBe(true)
    expect(metricHandlers.has('FCP')).toBe(true)
    expect(metricHandlers.has('TTFB')).toBe(true)
  })

  it('sends INP event without CLS multiplication', async () => {
    gtagMock = vi.fn()
    ;(window as typeof window & { gtag: typeof gtagMock }).gtag = gtagMock

    await act(async () => {
      render(<WebVitalsReporter ga4MeasurementId="G-TEST123" />)
      await new Promise(r => setTimeout(r, 0))
    })

    const inpHandler = metricHandlers.get('INP')
    inpHandler!(makeMetric('INP', 150, 'v3-ghi'))

    expect(gtagMock).toHaveBeenCalledWith('event', 'INP', expect.objectContaining({
      value: 150,
    }))
  })
})
