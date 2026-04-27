/**
 * packages/ai/src/__tests__/pii-redactor.test.ts
 *
 * Vitest unit tests for pii-redactor.ts (TDD RED — Plan 07-05 Task 1).
 * Tests cover:
 *   A. Email replacement (single, multiple, duplicate collapse)
 *   B. Phone replacement (US formats)
 *   C. SSN replacement
 *   D. Credit card replacement (16-digit groups with separators)
 *   E. IP address replacement
 *   F. Mixed PII in single string
 *   G. No PII present
 *   H. restoreFromTokens (opt-in re-identification)
 *   I. PII_PATTERNS export
 *   J. Order independence (no pattern collision)
 */
import { describe, it, expect } from 'vitest'
import { redactPii, restoreFromTokens, PII_PATTERNS } from '../pii-redactor.js'

// ---------------------------------------------------------------------------
// A. Email replacement
// ---------------------------------------------------------------------------
describe('redactPii — email replacement', () => {
  it('replaces a single email with [EMAIL_1]', () => {
    const { redacted } = redactPii('Contact me at john@example.com')
    expect(redacted).toBe('Contact me at [EMAIL_1]')
  })

  it('assigns distinct tokens for two different emails', () => {
    const { redacted } = redactPii('alice@a.io and bob@b.io chat')
    expect(redacted).toBe('[EMAIL_1] and [EMAIL_2] chat')
  })

  it('collapses duplicate email occurrences to the same token', () => {
    const { redacted } = redactPii('Email john@example.com twice: john@example.com')
    expect(redacted).toBe('Email [EMAIL_1] twice: [EMAIL_1]')
  })

  it('stores token → original in replacements Map', () => {
    const { replacements } = redactPii('Reach john@example.com anytime')
    expect(replacements.get('EMAIL_1')).toBe('john@example.com')
  })
})

// ---------------------------------------------------------------------------
// B. Phone replacement (US)
// ---------------------------------------------------------------------------
describe('redactPii — phone replacement', () => {
  it('replaces formatted phone (555) 123-4567', () => {
    const { redacted } = redactPii('Call (555) 123-4567')
    expect(redacted).toBe('Call [PHONE_1]')
  })

  it('replaces dashed phone 555-123-4567', () => {
    const { redacted } = redactPii('Call 555-123-4567')
    expect(redacted).toBe('Call [PHONE_1]')
  })

  it('replaces international phone +1 555.123.4567', () => {
    const { redacted } = redactPii('Call +1 555.123.4567')
    expect(redacted).toBe('Call [PHONE_1]')
  })

  it('replaces bare 10-digit phone 5551234567', () => {
    const { redacted } = redactPii('Call 5551234567')
    expect(redacted).toBe('Call [PHONE_1]')
  })
})

// ---------------------------------------------------------------------------
// C. SSN replacement
// ---------------------------------------------------------------------------
describe('redactPii — SSN replacement', () => {
  it('replaces SSN: 123-45-6789', () => {
    const { redacted } = redactPii('SSN: 123-45-6789')
    expect(redacted).toBe('SSN: [SSN_1]')
  })

  it('replaces SSN in mid-sentence: ID 999-99-9999 here', () => {
    const { redacted } = redactPii('ID 999-99-9999 here')
    expect(redacted).toBe('ID [SSN_1] here')
  })
})

// ---------------------------------------------------------------------------
// D. Credit card replacement
// ---------------------------------------------------------------------------
describe('redactPii — credit card replacement', () => {
  it('replaces 16-digit card with dashes: 4111-1111-1111-1111', () => {
    const { redacted } = redactPii('Card: 4111-1111-1111-1111')
    expect(redacted).toBe('Card: [CARD_1]')
  })

  it('replaces 16-digit card with spaces: 4111 1111 1111 1111', () => {
    const { redacted } = redactPii('CC 4111 1111 1111 1111')
    expect(redacted).toBe('CC [CARD_1]')
  })

  it('replaces compact 16-digit card: 4111111111111111', () => {
    const { redacted } = redactPii('CC 4111111111111111')
    expect(redacted).toBe('CC [CARD_1]')
  })
})

