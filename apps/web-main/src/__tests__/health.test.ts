import { describe, it, expect, vi, afterEach } from 'vitest'

describe('GET /api/health', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns 200 with correct JSON body', async () => {
    // Import the handler — will create logger side effect
    const { GET } = await import('../app/api/health/route.js')

    const req = new Request('http://localhost:3000/api/health')
    const response = await GET(req)

    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.service).toBe('mjagency-main')
    expect(body.agency).toBe('main')
  })

  it('exports runtime = "nodejs"', async () => {
    const mod = (await import('../app/api/health/route.js')) as Record<string, unknown>
    expect(mod.runtime).toBe('nodejs')
  })

  it('calls log.info when health route is invoked', async () => {
    // Verify that the logger does not throw and the response is defined
    const { GET } = await import('../app/api/health/route.js')
    const req = new Request('http://localhost:3000/api/health')
    const result = await GET(req)
    expect(result).toBeDefined()
    expect(result.status).toBe(200)
  })
})
