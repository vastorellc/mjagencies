/**
 * packages/auth/src/__tests__/require-session.test.ts
 *
 * Unit tests for requireSession() helper (REQ-024, REQ-031, REQ-301, REQ-310).
 *
 * Strategy:
 *  - Mock `next/navigation` redirect to throw a known sentinel error so we can
 *    assert the redirect target without needing the Next.js runtime.
 *  - Mock `next/headers` cookies() to provide a controlled jar.
 *  - Sign real JWTs with signAccessToken so the jose verification path is
 *    exercised end-to-end (covers REQ-310: alg/iss/aud locked claims).
 *  - Spy on clearAuthCookies to assert it is called BEFORE redirect on failure
 *    (T-03-020 mitigation).
 *
 * Tests:
 *   1  No cookie                       → redirect('/login')
 *   2  Invalid token                   → clearAuthCookies() THEN redirect('/login')
 *   3  Valid editor token              → returns payload
 *   4  Valid admin WITH mfaVerifiedAt  → returns payload
 *   5  Valid admin WITHOUT mfaVerifiedAt → redirect('/mfa/verify')
 *   6  Valid super_admin WITHOUT mfaVerifiedAt → redirect('/mfa/verify')
 *   7  Valid editor + requireMfa:true  → redirect('/mfa/verify')
 *   8  Valid editor + no opts          → returns payload (no MFA required)
 *   9  Wrong audience token (refresh)  → redirect('/login')
 *  10  Expired token                   → clearAuthCookies() THEN redirect('/login')
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'

// ── Env stubs (must be set before any module import that reads env) ───────────
const TEST_ACCESS_SECRET  = 'a'.repeat(64)
const TEST_REFRESH_SECRET = 'b'.repeat(64)

beforeAll(() => {
  vi.stubEnv('JWT_ACCESS_SECRET',  TEST_ACCESS_SECRET)
  vi.stubEnv('JWT_REFRESH_SECRET', TEST_REFRESH_SECRET)
})

// ── Fake cookie store ─────────────────────────────────────────────────────────
const cookieStore: Record<string, string> = {}
const fakeClearCalls: string[][] = []

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get:    (name: string) => (cookieStore[name] !== undefined ? { value: cookieStore[name] } : undefined),
    set:    vi.fn(),
    delete: vi.fn(),
  })),
}))

// ── redirect mock — tracks calls and throws so requireSession() stops ─────────
const redirectCalls: string[] = []

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    redirectCalls.push(url)
    throw new Error(`REDIRECT:${url}`)
  }),
}))

// ── Mock clearAuthCookies — track call order vs redirect ─────────────────────
vi.mock('../cookie.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../cookie.js')>()
  return {
    ...original,
    clearAuthCookies: vi.fn(async () => {
      fakeClearCalls.push(['clearAuthCookies'])
    }),
    // readAccessCookie reads from our cookieStore via the real next/headers mock
    readAccessCookie: async () => {
      const jar = await (await import('next/headers')).cookies()
      return (
        jar.get('mj-access')?.value ??
        jar.get('__Host-access')?.value ??
        undefined
      )
    },
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Seed a fake access cookie value. Pass undefined to remove it. */
function setFakeCookie(value: string | undefined): void {
  if (value === undefined) {
    delete cookieStore['mj-access']
  } else {
    cookieStore['mj-access'] = value
  }
}

/** Reset shared state between tests. */
function resetMocks(): void {
  redirectCalls.length = 0
  fakeClearCalls.length = 0
  delete cookieStore['mj-access']
}

/** Sign a real access token so jose verify path runs end-to-end. */
async function signToken(overrides: Partial<Parameters<typeof import('../tokens.js')['signAccessToken']>[0]> = {}) {
  const { signAccessToken } = await import('../tokens.js')
  return signAccessToken({
    sub:      'user-uuid-1',
    agencyId: 'agency-uuid-1',
    role:     'editor',
    jti:      crypto.randomUUID(),
    familyId: crypto.randomUUID(),
    ...overrides,
  })
}

/** Sign a refresh token (wrong audience) to exercise audience rejection. */
async function signRefreshToken() {
  const { signRefreshToken } = await import('../tokens.js')
  return signRefreshToken({
    sub:      'user-uuid-1',
    agencyId: 'agency-uuid-1',
    jti:      crypto.randomUUID(),
    familyId: crypto.randomUUID(),
  })
}

