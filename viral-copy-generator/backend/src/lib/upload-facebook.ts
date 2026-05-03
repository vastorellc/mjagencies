// backend/src/lib/upload-facebook.ts
// Facebook upload worker — implemented in Plan 06-02
import type { UploadJobPayload } from './upload-worker.js'

export async function uploadFacebook(data: UploadJobPayload): Promise<void> {
  throw new Error(`uploadFacebook: not yet implemented (Plan 06-02). jobId=${data.postId}`)
}
