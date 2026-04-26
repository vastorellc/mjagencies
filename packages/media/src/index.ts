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
export { computeBlurHash } from './blurhash'
export { agencyAssetCacheTag } from './cache-tags'

// Plan 05-05: color extraction + BlurHash from raw buffer (DAM upload pipeline)
export { extractDominantColor, computeBlurHashFromBuffer } from './color-extraction.js'
export type { ColorExtractionResult } from './color-extraction.js'
