/**
 * Minimal type declaration for color-thief-node (no @types package available).
 * color-thief-node@2.x extracts dominant colors from image Buffers.
 *
 * Usage: await import('color-thief-node') returns { default: ColorThief }
 */
declare module 'color-thief-node' {
  interface ColorThiefAPI {
    /** Returns the dominant color as [r, g, b] */
    getColor(buffer: Buffer, quality?: number): [number, number, number]
    /** Returns an array of dominant colors as [[r,g,b], ...] */
    getPalette(buffer: Buffer, colorCount?: number, quality?: number): [number, number, number][]
  }

  const colorThief: ColorThiefAPI
  export default colorThief
}
