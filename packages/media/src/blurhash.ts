import { encode } from 'blurhash'
import type { BlurHashResult } from './types'

/**
 * Computes a BlurHash from RGBA pixel data.
 * Caller is responsible for image decoding (sharp/canvas) — kept out of
 * this package to avoid pulling heavy native deps into every consumer.
 */
export function computeBlurHash(opts: {
  pixels: Uint8ClampedArray
  width: number
  height: number
  componentX?: number
  componentY?: number
}): BlurHashResult {
  const cx = opts.componentX ?? 4
  const cy = opts.componentY ?? 3
  const hash = encode(opts.pixels, opts.width, opts.height, cx, cy)
  return { hash, width: opts.width, height: opts.height, componentX: cx, componentY: cy }
}
