// backend/src/lib/upload-youtube.ts
// YouTube upload worker — implemented in Plan 06-02
import type { UploadJobPayload } from './upload-worker.js'

export async function uploadYouTube(data: UploadJobPayload): Promise<void> {
  throw new Error(`uploadYouTube: not yet implemented (Plan 06-02). jobId=${data.postId}`)
}
