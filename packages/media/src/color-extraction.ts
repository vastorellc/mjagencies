/**
 * packages/media/src/color-extraction.ts
 *
 * Extracts dominant color and top-3 color swatches from image buffer (specs/media.md).
 * Uses color-thief-node (LAB delta-E color matching in Phase 12 QA).
 *
 * Also provides computeBlurHashFromBuffer() — async function that decodes image pixels
 * using sharp then encodes with computeBlurHash() from blurhash.ts.
 *
 * Called in packages/cms media_assets afterOperation hook at upload time.
 * Both heavy deps (color-thief-node, sharp) are lazily imported to avoid
 * startup cost in paths that don't need them.
 *
 * Type declarations:
 *   - color-thief-node: src/types-color-thief-node.d.ts (no @types package available)
 *   - sharp: src/types-sharp.d.ts (shim until `pnpm install`; real types override after install)
 */
import { computeBlurHash } from './blurhash.js'

export interface ColorExtractionResult {
  /** Dominant color as hex string e.g. "#1a2b3c" */
  dominantColor: string
  /** Top-3 swatches as hex string array e.g. ["#1a2b3c", "#4d5e6f", "#789abc"] */
  swatches: string[]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Extracts dominant color and top-3 swatches from an image buffer.
 * Returns hex strings for storage in media_assets.dominant_color and media_assets.swatches.
 *
 * @param buffer - Raw image buffer (JPEG, PNG, WebP, AVIF)
 * @returns ColorExtractionResult with dominant_color hex and swatches array
 */
export async function extractDominantColor(buffer: Buffer): Promise<ColorExtractionResult> {
  try {
    // color-thief-node is a CJS module; use await import() at call-time.
    // The module declaration in types-color-thief-node.d.ts provides static types.
    const { default: ColorThief } = await import('color-thief-node')
    const dominant = ColorThief.getColor(buffer, 10)
    const palette = ColorThief.getPalette(buffer, 3, 10)
    return {
      dominantColor: rgbToHex(dominant),
      swatches: palette.map(rgbToHex),
    }
  } catch (err) {
    console.error('[media] color extraction failed:', err)
    // Return safe fallbacks — do not block upload
    return { dominantColor: '#808080', swatches: ['#808080', '#a0a0a0', '#c0c0c0'] }
  }
}

/**
 * Computes a BlurHash string from a raw image buffer.
 * Uses sharp for image decoding + computeBlurHash for hash encoding.
 * Returns the hash string (e.g. "LKO2?U%2Tw=w]~RBVZRi");
 * returns undefined if decoding fails — never throws.
 *
 * @param buffer - Raw image buffer (JPEG, PNG, WebP, AVIF)
 * @returns BlurHash string or undefined on failure
 */
export async function computeBlurHashFromBuffer(buffer: Buffer): Promise<string | undefined> {
  try {
    // Dynamic import of sharp — avoids module-load cost and works once
    // sharp is installed as a workspace dependency via `pnpm install`.
    // Type shim: src/types-sharp.d.ts (replaced by real sharp types after install).
    const { default: sharpFn } = await import('sharp')

    const { data, info } = await sharpFn(buffer)
      .resize(32, 32, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
    const result = computeBlurHash({
      pixels,
      width: info.width,
      height: info.height,
      componentX: 4,
      componentY: 3,
    })
    return result.hash
  } catch (err) {
    console.error('[media] BlurHash computation failed:', err)
    return undefined
  }
}
