import { describe, it, expect } from 'vitest'
import { createMetrics } from '../metrics.js'

describe('createMetrics', () => {
  it('returns register, httpRequestsTotal, and httpRequestDurationSeconds', () => {
    const m = createMetrics({ agencyId: 'ecommerce' })
    expect(m).toHaveProperty('register')
    expect(m).toHaveProperty('httpRequestsTotal')
    expect(m).toHaveProperty('httpRequestDurationSeconds')
  })

  it('register.contentType matches Prometheus exposition Content-Type', () => {
    const { register } = createMetrics({ agencyId: 'ecommerce' })
    expect(register.contentType).toContain('text/plain')
    expect(register.contentType).toContain('version=0.0.4')
  })

  it('register.metrics() output contains agency.id label after counter increment', async () => {
    const { register, httpRequestsTotal } = createMetrics({ agencyId: 'ecommerce' })
    httpRequestsTotal.inc({ method: 'GET', route: '/x', status_code: '200' })
    const output = await register.metrics()
    expect(output).toContain('agency.id="ecommerce"')
    expect(output).toContain('http_requests_total')
  })

  it('register.metrics() output contains default Node metrics', async () => {
    const { register } = createMetrics({ agencyId: 'ecommerce' })
    const output = await register.metrics()
    // Default metrics — at least one of these should appear
    const hasDefaultMetric =
      output.includes('process_cpu_user_seconds_total') ||
      output.includes('nodejs_heap_size_total_bytes') ||
      output.includes('nodejs_eventloop_lag_seconds')
    expect(hasDefaultMetric).toBe(true)
  })
})
