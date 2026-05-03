// backend/src/lib/upload-instagram.ts
// Instagram upload worker — implemented in Plan 06-02
import type { UploadJobPayload } from './upload-worker.js'

export async function uploadInstagram(data: UploadJobPayload): Promise<void> {
  throw new Error(`uploadInstagram: not yet implemented (Plan 06-02). jobId=${data.postId}`)
}