/** Sign an already-expired access token. */
async function signExpiredToken() {
  const { SignJWT } = await import('jose')
  const secret = new TextEncoder().encode(TEST_ACCESS_SECRET)
  return new SignJWT({ sub: 'u1', agencyId: 'a1', role: 'editor', jti: 'j1', familyId: 'f1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('mjagency')
    .setAudience('mjagency-api')
    .setExpirationTime('-1s') // expired in the past
    .sign(secret)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('requireSession()', () => {
  it('Test 1: No cookie → redirect("/login")', async () => {
    resetMocks()
    setFakeCookie(undefined)

    const { requireSession } = await import('../require-session.js')
    await expect(requireSession()).rejects.toThrow('REDIRECT:/login')
    expect(redirectCalls).toContain('/login')
  })

  it('Test 2: Invalid token → clearAuthCookies() called BEFORE redirect("/login")', async () => {
    resetMocks()
    setFakeCookie('totally.invalid.token')

    const callOrder: string[] = []
    const { clearAuthCookies } = await import('../cookie.js')
    vi.mocked(clearAuthCookies).mockImplementationOnce(async () => {
      callOrder.push('clear')
    })
    const { redirect } = await import('next/navigation')
    vi.mocked(redirect).mockImplementationOnce((url: string) => {
      redirectCalls.push(url)
      callOrder.push(`redirect:${url}`)
      throw new Error(`REDIRECT:${url}`)
    })

    const { requireSession } = await import('../require-session.js')
    await expect(requireSession()).rejects.toThrow('REDIRECT:/login')
    expect(callOrder).toEqual(['clear', 'redirect:/login'])
  })

  it('Test 3: Valid editor token → returns the payload', async () => {
    resetMocks()
    const token = await signToken({ role: 'editor' })
    setFakeCookie(token)

    const { requireSession } = await import('../require-session.js')
    const session = await requireSession()
    expect(session.role).toBe('editor')
    expect(session.agencyId).toBe('agency-uuid-1')
    expect(redirectCalls).toHaveLength(0)
  })

  it('Test 4: Valid admin WITH mfaVerifiedAt → returns payload (no MFA redirect)', async () => {
    resetMocks()
    const token = await signToken({ role: 'admin', mfaVerifiedAt: '2026-04-25T12:00:00.000Z' })
    setFakeCookie(token)

    const { requireSession } = await import('../require-session.js')
    const session = await requireSession()
    expect(session.role).toBe('admin')
    expect(session.mfaVerifiedAt).toBe('2026-04-25T12:00:00.000Z')
    expect(redirectCalls).toHaveLength(0)
  })

  it('Test 5: Valid admin WITHOUT mfaVerifiedAt → redirect("/mfa/verify")', async () => {
    resetMocks()
    const token = await signToken({ role: 'admin' }) // no mfaVerifiedAt
    setFakeCookie(token)

    const { requireSession } = await import('../require-session.js')
    await expect(requireSession()).rejects.toThrow('REDIRECT:/mfa/verify')
    expect(redirectCalls).toContain('/mfa/verify')
  })

  it('Test 6: Valid super_admin WITHOUT mfaVerifiedAt → redirect("/mfa/verify")', async () => {
    resetMocks()
    const token = await signToken({ role: 'super_admin' })
    setFakeCookie(token)

    const { requireSession } = await import('../require-session.js')
    await expect(requireSession()).rejects.toThrow('REDIRECT:/mfa/verify')
    expect(redirectCalls).toContain('/mfa/verify')
  })

  it('Test 7: Valid editor + requireMfa:true → redirect("/mfa/verify") even without MFA_REQUIRED_ROLES', async () => {
    resetMocks()
    const token = await signToken({ role: 'editor' }) // editor normally does NOT require MFA
    setFakeCookie(token)

    const { requireSession } = await import('../require-session.js')
    await expect(requireSession({ requireMfa: true })).rejects.toThrow('REDIRECT:/mfa/verify')
    expect(redirectCalls).toContain('/mfa/verify')
  })

  it('Test 8: Valid editor + no opts → returns payload (editor does not auto-require MFA)', async () => {
    resetMocks()
    const token = await signToken({ role: 'editor' })
    setFakeCookie(token)

    const { requireSession } = await import('../require-session.js')
    const session = await requireSession()
    expect(session.role).toBe('editor')
    expect(redirectCalls).toHaveLength(0)
  })

  it('Test 9: Wrong audience token (refresh) → redirect("/login")', async () => {
    resetMocks()
    const refreshToken = await signRefreshToken()
    setFakeCookie(refreshToken)

    const { requireSession } = await import('../require-session.js')
    await expect(requireSession()).rejects.toThrow('REDIRECT:/login')
    expect(redirectCalls).toContain('/login')
  })

  it('Test 10: Expired token → clearAuthCookies() THEN redirect("/login")', async () => {
    resetMocks()
    const expiredToken = await signExpiredToken()
    setFakeCookie(expiredToken)

    const callOrder: string[] = []
    const { clearAuthCookies } = await import('../cookie.js')
    vi.mocked(clearAuthCookies).mockImplementationOnce(async () => {
      callOrder.push('clear')
    })
    const { redirect } = await import('next/navigation')
    vi.mocked(redirect).mockImplementationOnce((url: string) => {
      redirectCalls.push(url)
      callOrder.push(`redirect:${url}`)
      throw new Error(`REDIRECT:${url}`)
    })

    const { requireSession } = await import('../require-session.js')
    await expect(requireSession()).rejects.toThrow('REDIRECT:/login')
    expect(callOrder).toEqual(['clear', 'redirect:/login'])
  })
})
