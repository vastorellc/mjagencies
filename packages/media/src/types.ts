export interface ImagesUploadResult {
  id: string
  filename: string
  variants: string[]   // delivery URLs per variant
  uploaded: string     // ISO timestamp
}

export interface ImagesClient {
  /** Generates a one-time direct-upload URL. Server-side only — never call from a browser context. */
  createUploadUrl(opts: {
    agencyId: string
    metadata?: Record<string, string>
    requireSignedURLs?: boolean
  }): Promise<{ url: string; id: string }>
  /** Returns the delivery URL for a stored image variant (e.g. 'public', 'avif', 'thumbnail'). */
  deliveryUrl(imageId: string, variant: string): string
}

export interface StreamClient {
  createUploadUrl(opts: { agencyId: string; maxDurationSeconds?: number }): Promise<{ url: string; id: string }>
  embedUrl(videoId: string): string
}

export interface R2Client {
  putObject(opts: { key: string; body: Uint8Array | Buffer | string; contentType?: string }): Promise<void>
  getObject(opts: { key: string }): Promise<{ body: ReadableStream; contentType?: string }>
  signedUrl(opts: { key: string; expiresInSeconds: number }): Promise<string>
}

export interface BlurHashResult {
  hash: string
  width: number
  height: number
  componentX: number
  componentY: number
}
