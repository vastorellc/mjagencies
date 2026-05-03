// backend/src/lib/upload-instagram.ts
// AUTOUP-02: Instagram Reels two-step upload.
// Container created INSIDE this worker (not at schedule time — 24h expiry).
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings, platform_posts } from '../db/schema.js'
import { decrypt } from './encryption.js'
import { deleteFile } from './storage.js'
import { updateUploadStatus, type UploadJobPayload } from './upload-worker.js'

const INSTAGRAM_GRAPH = 'https://graph.instagram.com'
const POLL_INTERVAL_MS = 5_000
const MAX_POLL_ITERATIONS = 120  // 120 × 5s = 10 min max
const MAX_CONTAINER_RETRIES = 3

async function createContainer(publicUrl: string, caption: string, accessToken: string): Promise<string> {
  const url = new URL(`${INSTAGRAM_GRAPH}/me/media`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: publicUrl,
      caption,
      access_token: accessToken,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`instagram create container failed ${res.status}: ${body}`)
  }
  const json = await res.json() as { id?: string }
  if (!json.id) throw new Error('instagram create container: no id returned')
  return json.id
}

async function pollContainerStatus(
  containerId: string,
  accessToken: string,
): Promise<'FINISHED' | 'EXPIRED' | 'ERROR'> {
  // Polls every 5s; max MAX_POLL_ITERATIONS = 10 min timeout
  for (let i = 0; i < MAX_POLL_ITERATIONS; i++) {
    await new Promise<void>(r => setTimeout(r, POLL_INTERVAL_MS))
    const url = new URL(`${INSTAGRAM_GRAPH}/${containerId}`)
    url.searchParams.set('fields', 'status_code')
    url.searchParams.set('access_token', accessToken)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`instagram poll failed ${res.status}`)
    const json = await res.json() as { status_code?: string }
    const code = json.status_code
    if (code === 'FINISHED') return 'FINISHED'
    if (code === 'EXPIRED') return 'EXPIRED'
    if (code === 'ERROR') return 'ERROR'
    // IN_PROGRESS: continue polling
  }
  throw new Error('instagram container poll timed out after 10 minutes')
}

async function publishContainer(containerId: string, accessToken: string): Promise<string> {
  const url = new URL(`${INSTAGRAM_GRAPH}/me/media_publish`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`instagram publish failed ${res.status}: ${body}`)
  }
  const json = await res.json() as { id?: string }
  if (!json.id) throw new Error('instagram publish: no media id returned')
  return json.id
}

export async function uploadInstagram(payload: UploadJobPayload): Promise<void> {
  const { userId, platformPostId, publicUrl, filePath, caption, hashtags } = payload

  try {
    await updateUploadStatus(platformPostId, 'uploading')

    // 1. Load Instagram access token
    const settingsRows = await db
      .select({ platform_config: settings.platform_config })
      .from(settings)
      .where(eq(settings.user_id, userId))
      .limit(1)

    if (!settingsRows[0]?.platform_config?.instagram) {
      throw new Error('instagram_not_connected')
    }

    const igConfig = settingsRows[0].platform_config.instagram!
    const accessToken = decrypt(igConfig.access_token)

    const fullCaption = caption + (hashtags.length > 0 ? '\n\n' + hashtags.join(' ') : '')

    // 2. Container creation + poll loop (max MAX_CONTAINER_RETRIES on EXPIRED)
    let publishedId: string | null = null
    for (let attempt = 1; attempt <= MAX_CONTAINER_RETRIES; attempt++) {
      // AUTOUP-02: Container created AT FIRE TIME (inside worker), not at schedule time.
      // Instagram containers expire after 24 hours — creating here avoids stale containers.
      const containerId = await createContainer(publicUrl, fullCaption, accessToken)
      console.log(`[upload-instagram] container created: ${containerId} (attempt ${attempt})`)

      const finalStatus = await pollContainerStatus(containerId, accessToken)

      if (finalStatus === 'FINISHED') {
        publishedId = await publishContainer(containerId, accessToken)
        break
      } else if (finalStatus === 'EXPIRED') {
        console.warn(`[upload-instagram] container expired on attempt ${attempt} — retrying`)
        if (attempt === MAX_CONTAINER_RETRIES) {
          throw new Error('instagram container expired after 3 attempts')
        }
        continue
      } else {
        // ERROR state
        throw new Error('instagram container in ERROR state')
      }
    }

    if (!publishedId) throw new Error('instagram: publish loop exited without media id')

    // 3. Persist media id + status
    await db
      .update(platform_posts)
      .set({ platform_post_id: publishedId, posted_at: new Date() })
      .where(eq(platform_posts.id, platformPostId))

    await updateUploadStatus(platformPostId, 'posted')

    // 4. STORE-03: delete file after success
    await deleteFile(filePath)

    console.log(`[upload-instagram] success: mediaId=${publishedId}`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    await updateUploadStatus(platformPostId, 'failed', message)
    console.error('[upload-instagram] failed:', message)
    throw err  // re-throw so pg-boss marks job as failed
  }
}
