/**
 * packages/auth/src/__tests__/cookie.test.ts
 *
 * Unit tests for cookie writer with prod/dev split (REQ-023, Open Q5).
 * Mocks next/headers via vi.mock (hoisted by vitest) so no Next.js runtime is needed.
 *
 * Tests: production __Host- names, secure flags, maxAge values, dev fallback,
 * clearAuthCookies covers all 4 names, readAccessCookie fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Fake cookie jar ──────────────────────────────────────────────────────────

type SetCall = { name: string; value: string; opts?: Record<string, unknown> }

function makeFakeJar() {
  const setCalls: SetCall[] = []
  const store: Record<string, string> = {}

  return {
    set: vi.fn((name: string, value: string, opts?: Record<string, unknown>) => {
      setCalls.push({ name, value, opts })
      if (value) store[name] = value
      else delete store[name]
    }),
    get: vi.fn((name: string) => (store[name] !== undefined ? { value: store[name] } : undefined)),
    delete: vi.fn(),
    _setCalls: setCalls,
    _seed: (name: string, value: string) => { store[name] = value },
  }
}

// ── Module-level mock (vitest hoists vi.mock calls) ──────────────────────────
// We use a mutable ref so each test can swap the jar without remocking the module.

const jarRef: { current: ReturnType<typeof makeFakeJar> | null } = { current: null }

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => {
    if (!jarRef.current) throw new Error('jarRef.current not set in test')
    return jarRef.current
  }),
}))

// ── Helper to get a fresh cookie module respecting current NODE_ENV ──────────
// vitest re-evaluates module-level constants (IS_PROD, ACCESS_COOKIE) at import time,
// so we must resetModules between env changes.
async function importCookieModule() {
  return import('../cookie.js')
}

// ────────────────────────────────────────────────────────────────────────────
describe('Production cookies (__Host- prefix)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    jarRef.current = makeFakeJar()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Test A: production writes __Host-access and __Host-refresh', async () => {
    const { setAuthCookies } = await importCookieModule()
    await setAuthCookies('access-token-value', 'refresh-token-value')
    const names = jarRef.current!._setCalls.map((c) => c.name)
    expect(names).toContain('__Host-access')
    expect(names).toContain('__Host-refresh')
  })

  it('Test B: production cookies have secure:true, sameSite:strict, httpOnly:true, path:/, no domain', async () => {
    const { setAuthCookies } = await importCookieModule()
    await setAuthCookies('access-token-value', 'refresh-token-value')
    const accessCall = jarRef.current!._setCalls.find((c) => c.name === '__Host-access')
    expect(accessCall).toBeDefined()
    const opts = accessCall!.opts as Record<string, unknown>
    expect(opts['secure']).toBe(true)
    expect(opts['sameSite']).toBe('strict')
    expect(opts['httpOnly']).toBe(true)
    expect(opts['path']).toBe('/')
    expect(opts['domain']).toBeUndefined()
  })

  it('Test C: access maxAge=900, refresh maxAge=604800', async () => {
    const { setAuthCookies } = await importCookieModule()
    await setAuthCookies('access-token-value', 'refresh-token-value')
    const accessCall = jarRef.current!._setCalls.find((c) => c.name === '__Host-access')
    const refreshCall = jarRef.current!._setCalls.find((c) => c.name === '__Host-refresh')
    expect((accessCall!.opts as Record<string, unknown>)['maxAge']).toBe(900)
    expect((refreshCall!.opts as Record<string, unknown>)['maxAge']).toBe(604800)
  })
})

describe('Development cookies (mj- prefix)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'development')
    jarRef.current = makeFakeJar()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Test D: dev writes mj-access and mj-refresh with secure:false', async () => {
    const { setAuthCookies } = await importCookieModule()
    await setAuthCookies('access-token-value', 'refresh-token-value')
    const names = jarRef.current!._setCalls.map((c) => c.name)
    expect(names).toContain('mj-access')
    expect(names).toContain('mj-refresh')
    const accessCall = jarRef.current!._setCalls.find((c) => c.name === 'mj-access')
    expect((accessCall!.opts as Record<string, unknown>)['secure']).toBe(false)
  })
})

describe('clearAuthCookies covers all 4 names', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    jarRef.current = makeFakeJar()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Test E: clearAuthCookies issues maxAge:0 for __Host-access, __Host-refresh, mj-access, mj-refresh', async () => {
    const { clearAuthCookies } = await importCookieModule()
    await clearAuthCookies()
    const clearedNames = jarRef.current!._setCalls
      .filter((c) => (c.opts as Record<string, unknown>)?.['maxAge'] === 0)
      .map((c) => c.name)
    expect(clearedNames).toContain('__Host-access')
    expect(clearedNames).toContain('__Host-refresh')
    expect(clearedNames).toContain('mj-access')
    expect(clearedNames).toContain('mj-refresh')
  })
})

describe('readAccessCookie fallback chain', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    jarRef.current = makeFakeJar()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Test F: readAccessCookie returns mj- fallback when active name absent', async () => {
    const { readAccessCookie } = await importCookieModule()
    // Seed only the mj-access fallback (simulates prod→dev NODE_ENV toggle scenario)
    jarRef.current!._seed('mj-access', 'fallback-access-value')
    const value = await readAccessCookie()
    expect(value).toBe('fallback-access-value')
  })
})
