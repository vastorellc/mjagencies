import { describe, it, expect } from 'vitest'
import { fetchTrace } from '@mjagency/testing/tempo-client'

const enabled = process.env.INTEGRATION === 'otel-tempo'
;(enabled ? describe : describe.skip)('OTel -> Tempo end-to-end', () => {
  it('emits a trace visible in Tempo', async () => {
    const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
    const expectedTraceId = '0af7651916cd43dd8448eb211c80319c'
    const r = await fetch('http://localhost:3000/api/health', { headers: { traceparent } })
    expect(r.status).toBe(200)
    // wait briefly for Tempo to ingest
    await new Promise((r) => setTimeout(r, 2000))
    const traceData = await fetchTrace(expectedTraceId)
    expect(traceData).not.toBeNull()
  }, 15_000)
})
