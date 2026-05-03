// backend/src/lib/upload-worker.ts
// pg-boss worker registration for auto-upload jobs (Phase 6)
// Worker implementations: see upload-youtube.ts, upload-instagram.ts, upload-facebook.ts
import { PgBoss } from 'pg-boss'
import type { Job } from 'pg-boss'
import { db } from '../db/index.js'
import { platform_posts } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export interface UploadJobPayload {
  userId: string
  postId: string
  platformPostId: string  // platform_posts.id — for status updates
  fileId: string          // uuid portion of filename
  filePath: string        // absolute path: /var/uploads/{userId}/{uuid}.mp4
  publicUrl: string       // VPS_PUBLIC_URL/uploads/{userId}/{uuid}.mp4
  platform: 'youtube' | 'instagram' | 'facebook' | 'tiktok'
  caption: string
  hashtags: string[]
  scheduledAt: string     // ISO-8601 UTC — used by pg-boss startAfter
}

const UPLOAD_QUEUES = [
  'upload-youtube',
  'upload-instagram',
  'upload-facebook',
  'upload-tiktok',
] as const

/**
 * Update platform_posts.upload_status and optional error_message.
 * Called by each worker on success or failure.
 * Supabase Realtime pushes the row change to the frontend (AUTOUP-08).
 */
export async function updateUploadStatus(
  platformPostId: string,
  status: 'uploading' | 'posted' | 'failed',
  errorMessage?: string,
): Promise<void> {
  await db
    .update(platform_posts)
    .set({
      upload_status: status,
      ...(status === 'posted' ? { posted_at: new Date() } : {}),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .where(eq(platform_posts.id, platformPostId))
}

/**
 * Register pg-boss upload worker handlers for all platforms.
 * Must be called after getBoss() returns — queues are created here (FK constraint).
 * Actual upload logic lives in per-platform files created in Plan 06-02.
 *
 * pg-boss v12 work() handler signature: (jobs: Job<T>[]) => Promise<void>
 * The handler receives a batch (array) of jobs each polling cycle.
 */
export async function registerUploadWorkers(boss: PgBoss): Promise<void> {
  // pg-boss v12: createQueue() before work() — FK constraint on queue name in pgboss.schedule
  for (const queueName of UPLOAD_QUEUES) {
    await boss.createQueue(queueName)
  }

  // YouTube worker — implementation filled in Plan 06-02
  await boss.work<UploadJobPayload>('upload-youtube', async (jobs: Job<UploadJobPayload>[]) => {
    for (const job of jobs) {
      const { uploadYouTube } = await import('./upload-youtube.js')
      await uploadYouTube(job.data)
    }
  })

  // Instagram worker — implementation filled in Plan 06-02
  await boss.work<UploadJobPayload>('upload-instagram', async (jobs: Job<UploadJobPayload>[]) => {
    for (const job of jobs) {
      const { uploadInstagram } = await import('./upload-instagram.js')
      await uploadInstagram(job.data)
    }
  })

  // Facebook worker — implementation filled in Plan 06-02
  await boss.work<UploadJobPayload>('upload-facebook', async (jobs: Job<UploadJobPayload>[]) => {
    for (const job of jobs) {
      const { uploadFacebook } = await import('./upload-facebook.js')
      await uploadFacebook(job.data)
    }
  })

  // TikTok worker — gated behind TIKTOK_APPROVED flag (AUTOUP-04)
  // TikTok API approval is pending; job is queued but fails gracefully until approved
  await boss.work<UploadJobPayload>('upload-tiktok', async (jobs: Job<UploadJobPayload>[]) => {
    for (const job of jobs) {
      const isTikTokApproved = process.env.TIKTOK_APPROVED === 'true'
      if (!isTikTokApproved) {
        await updateUploadStatus(job.data.platformPostId, 'failed', 'TikTok API approval pending')
        continue
      }
      const { uploadTikTok } = await import('./upload-tiktok.js')
      await uploadTikTok(job.data)
    }
  })

  console.log('[pg-boss] upload workers registered: youtube, instagram, facebook, tiktok')
}