// ---------------------------------------------------------------------------
// E. IP address replacement
// ---------------------------------------------------------------------------
describe('redactPii — IP address replacement', () => {
  it('replaces private IP 192.168.1.1', () => {
    const { redacted } = redactPii('Server at 192.168.1.1')
    expect(redacted).toBe('Server at [IP_1]')
  })

  it('replaces public IP 8.8.8.8', () => {
    const { redacted } = redactPii('Visit 8.8.8.8 daily')
    expect(redacted).toBe('Visit [IP_1] daily')
  })
})

// ---------------------------------------------------------------------------
// F. Mixed PII in single string
// ---------------------------------------------------------------------------
describe('redactPii — mixed PII', () => {
  it('redacts email, phone, and IP in one string', () => {
    const { redacted, replacements } = redactPii(
      'Email: a@b.com, Phone: 555-555-5555, IP: 1.2.3.4',
    )
    expect(redacted).toBe('Email: [EMAIL_1], Phone: [PHONE_1], IP: [IP_1]')
    expect(replacements.size).toBe(3)
  })

  it('replacements Map contains the correct originals for each PII type', () => {
    const { replacements } = redactPii('Email: a@b.com, Phone: 555-555-5555, IP: 1.2.3.4')
    expect(replacements.get('EMAIL_1')).toBe('a@b.com')
    expect(replacements.get('PHONE_1')).toBe('555-555-5555')
    expect(replacements.get('IP_1')).toBe('1.2.3.4')
  })
})

// ---------------------------------------------------------------------------
// G. No PII present
// ---------------------------------------------------------------------------
describe('redactPii — no PII present', () => {
  it('returns unchanged text when no PII found', () => {
    const { redacted } = redactPii('Just clean text here')
    expect(redacted).toBe('Just clean text here')
  })

  it('returns empty replacements Map when no PII found', () => {
    const { replacements } = redactPii('Just clean text here')
    expect(replacements.size).toBe(0)
  })

  it('handles empty string gracefully', () => {
    const { redacted, replacements } = redactPii('')
    expect(redacted).toBe('')
    expect(replacements.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// H. restoreFromTokens (opt-in re-identification)
// ---------------------------------------------------------------------------
describe('restoreFromTokens', () => {
  it('restores [EMAIL_1] to original value', () => {
    const result = restoreFromTokens('[EMAIL_1] said hi', new Map([['EMAIL_1', 'a@b.com']]))
    expect(result).toBe('a@b.com said hi')
  })

  it('returns input unchanged when replacements Map is empty', () => {
    const result = restoreFromTokens('Hello world', new Map())
    expect(result).toBe('Hello world')
  })

  it('restores multiple tokens in one call', () => {
    const result = restoreFromTokens(
      'From [EMAIL_1] to [EMAIL_2]',
      new Map([
        ['EMAIL_1', 'alice@example.com'],
        ['EMAIL_2', 'bob@example.com'],
      ]),
    )
    expect(result).toBe('From alice@example.com to bob@example.com')
  })
})

// ---------------------------------------------------------------------------
// I. PII_PATTERNS export
// ---------------------------------------------------------------------------
describe('PII_PATTERNS', () => {
  it('exports an object with EMAIL, PHONE, SSN, CARD, IP keys', () => {
    expect(PII_PATTERNS).toHaveProperty('EMAIL')
    expect(PII_PATTERNS).toHaveProperty('PHONE')
    expect(PII_PATTERNS).toHaveProperty('SSN')
    expect(PII_PATTERNS).toHaveProperty('CARD')
    expect(PII_PATTERNS).toHaveProperty('IP')
  })

  it('all pattern values are RegExp instances', () => {
    for (const key of ['EMAIL', 'PHONE', 'SSN', 'CARD', 'IP'] as const) {
      expect(PII_PATTERNS[key]).toBeInstanceOf(RegExp)
    }
  })
})

// ---------------------------------------------------------------------------
// J. Order independence (no collision between patterns)
// ---------------------------------------------------------------------------
describe('redactPii — pattern order independence', () => {
  it('treats compact credit card number as CARD, not IP or phone', () => {
    const { redacted } = redactPii('CC 4111111111111111')
    // Must produce CARD_1, not IP_1 or PHONE_1
    expect(redacted).toContain('[CARD_1]')
    expect(redacted).not.toContain('[IP_1]')
    expect(redacted).not.toContain('[PHONE_1]')
  })

  it('handles email and SSN in same string without collision', () => {
    const { redacted } = redactPii('User: admin@corp.io SSN: 111-22-3333')
    expect(redacted).toBe('User: [EMAIL_1] SSN: [SSN_1]')
  })
})
