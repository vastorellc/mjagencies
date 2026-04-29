/**
 * packages/meta-capi/src/__tests__/per-agency-env.test.ts
 *
 * Unit tests for getAgencySecret + getAgencySecretOptional.
 *
 * These helpers normalize agency IDs (web-ecommerce → WEB_ECOMMERCE) and
 * look up `<KEY>_<NORMALIZED>` env vars. The convention is project-wide
 * (Plan 11-03 + Plan 11-01) so a regression that drifts the normalization
 * would silently route per-agency secrets to the wrong agency.
 *
 * Two safety properties we lock in:
 *   1. Required-secret missing → throws with the exact env-var name in the
 *      message. Fail-fast prevents silent CAPI misconfiguration.
 *   2. Optional-secret missing → returns undefined (callers branch on it).
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { getAgencySecret, getAgencySecretOptional } from '../per-agency-env.js'

const TOUCHED_KEYS: string[] = []

function setEnv(key: string, value: string): void {
  process.env[key] = value
  TOUCHED_KEYS.push(key)
}

afterEach(() => {
  for (const key of TOUCHED_KEYS) delete process.env[key]
  TOUCHED_KEYS.length = 0
})

describe('getAgencySecret', () => {
  it('Test 1: looks up <KEY>_<UPPER_AGENCY> in process.env', () => {
    setEnv('META_PIXEL_ID_FINANCE', 'pixel-123')
    expect(getAgencySecret('META_PIXEL_ID', 'finance')).toBe('pixel-123')
  })

  it('Test 2: hyphenated agency id normalizes to underscores (web-ecommerce → WEB_ECOMMERCE)', () => {
    setEnv('META_PIXEL_ID_WEB_ECOMMERCE', 'pixel-shop')
    expect(getAgencySecret('META_PIXEL_ID', 'web-ecommerce')).toBe('pixel-shop')
  })

  it('Test 3: agency id is normalized to UPPERCASE (input case ignored)', () => {
    setEnv('META_PIXEL_ID_FINANCE', 'pixel-finance')
    // Input lowercase
    expect(getAgencySecret('META_PIXEL_ID', 'finance')).toBe('pixel-finance')
    // Same env, input uppercase — both should hit the same key
    expect(getAgencySecret('META_PIXEL_ID', 'FINANCE')).toBe('pixel-finance')
  })

  it('Test 4: missing env var throws with the exact env-var name in the message', () => {
    expect(() => getAgencySecret('META_PIXEL_ID', 'never-set'))
      .toThrow(/META_PIXEL_ID_NEVER_SET/)
  })

  it('Test 5: empty-string env var is treated as missing (throws)', () => {
    setEnv('META_PIXEL_ID_FINANCE', '')
    expect(() => getAgencySecret('META_PIXEL_ID', 'finance')).toThrow()
  })

  it('Test 6: per-agency env vars do NOT leak across agencies', () => {
    setEnv('META_PIXEL_ID_FINANCE', 'finance-pixel')
    expect(getAgencySecret('META_PIXEL_ID', 'finance')).toBe('finance-pixel')
    // Different agency without env set must throw
    expect(() => getAgencySecret('META_PIXEL_ID', 'ecommerce')).toThrow()
  })
})

describe('getAgencySecretOptional', () => {
  it('Test 7: returns the value when env is set', () => {
    setEnv('META_TEST_EVENT_CODE_FINANCE', 'TEST123')
    expect(getAgencySecretOptional('META_TEST_EVENT_CODE', 'finance')).toBe('TEST123')
  })

  it('Test 8: returns undefined when env is absent (does NOT throw)', () => {
    expect(getAgencySecretOptional('META_TEST_EVENT_CODE', 'never-set')).toBeUndefined()
  })

  it('Test 9: hyphen normalization same as required helper', () => {
    setEnv('META_TEST_EVENT_CODE_WEB_ECOMMERCE', 'TEST456')
    expect(getAgencySecretOptional('META_TEST_EVENT_CODE', 'web-ecommerce')).toBe('TEST456')
  })

  it('Test 10: empty-string env value returned as empty string (NOT undefined)', () => {
    // The required helper throws on empty; the optional helper passes
    // through whatever the caller gets from process.env. This matters for
    // consumers that distinguish "set to empty" from "never set".
    setEnv('FOO_BAR_FINANCE', '')
    const value = getAgencySecretOptional('FOO_BAR', 'finance')
    expect(value).toBe('')
    expect(value).not.toBeUndefined()
  })
})
