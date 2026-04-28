import { describe, it, expect, beforeEach } from 'vitest'
import { getAgencySecret, getAgencySecretOptional, normalizeSlug } from '../per-agency-env.js'

describe('per-agency-env', () => {
  beforeEach(() => {
    delete process.env['META_ACCESS_TOKEN_WEB_ECOMMERCE']
    delete process.env['GA4_API_SECRET_WEB_HEALTHCARE']
    delete process.env['GA4_API_SECRET_WEB_ECOMMERCE']
  })

  it('normalizeSlug replaces hyphens with underscores and uppercases', () => {
    expect(normalizeSlug('web-ecommerce')).toBe('WEB_ECOMMERCE')
    expect(normalizeSlug('web-home-services')).toBe('WEB_HOME_SERVICES')
    expect(normalizeSlug('webmain')).toBe('WEBMAIN')
  })

  it('getAgencySecret reads correct env var', () => {
    process.env['META_ACCESS_TOKEN_WEB_ECOMMERCE'] = 'abc123'
    expect(getAgencySecret('META_ACCESS_TOKEN', 'web-ecommerce')).toBe('abc123')
  })

  it('getAgencySecret throws when env var missing', () => {
    expect(() => getAgencySecret('GA4_API_SECRET', 'web-healthcare'))
      .toThrow(/Missing env var: GA4_API_SECRET_WEB_HEALTHCARE/)
  })

  it('getAgencySecretOptional returns undefined when env var missing', () => {
    expect(getAgencySecretOptional('GA4_API_SECRET', 'web-healthcare')).toBeUndefined()
  })

  it('getAgencySecretOptional returns value when env var set', () => {
    process.env['GA4_API_SECRET_WEB_ECOMMERCE'] = 'secret-value'
    expect(getAgencySecretOptional('GA4_API_SECRET', 'web-ecommerce')).toBe('secret-value')
  })
})
