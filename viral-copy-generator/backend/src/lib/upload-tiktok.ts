// backend/src/lib/upload-tiktok.ts
// AUTOUP-04: TikTok upload stub — gated by isTikTokApproved flag in upload-worker.ts.
// This function is only called if TIKTOK_APPROVED=true env flag is set.
// When TikTok API access is approved, implement this function with the
// TikTok Content Posting API v2.
import type { UploadJobPayload } from './upload-worker.js'

export async function uploadTikTok(_payload: UploadJobPayload): Promise<void> {
  // TikTok API access requires platform approval.
  // The worker in upload-worker.ts gates calls behind TIKTOK_APPROVED=true.
  // When approved: implement using TikTok Content Posting API v2 (direct_post endpoint).
  throw new Error('tiktok_not_approved: set TIKTOK_APPROVED=true and implement uploadTikTok()')
}
