/**
 * apps/web-main/src/__tests__/ai-editor.test.ts
 *
 * Tests for AI editor server actions (Plan 07-02 Task 2).
 * CLAUDE.md Rule 3 compliance: every action must begin with requireSession() + agencyId guard.
 *
 * Tests:
 *   A. Auth guard: session.agencyId !== input.agencyId → throws 'Forbidden'
 *   B. Auth gate: requireSession throws (no session) → propagates
 *   C. Success path: auth passes → editor-action called with correct args
 *   D. Three representative actions tested: rewriteSelection, suggestStat, brandVoiceRewrite
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @mjagency/auth BEFORE importing actions
vi.mock('@mjagency/auth', () => ({
  requireSession: vi.fn(),
}))

// Mock @mjagency/ai BEFORE importing actions
vi.mock('@mjagency/ai', () => ({
  aiRewrite: vi.fn(),
  aiShorten: vi.fn(),
  aiExpand: vi.fn(),
  aiDraftFromTitle: vi.fn(),
  aiSimplify: vi.fn(),
  aiFixGrammar: vi.fn(),
  aiToneFormal: vi.fn(),
  aiToneConversational: vi.fn(),
  aiTonePersuasive: vi.fn(),
  aiSummarizeParagraph: vi.fn(),
  aiMetaDescription: vi.fn(),
  aiSuggestH2: vi.fn(),
  aiWriteFaqAnswer: vi.fn(),
  aiGenerateCta: vi.fn(),
  aiTranslateSpanish: vi.fn(),
  aiAddTransition: vi.fn(),
  aiBulletExtract: vi.fn(),
  aiCounterArgument: vi.fn(),
  aiSuggestStat: vi.fn(),
  aiBrandVoiceRewrite: vi.fn(),
}))

import {
  rewriteSelection,
  suggestStat,
  brandVoiceRewrite,
  draftFromTitle,
  shortenSelection,
  expandSelection,
  simplifySelection,
  fixGrammar,
  toneFormal,
  toneConversational,
  tonePersuasive,
  summarizeParagraph,
  generateMetaDescription,
  suggestH2Headings,
  writeFaqAnswer,
  generateCta,
  translateSpanish,
  addTransition,
  bulletExtract,
  counterArgument,
} from '../actions/ai-editor.js'
import * as authModule from '@mjagency/auth'
import * as aiModule from '@mjagency/ai'

const mockRequireSession = vi.mocked(authModule.requireSession)
const mockAiRewrite = vi.mocked(aiModule.aiRewrite)
const mockAiSuggestStat = vi.mocked(aiModule.aiSuggestStat)
const mockAiBrandVoiceRewrite = vi.mocked(aiModule.aiBrandVoiceRewrite)

const AGENCY_ID = 'test-agency-123'
// Full VerifiedAccessPayload shape required by requireSession return type
const MOCK_SESSION = {
  agencyId: AGENCY_ID,
  sub: 'user-1',
  role: 'editor' as const,
  jti: 'jti-test-1',
  familyId: 'family-test-1',
}

const MOCK_AI_RESULT = {
  success: true,
  text: 'AI generated text',
  model: 'gemini-2.5-flash-lite',
}

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockRequireSession.mockResolvedValue(MOCK_SESSION as any)
  mockAiRewrite.mockResolvedValue(MOCK_AI_RESULT)
  mockAiSuggestStat.mockResolvedValue(MOCK_AI_RESULT)
  mockAiBrandVoiceRewrite.mockResolvedValue(MOCK_AI_RESULT)
})

// ---------------------------------------------------------------------------
// A. Agency ID guard — throws 'Forbidden' when IDs mismatch
// ---------------------------------------------------------------------------
describe('agency ID guard', () => {
  it('rewriteSelection throws Forbidden when session.agencyId !== input.agencyId', async () => {
    mockRequireSession.mockResolvedValue({ ...MOCK_SESSION, agencyId: 'other-agency' } as any)
    await expect(
      rewriteSelection({ text: 'hello', agencyId: AGENCY_ID }),
    ).rejects.toThrow('Forbidden')
  })

  it('suggestStat throws Forbidden when session.agencyId !== input.agencyId', async () => {
    mockRequireSession.mockResolvedValue({ ...MOCK_SESSION, agencyId: 'other-agency' } as any)
    await expect(
      suggestStat({ text: 'hello', agencyId: AGENCY_ID }),
    ).rejects.toThrow('Forbidden')
  })

  it('brandVoiceRewrite throws Forbidden when session.agencyId !== input.agencyId', async () => {
    mockRequireSession.mockResolvedValue({ ...MOCK_SESSION, agencyId: 'other-agency' } as any)
    await expect(
      brandVoiceRewrite({ text: 'hello', agencyId: AGENCY_ID }),
    ).rejects.toThrow('Forbidden')
  })
})

// ---------------------------------------------------------------------------
// B. Auth gate — requireSession throws → propagates
// ---------------------------------------------------------------------------
describe('auth gate propagation', () => {
  it('rewriteSelection propagates when requireSession throws', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(
      rewriteSelection({ text: 'hello', agencyId: AGENCY_ID }),
    ).rejects.toThrow('Unauthorized')
  })

  it('suggestStat propagates when requireSession throws', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(
      suggestStat({ text: 'hello', agencyId: AGENCY_ID }),
    ).rejects.toThrow('Unauthorized')
  })

  it('brandVoiceRewrite propagates when requireSession throws', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(
      brandVoiceRewrite({ text: 'hello', agencyId: AGENCY_ID }),
    ).rejects.toThrow('Unauthorized')
  })
})

// ---------------------------------------------------------------------------
// C. Success path — auth passes → editor-action called with correct args
// ---------------------------------------------------------------------------
describe('success path', () => {
  it('rewriteSelection calls aiRewrite with correct agencyId and text', async () => {
    const input = { text: 'The quick brown fox', agencyId: AGENCY_ID, agencySlug: 'my-agency' }
    const result = await rewriteSelection(input)
    expect(mockAiRewrite).toHaveBeenCalledOnce()
    expect(mockAiRewrite).toHaveBeenCalledWith(
      input.text,
      AGENCY_ID,
      expect.objectContaining({ agencySlug: 'my-agency' }),
    )
    expect(result).toEqual(MOCK_AI_RESULT)
  })

  it('suggestStat calls aiSuggestStat once when auth passes', async () => {
    const input = { text: 'We help businesses grow', agencyId: AGENCY_ID }
    await suggestStat(input)
    expect(mockAiSuggestStat).toHaveBeenCalledOnce()
    expect(mockAiSuggestStat).toHaveBeenCalledWith(
      input.text,
      AGENCY_ID,
      expect.any(Object),
    )
  })

  it('brandVoiceRewrite passes brandVoiceContext to aiBrandVoiceRewrite', async () => {
    const brandCtx = 'Tone: confident. Terms: DrivePath.'
    const input = { text: 'Rewrite this', agencyId: AGENCY_ID, brandVoiceContext: brandCtx }
    await brandVoiceRewrite(input)
    expect(mockAiBrandVoiceRewrite).toHaveBeenCalledWith(
      input.text,
      AGENCY_ID,
      expect.objectContaining({ brandVoiceContext: brandCtx }),
    )
  })
})

// ---------------------------------------------------------------------------
// D. All 20 server actions are importable and callable
// ---------------------------------------------------------------------------
describe('all 20 server actions are importable', () => {
  const allActions = [
    { name: 'draftFromTitle', fn: draftFromTitle },
    { name: 'rewriteSelection', fn: rewriteSelection },
    { name: 'shortenSelection', fn: shortenSelection },
    { name: 'expandSelection', fn: expandSelection },
    { name: 'simplifySelection', fn: simplifySelection },
    { name: 'fixGrammar', fn: fixGrammar },
    { name: 'toneFormal', fn: toneFormal },
    { name: 'toneConversational', fn: toneConversational },
    { name: 'tonePersuasive', fn: tonePersuasive },
    { name: 'summarizeParagraph', fn: summarizeParagraph },
    { name: 'generateMetaDescription', fn: generateMetaDescription },
    { name: 'suggestH2Headings', fn: suggestH2Headings },
    { name: 'writeFaqAnswer', fn: writeFaqAnswer },
    { name: 'generateCta', fn: generateCta },
    { name: 'translateSpanish', fn: translateSpanish },
    { name: 'addTransition', fn: addTransition },
    { name: 'bulletExtract', fn: bulletExtract },
    { name: 'counterArgument', fn: counterArgument },
    { name: 'suggestStat', fn: suggestStat },
    { name: 'brandVoiceRewrite', fn: brandVoiceRewrite },
  ]

  for (const { name, fn } of allActions) {
    it(`${name} is a function`, () => {
      expect(typeof fn).toBe('function')
    })
  }
})
