// backend/src/lib/upload-tiktok.ts
// TikTok upload worker — implemented in Plan 06-02 (gated by TIKTOK_APPROVED flag, AUTOUP-04)
import type { UploadJobPayload } from './upload-worker.js'

export async function uploadTikTok(data: UploadJobPayload): Promise<void> {
  throw new Error(`uploadTikTok: not yet implemented (Plan 06-02). jobId=${data.postId}`)
}
