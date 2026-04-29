export type {
  ImagesUploadResult,
  ImagesClient,
  StreamClient,
  R2Client,
  BlurHashResult,
} from './types'

export { createImagesClient } from './cloudflare-images'
export { createStreamClient } from './cloudflare-stream'
export { createR2Client } from './r2'
export { computeBlurHash, decodeBlurHash } from './blurhash'
export { agencyAssetCacheTag } from './cache-tags'

// Plan 05-05: color extraction + BlurHash from raw buffer (DAM upload pipeline)
export { extractDominantColor, computeBlurHashFromBuffer } from './color-extraction.js'
export type { ColorExtractionResult } from './color-extraction.js'

// Backlog 999.1: canonical image component for all agency app templates
export { MjImage } from './picture.js'
export type { MjImageProps } from './picture.js'
