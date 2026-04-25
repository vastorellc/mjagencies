import { describe, it, expect } from 'vitest'
import { createR2Client } from '../r2'

describe('createR2Client', () => {
  const validEnv = {
    R2_ACCOUNT_ID: 'test-account',
    R2_ACCESS_KEY: 'test-access',
    R2_SECRET_KEY: 'test-secret',
    R2_BUCKET: 'test-bucket',
  }

  it('throws if R2_ACCESS_KEY is missing', () => {
    expect(() =>
      createR2Client({ ...validEnv, R2_ACCESS_KEY: '' }),
    ).toThrow()
  })

  it('throws if R2_SECRET_KEY is missing', () => {
    expect(() =>
      createR2Client({ ...validEnv, R2_SECRET_KEY: '' }),
    ).toThrow()
  })

  it('throws if R2_BUCKET is missing', () => {
    expect(() =>
      createR2Client({ ...validEnv, R2_BUCKET: '' }),
    ).toThrow()
  })

  it('throws if R2_ACCOUNT_ID is missing', () => {
    expect(() =>
      createR2Client({ ...validEnv, R2_ACCOUNT_ID: '' }),
    ).toThrow()
  })

  it('returns an object with putObject, getObject, signedUrl methods', () => {
    const client = createR2Client(validEnv)
    expect(typeof client.putObject).toBe('function')
    expect(typeof client.getObject).toBe('function')
    expect(typeof client.signedUrl).toBe('function')
  })
})
