import { describe, it, expect } from 'vitest'
import { decodeBlurHash } from '../blurhash.js'

describe('decodeBlurHash', () => {
  it('returns a data URL string', () => {
    // Valid BlurHash from blurhash.io
    const hash = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH'
    const result = decodeBlurHash(hash, 32, 32)
    expect(result).toMatch(/^data:image\/(bmp|png|jpeg);base64,/)
  })

  it('returns a non-empty base64 payload', () => {
    const hash = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH'
    const result = decodeBlurHash(hash, 32, 32)
    const base64Part = result.split(',')[1]
    expect(base64Part).toBeTruthy()
    expect(base64Part!.length).toBeGreaterThan(100)
  })
})
