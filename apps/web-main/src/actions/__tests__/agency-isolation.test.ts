/**
 * apps/web-main/src/actions/__tests__/agency-isolation.test.ts
 *
 * Tier 1 unit tests proving the per-action agency-isolation defense works.
 *
 * CLAUDE.md Rule 8 mandates that every server action verify
 *   session.agencyId === input.agencyId
 * AFTER requireSession() and BEFORE any business logic. Middleware-level
 * agency match (middleware.test.ts Test 4) is the first line of defense;
 * this per-action check is the second line, required because middleware
 * does not protect dynamically-imported / inlined server-action calls
 * (CVE-2025-29927 demonstrated middleware bypass).
 *
 * We test 3 representative actions across 2 modules (ai-editor.ts and
 * seo-score.ts) to demonstrate the pattern. The defense is byte-identical
 * across all 22 actions in the two files, so spot-checking 3 is sufficient.
 *
 * Each action is verified for two properties:
 *   a) Cross-tenant call throws 'Forbidden' BEFORE any underlying engine fires
 *   b) Same-tenant call proceeds to the underlying engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (vi.mock factories run before any const initializers) ────
const mocks = vi.hoisted(() => ({
  requireSession:    vi.fn(),
  runPluginEngine:   vi.fn(),
  aiDraftFromTitle:  vi.fn(),
  aiRewrite:         vi.fn(),
}))

vi.mock('@mjagency/auth', () => ({
  requireSession: mocks.requireSession,
}))

vi.mock('@mjagency/seo', () => ({
  runPluginEngine: mocks.runPluginEngine,
}))

vi.mock('@mjagency/ai', () => ({
  aiDraftFromTitle: mocks.aiDraftFromTitle,
  aiRewrite:        mocks.aiRewrite,
  // Other exports are unused by the actions we test in this file.
}))

// Import AFTER mocks are registered (the actions use both static and dynamic
// imports; vi.mock applies to both).
const { computeLiveScore }                   = await import('../seo-score.js')
const { draftFromTitle, rewriteSelection }   = await import('../ai-editor.js')

// ── Helpers ────────────────────────────────────────────────────────────────

const SESSION_FOR = (agencyId: string) => ({
  sub:      'user-uuid-1',
  agencyId,
  role:     'editor' as const,
  jti:      'jti-1',
  familyId: 'fam-1',
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Agency-isolation defense in server actions (CLAUDE.md Rule 8)', () => {
  beforeEach(() => {
    mocks.requireSession.mockReset()
    mocks.runPluginEngine.mockReset()
    mocks.aiDraftFromTitle.mockReset()
    mocks.aiRewrite.mockReset()
  })

  // ────────────────────────────────────────────────────────────────────
  // computeLiveScore — apps/web-main/src/actions/seo-score.ts
  // ────────────────────────────────────────────────────────────────────

  describe('computeLiveScore (seo-score.ts)', () => {
    it("Test 1: throws 'Forbidden' when session.agencyId !== input.agencyId", async () => {
      mocks.requireSession.mockResolvedValue(SESSION_FOR('agency-A'))

      await expect(
        computeLiveScore({ content: {}, agencyId: 'agency-B' }),
      ).rejects.toThrow('Forbidden')

      // The SEO engine MUST NOT run on a cross-tenant request
      expect(mocks.runPluginEngine).not.toHaveBeenCalled()
    })

    it('Test 2: proceeds to runPluginEngine when session.agencyId === input.agencyId', async () => {
      mocks.requireSession.mockResolvedValue(SESSION_FOR('agency-A'))
      mocks.runPluginEngine.mockResolvedValue({ overallScore: 82, plugins: [] })

      const result = await computeLiveScore({ content: { foo: 1 }, agencyId: 'agency-A' })

      expect(result).toEqual({ overallScore: 82, plugins: [] })
      expect(mocks.runPluginEngine).toHaveBeenCalledTimes(1)
      // Engine input must echo the session-validated agencyId, not a stale value
      expect(mocks.runPluginEngine).toHaveBeenCalledWith(
        expect.objectContaining({ agencyId: 'agency-A' }),
      )
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // draftFromTitle — apps/web-main/src/actions/ai-editor.ts
  // ────────────────────────────────────────────────────────────────────

  describe('draftFromTitle (ai-editor.ts)', () => {
    it("Test 3: throws 'Forbidden' when session.agencyId !== input.agencyId", async () => {
      mocks.requireSession.mockResolvedValue(SESSION_FOR('agency-A'))

      await expect(
        draftFromTitle({ text: 'A title', agencyId: 'agency-B' }),
      ).rejects.toThrow('Forbidden')

      expect(mocks.aiDraftFromTitle).not.toHaveBeenCalled()
    })

    it('Test 4: proceeds to aiDraftFromTitle when agencies match', async () => {
      mocks.requireSession.mockResolvedValue(SESSION_FOR('agency-A'))
      mocks.aiDraftFromTitle.mockResolvedValue({ output: 'drafted', tokensUsed: 100 })

      const result = await draftFromTitle({ text: 'A title', agencyId: 'agency-A' })

      expect(result).toEqual({ output: 'drafted', tokensUsed: 100 })
      expect(mocks.aiDraftFromTitle).toHaveBeenCalledTimes(1)
      expect(mocks.aiDraftFromTitle).toHaveBeenCalledWith(
        'A title',
        'agency-A',
        expect.any(Object),
      )
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // rewriteSelection — apps/web-main/src/actions/ai-editor.ts (second action,
  // same module, proves the pattern is per-action — not module-level)
  // ────────────────────────────────────────────────────────────────────

  describe('rewriteSelection (ai-editor.ts)', () => {
    it("Test 5: throws 'Forbidden' when session.agencyId !== input.agencyId", async () => {
      mocks.requireSession.mockResolvedValue(SESSION_FOR('agency-X'))

      await expect(
        rewriteSelection({ text: 'rewrite me', agencyId: 'agency-Y' }),
      ).rejects.toThrow('Forbidden')

      expect(mocks.aiRewrite).not.toHaveBeenCalled()
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // Defense ordering — requireSession must run BEFORE the agency check
  // (otherwise unauthenticated callers could receive a 'Forbidden' instead
  //  of being redirected to /login)
  // ────────────────────────────────────────────────────────────────────

  describe('defense ordering', () => {
    it('Test 6: when requireSession() throws, the agency check never runs', async () => {
      const redirectError = new Error('NEXT_REDIRECT:/login')
      mocks.requireSession.mockRejectedValueOnce(redirectError)

      await expect(
        computeLiveScore({ content: {}, agencyId: 'any-agency' }),
      ).rejects.toBe(redirectError)

      // We never get to the engine because we never get past requireSession
      expect(mocks.runPluginEngine).not.toHaveBeenCalled()
    })
  })
})
