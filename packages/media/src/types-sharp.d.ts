/**
 * Minimal type shim for sharp (pre-install).
 *
 * Allows TypeScript to compile @mjagency/media before `pnpm install` runs.
 * Once sharp is installed via pnpm, its own lib/index.d.ts takes precedence
 * (node_modules declarations override local declarations for the same module).
 *
 * IMPORTANT: this shim mirrors only the subset of the sharp API used in
 * color-extraction.ts. It is intentionally NOT exhaustive.
 */
declare module 'sharp' {
  interface OutputInfo {
    format: string
    size: number
    width: number
    height: number
    channels: 1 | 2 | 3 | 4
    premultiplied: boolean
  }

  interface ResizeOptions {
    width?: number
    height?: number
    fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'
    position?: string | number
    background?: string
    kernel?: string
    withoutEnlargement?: boolean
    withoutReduction?: boolean
    fastShrinkOnLoad?: boolean
  }

  interface Sharp {
    resize(width: number, height: number, options?: ResizeOptions): Sharp
    resize(options: ResizeOptions): Sharp
    raw(): Sharp
    toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: OutputInfo }>
    toBuffer(): Promise<Buffer>
  }

  type SharpInput = Buffer | string | ArrayBuffer

  function sharp(input?: SharpInput): Sharp
  function sharp(input: SharpInput, options?: Record<string, unknown>): Sharp
  export default sharp
  export { Sharp, OutputInfo, ResizeOptions }
}
