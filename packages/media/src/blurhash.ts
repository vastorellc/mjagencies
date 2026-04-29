import { encode, decode } from 'blurhash'
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

/**
 * Decodes a BlurHash to a data URL for use as a Next.js Image `blurDataURL`.
 *
 * Uses BMP format because it works in both Node (SSR) and the browser
 * without any native canvas dependency. BMP files for a 32×32 image are
 * ~4KB which keeps the data URL small enough for inline use.
 *
 * Imported by `picture.tsx` MjImage. A regression here breaks the
 * blur-up placeholder for every image rendered through that component.
 */
export function decodeBlurHash(hash: string, width: number, height: number): string {
  const pixels = decode(hash, width, height)
  return `data:image/bmp;base64,${rgbaToBmpBase64(pixels, width, height)}`
}

/**
 * Encode RGBA pixel data as a 32-bit BMP, base64-encoded.
 *
 * BMP format (BITMAPINFOHEADER, 32-bit BGRA):
 *   - 14-byte file header  (BMP signature + file size + pixel data offset)
 *   - 40-byte info header  (width / height / bit depth / etc.)
 *   - 32-bit pixel data, BOTTOM-UP, BGRA byte order, no row padding
 *     (rows are already 4-byte aligned at 32bpp)
 */
function rgbaToBmpBase64(rgba: Uint8ClampedArray, width: number, height: number): string {
  const pixelDataSize = width * height * 4
  const fileSize = 14 + 40 + pixelDataSize
  const buffer = Buffer.alloc(fileSize)

  // ── File header (14 bytes) ─────────────────────────────────────────
  buffer.write('BM', 0, 'ascii')        // signature
  buffer.writeUInt32LE(fileSize, 2)     // file size
  buffer.writeUInt32LE(0, 6)            // reserved
  buffer.writeUInt32LE(54, 10)          // pixel data offset (14 + 40)

  // ── BITMAPINFOHEADER (40 bytes) ────────────────────────────────────
  buffer.writeUInt32LE(40, 14)          // header size
  buffer.writeInt32LE(width, 18)        // width
  buffer.writeInt32LE(-height, 22)      // negative height = top-down rows
  buffer.writeUInt16LE(1, 26)           // planes
  buffer.writeUInt16LE(32, 28)          // bits per pixel
  buffer.writeUInt32LE(0, 30)           // compression (BI_RGB)
  buffer.writeUInt32LE(pixelDataSize, 34) // image size
  buffer.writeInt32LE(0, 38)            // x pixels per meter
  buffer.writeInt32LE(0, 42)            // y pixels per meter
  buffer.writeUInt32LE(0, 46)           // colors used
  buffer.writeUInt32LE(0, 50)           // important colors

  // ── Pixel data (BGRA, top-down because of negative height) ─────────
  for (let i = 0; i < width * height; i++) {
    const dst = 54 + i * 4
    const src = i * 4
    buffer[dst]     = rgba[src + 2]!  // B
    buffer[dst + 1] = rgba[src + 1]!  // G
    buffer[dst + 2] = rgba[src]!      // R
    buffer[dst + 3] = rgba[src + 3]!  // A
  }

  return buffer.toString('base64')
}
