/**
 * packages/email/src/__tests__/sender.test.ts
 *
 * Unit tests for the SMTP sender (REQ-111, REQ-112).
 *
 * Every email leaves the platform through this function. Two contracts are
 * worth locking in:
 *
 *   1. The fields we pass to nodemailer's sendMail (to, from, subject, html,
 *      replyTo) match the EmailJobData wire format exactly. A regression
 *      that swaps `to` and `from` would deliver every email to the wrong
 *      address — undetectable until users complain.
 *
 *   2. The success log line records ONLY agencyId + subject. PII (email
 *      addresses, body content) MUST NEVER appear in logs (CLAUDE.md Rule 7
 *      "No secrets/PII in logs"). A regression that adds the recipient
 *      email to the log would be a CCPA violation by way of log retention.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EmailJobData } from '../sender.js'

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  sendMail:        vi.fn(),
  createTransport: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}))

vi.mock('@mjagency/config', () => ({
  createLogger: () => mocks.log,
}))

mocks.createTransport.mockImplementation(() => ({ sendMail: mocks.sendMail }))

const { sendEmail } = await import('../sender.js')

beforeEach(() => {
  mocks.sendMail.mockReset().mockResolvedValue({ messageId: 'mock-id' })
  mocks.createTransport.mockClear()
  mocks.createTransport.mockImplementation(() => ({ sendMail: mocks.sendMail }))
  mocks.log.info.mockReset()
  mocks.log.warn.mockReset()
})

const VALID_JOB = (overrides: Partial<EmailJobData> = {}): EmailJobData => ({
  to:       'recipient@example.com',
  from:     'noreply@mjagency.com',
  subject:  'Your Report',
  html:     '<p>hello</p>',
  agencyId: 'finance',
  ...overrides,
})

// ── Field round-trip into nodemailer ──────────────────────────────────────

describe('sendEmail — field round-trip', () => {
  it('Test 1: passes to / from / subject / html through to nodemailer.sendMail', async () => {
    await sendEmail(VALID_JOB({
      to:      'visitor@example.com',
      from:    'agency-finance@mjagency.com',
      subject: 'Your Q3 ROI report',
      html:    '<h1>Hi</h1>',
    }))

    expect(mocks.sendMail).toHaveBeenCalledTimes(1)
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to:      'visitor@example.com',
      from:    'agency-finance@mjagency.com',
      subject: 'Your Q3 ROI report',
      html:    '<h1>Hi</h1>',
    }))
  })

  it('Test 2: replyTo is forwarded when present', async () => {
    await sendEmail(VALID_JOB({ replyTo: 'support@mjagency.com' }))
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      replyTo: 'support@mjagency.com',
    }))
  })

  it('Test 3: replyTo is NOT injected when absent (undefined, not empty string)', async () => {
    await sendEmail(VALID_JOB())
    const call = mocks.sendMail.mock.calls[0]![0] as { replyTo?: string }
    expect(call.replyTo).toBeUndefined()
  })

  it('Test 4: agencyId is NOT forwarded to nodemailer (it is for logging only)', async () => {
    // agencyId is a platform concept; SMTP doesn't know about it. A regression
    // that put agencyId in the SMTP envelope could leak the agency id as a
    // header to the recipient.
    await sendEmail(VALID_JOB({ agencyId: 'finance' }))
    const call = mocks.sendMail.mock.calls[0]![0] as Record<string, unknown>
    expect(call.agencyId).toBeUndefined()
  })
})

// ── PII redaction in logs (CLAUDE.md Rule 7) ──────────────────────────────

describe('sendEmail — log redaction', () => {
  it('Test 5: success log records agencyId + subject ONLY (no PII)', async () => {
    await sendEmail(VALID_JOB({
      to:       'sensitive-email@gmail.com',
      from:     'noreply@mjagency.com',
      subject:  'Your invoice',
      html:     'a@b.com 555-1212 ssn 123-45-6789',
      agencyId: 'finance',
    }))

    expect(mocks.log.info).toHaveBeenCalledTimes(1)
    const [fields, message] = mocks.log.info.mock.calls[0]!
    expect(fields).toEqual({ agencyId: 'finance', subject: 'Your invoice' })
    expect(message).toMatch(/sent successfully/i)

    // Defensive: scan the entire log call args for PII keywords. None should
    // appear because this is a high-frequency log line and PII regressions
    // here flow into log retention systems.
    const serialised = JSON.stringify(mocks.log.info.mock.calls[0])
    expect(serialised).not.toContain('sensitive-email@gmail.com')
    expect(serialised).not.toContain('a@b.com')
    expect(serialised).not.toContain('555-1212')
    expect(serialised).not.toContain('123-45-6789')
  })

  it('Test 6: every send produces exactly one info log line (no duplicate emission)', async () => {
    await sendEmail(VALID_JOB())
    expect(mocks.log.info).toHaveBeenCalledTimes(1)
  })
})

// ── Error propagation ────────────────────────────────────────────────────

describe('sendEmail — error path', () => {
  it('Test 7: nodemailer throwing propagates so the BullMQ worker can retry', async () => {
    mocks.sendMail.mockRejectedValueOnce(new Error('SMTP 451 — temporary failure'))

    await expect(sendEmail(VALID_JOB())).rejects.toThrow('SMTP 451')

    // No success log when the send failed
    expect(mocks.log.info).not.toHaveBeenCalled()
  })
})
