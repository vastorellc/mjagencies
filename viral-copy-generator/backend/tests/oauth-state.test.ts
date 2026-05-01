import { describe, it, expect, beforeEach } from 'vitest'
import { createOAuthState, consumeOAuthState, __test__ } from '../src/lib/oauth-state.js'

describe('oauth-state (SETTINGS-04, SETTINGS-05 CSRF)', () => {
  beforeEach(() => __test__.clear())

  it('creates a 64-char hex token', () => {
    const token = createOAuthState('user-1')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns userId on first consume, null on second (single-use)', () => {
    const token = createOAuthState('user-abc')
    expect(consumeOAuthState(token)).toBe('user-abc')
    expect(consumeOAuthState(token)).toBeNull()
  })

  it('returns null for unknown token', () => {
    expect(consumeOAuthState('deadbeef')).toBeNull()
  })

  it('rejects expired token', () => {
    __test__.setEntry('expired-token', { userId: 'user-x', expires: Date.now() - 1000 })
    expect(consumeOAuthState('expired-token')).toBeNull()
  })

  it('produces unique tokens across calls', () => {
    const a = createOAuthState('u')
    const b = createOAuthState('u')
    expect(a).not.toBe(b)
  })
})
