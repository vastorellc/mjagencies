// backend/src/lib/upload-facebook.ts
// AUTOUP-03: Facebook Reels upload using page_access_token + page_id from settings.
// Three-phase upload: start → binary POST → finish (PUBLISHED).
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings, platform_posts } from '../db/schema.js'
import { decrypt } from './encryption.js'
import { deleteFile } from './storage.js'
import { updateUploadStatus, type UploadJobPayload } from './upload-worker.js'

const FB_GRAPH = 'https://graph.facebook.com/v22.0'

export async function uploadFacebook(payload: UploadJobPayload): Promise<void> {
  const { userId, platformPostId, filePath, caption } = payload

  try {
    await updateUploadStatus(platformPostId, 'uploading')

    // 1. Load Facebook page token from settings
    const settingsRows = await db
      .select({ platform_config: settings.platform_config })
      .from(settings)
      .where(eq(settings.user_id, userId))
      .limit(1)

    const fbConfig = settingsRows[0]?.platform_config?.facebook
    if (!fbConfig) {
      throw new Error('facebook_not_connected')
    }
    // AUTOUP-03: check setup_required before any API call
    if ('setup_required' in fbConfig && fbConfig.setup_required) {
      throw new Error('facebook_no_page: user must create a Facebook Page before uploading')
    }
    // fbConfig is { access_token, page_id, expiry }
    const fbFull = fbConfig as { access_token: string; page_id: string; expiry: number }
    const pageToken = decrypt(fbFull.access_token)
    const pageId = fbFull.page_id

    // 2. Get file size for upload header
    const fileStat = await stat(filePath)
    const fileSize = fileStat.size

    // Phase 1: Start upload session
    const startRes = await fetch(`${FB_GRAPH}/${pageId}/video_reels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_phase: 'start', access_token: pageToken }),
    })
    if (!startRes.ok) {
      throw new Error(`facebook start upload failed ${startRes.status}: ${await startRes.text()}`)
    }
    const startJson = await startRes.json() as { video_id?: string; upload_url?: string }
    if (!startJson.video_id || !startJson.upload_url) {
      throw new Error('facebook start upload: missing video_id or upload_url')
    }
    const { video_id: videoId, upload_url: uploadUrl } = startJson

    // Phase 2: Binary upload to upload_url using createReadStream (resumable)
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${pageToken}`,
        offset: '0',
        file_size: String(fileSize),
      },
      body: createReadStream(filePath),
      duplex: 'half',
    })
    if (!uploadRes.ok) {
      throw new Error(`facebook binary upload failed ${uploadRes.status}: ${await uploadRes.text()}`)
    }

    // Phase 3: Finish + publish
    const finishRes = await fetch(`${FB_GRAPH}/${pageId}/video_reels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: videoId,
        video_state: 'PUBLISHED',
        description: caption,
        access_token: pageToken,
      }),
    })
    if (!finishRes.ok) {
      throw new Error(`facebook finish upload failed ${finishRes.status}: ${await finishRes.text()}`)
    }

    // 3. Persist video id + status
    await db
      .update(platform_posts)
      .set({ platform_post_id: videoId, posted_at: new Date() })
      .where(eq(platform_posts.id, platformPostId))

    await updateUploadStatus(platformPostId, 'posted')

    // 4. STORE-03: delete file after success
    await deleteFile(filePath)

    console.log(`[upload-facebook] success: videoId=${videoId}`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    await updateUploadStatus(platformPostId, 'failed', message)
    console.error('[upload-facebook] failed:', message)
    throw err  // re-throw so pg-boss marks job as failed
  }
}
