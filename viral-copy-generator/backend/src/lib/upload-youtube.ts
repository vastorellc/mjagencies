// backend/src/lib/upload-youtube.ts
// AUTOUP-01: YouTube upload uses resumable protocol via googleapis videos.insert()
// googleapis library handles chunked resumable upload internally when given a readable stream.
import { createReadStream } from 'node:fs'
import { google } from 'googleapis'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings, platform_posts } from '../db/schema.js'
import { decrypt, encrypt } from './encryption.js'
import { getGoogleOAuthClient, refreshYouTubeToken } from './oauth-google.js'
import { deleteFile } from './storage.js'
import { updateUploadStatus, type UploadJobPayload } from './upload-worker.js'

const FIVE_MIN_MS = 5 * 60 * 1000

export async function uploadYouTube(payload: UploadJobPayload): Promise<void> {
  const { userId, platformPostId, filePath, caption, hashtags } = payload

  try {
    await updateUploadStatus(platformPostId, 'uploading')

    // 1. Load user settings — get YouTube tokens
    const settingsRows = await db
      .select({ platform_config: settings.platform_config })
      .from(settings)
      .where(eq(settings.user_id, userId))
      .limit(1)

    if (!settingsRows[0]?.platform_config?.youtube) {
      throw new Error('youtube_not_connected')
    }

    const ytConfig = settingsRows[0].platform_config.youtube!
    // Decrypt stored tokens
    const accessToken = decrypt(ytConfig.access_token)
    const refreshToken = decrypt(ytConfig.refresh_token)

    // 2. Refresh access_token if near expiry
    let currentAccessToken = accessToken
    let tokenExpiry = ytConfig.expiry
    if (Date.now() + FIVE_MIN_MS > tokenExpiry) {
      const refreshed = await refreshYouTubeToken(refreshToken)
      currentAccessToken = refreshed.access_token
      tokenExpiry = refreshed.expiry
      // Persist refreshed tokens
      await db
        .update(settings)
        .set({
          platform_config: {
            ...settingsRows[0].platform_config,
            youtube: {
              access_token: encrypt(refreshed.access_token),
              refresh_token: encrypt(refreshed.refresh_token ?? refreshToken),
              expiry: refreshed.expiry,
            },
          },
        })
        .where(eq(settings.user_id, userId))
    }

    // 3. Build OAuth2 client with current token
    const auth = getGoogleOAuthClient()
    auth.setCredentials({ access_token: currentAccessToken, expiry_date: tokenExpiry })
    const youtube = google.youtube({ version: 'v3', auth })

    // 4. AUTOUP-01: resumable upload via readable stream
    // googleapis videos.insert() uses resumable protocol when body is a stream.
    // Never use multipart — 5 MB hard limit (CLAUDE.md critical rule).
    const title = caption.slice(0, 100) || 'Viral Copy Generator Upload'
    const description = caption + (hashtags.length > 0 ? '\n\n' + hashtags.join(' ') : '')

    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          tags: hashtags.map(h => h.replace(/^#/, '')),
        },
        status: { privacyStatus: 'public' },
      },
      media: {
        mimeType: 'video/mp4',
        body: createReadStream(filePath),
      },
    })

    const videoId = response.data.id
    if (!videoId) throw new Error('youtube upload returned no video id')

    // 5. Persist YouTube video id into platform_posts
    await db
      .update(platform_posts)
      .set({ platform_post_id: videoId, posted_at: new Date() })
      .where(eq(platform_posts.id, platformPostId))

    // 6. Update status to posted
    await updateUploadStatus(platformPostId, 'posted')

    // 7. STORE-03: delete local file after successful upload
    await deleteFile(filePath)

    console.log(`[upload-youtube] success: videoId=${videoId}`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    await updateUploadStatus(platformPostId, 'failed', message)
    console.error('[upload-youtube] failed:', message)
    throw err  // re-throw so pg-boss marks job as failed
  }
}
