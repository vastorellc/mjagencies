// backend/src/routes/upload.ts
// POST /api/upload/file  — multer disk storage, 260 MB limit
// POST /api/upload/schedule — enqueue pg-boss job; filePath/publicUrl derived server-side
// GET  /api/upload/peak-times — returns next 2 PKT peak-time slots for a given platform
import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { mkdir, rename, stat } from 'node:fs/promises'
import { UPLOADS_ROOT } from '../lib/storage.js'
import { getBoss } from '../lib/boss.js'
import { getPeakTimes, type SchedulablePlatform } from '../lib/scheduling.js'
import { db } from '../db/index.js'
import { platform_posts } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import type { UploadJobPayload } from '../lib/upload-worker.js'

export const uploadRouter = Router()

const MAX_FILE_SIZE = 260 * 1024 * 1024 // 260 MB (250 MB limit + 10 MB headroom for multipart)
const INSTAGRAM_MAX_SIZE = 100 * 1024 * 1024 // 100 MB Instagram hard limit (AUTOUP-02)

// multer diskStorage: write to /var/uploads/tmp/{uuid}.mp4 first, then rename to
// /var/uploads/{userId}/{uuid}.mp4 in the route handler (userId is not available inside
// destination() because res.locals is not accessible from the multer callback).
const diskStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const tmpDir = path.resolve(UPLOADS_ROOT, 'tmp')
    await mkdir(tmpDir, { recursive: true })
    cb(null, tmpDir)
  },
  filename: (_req, _file, cb) => {
    cb(null, `${randomUUID()}.mp4`)
  },
})

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      cb(new Error('only_video_files'))
    } else {
      cb(null, true)
    }
  },
})

/**
 * POST /api/upload/file
 * Body: multipart/form-data, field name "video"
 * Returns: { fileId: string, publicUrl: string }
 * Writes file to /var/uploads/{userId}/{uuid}.mp4
 * Requires: VPS_PUBLIC_URL env var (STORE-02)
 */
uploadRouter.post(
  '/file',
  upload.single('video'),
  async (req: Request, res: Response): Promise<void> => {
    // multer size limit returns a multer error before reaching handler
    if (!req.file) {
      res.status(400).json({ error: 'no_file' })
      return
    }

    const userId = res.locals.userId as string
    const vpsUrl = process.env.VPS_PUBLIC_URL
    if (!vpsUrl) {
      res.status(500).json({ error: 'VPS_PUBLIC_URL not configured' })
      return
    }

    // fileId is the uuid portion of the multer-generated filename
    const fileId = path.basename(req.file.filename, '.mp4')
    const userDir = path.resolve(UPLOADS_ROOT, userId)
    await mkdir(userDir, { recursive: true })
    const destPath = path.resolve(userDir, `${fileId}.mp4`)

    // Path-traversal guard on destination (T-06-01)
    const root = path.resolve(UPLOADS_ROOT)
    if (!destPath.startsWith(root + path.sep)) {
      res.status(400).json({ error: 'invalid_path' })
      return
    }

    await rename(req.file.path, destPath)

    const publicUrl = `${vpsUrl}/uploads/${userId}/${fileId}.mp4`
    res.json({ fileId, publicUrl })
  },
)

// Multer error handler for /file route (413 on oversize, 400 on wrong type)
uploadRouter.use(
  '/file',
  (err: Error, _req: Request, res: Response, next: (e?: unknown) => void): void => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'file_too_large', message: 'Max file size is 260 MB.' })
      return
    }
    next(err)
  },
)

/**
 * POST /api/upload/schedule
 * Body JSON: { postId, platform, fileId, caption, hashtags, scheduledAt? }
 *
 * SECURITY: Client MUST NOT send filePath, publicUrl, or fileSizeBytes.
 * filePath and publicUrl are derived server-side from authenticated userId + body.fileId.
 * Instagram 100 MB gate is enforced via stat() on the actual file (T-06-06, AUTOUP-02).
 */
interface ScheduleBody {
  postId: string
  platform: 'youtube' | 'instagram' | 'facebook' | 'tiktok'
  fileId: string
  caption: string
  hashtags: string[]
  scheduledAt?: string
}

const VALID_PLATFORMS = new Set(['youtube', 'instagram', 'facebook', 'tiktok'])

uploadRouter.post('/schedule', async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as string
  const body = req.body as ScheduleBody

  // Validate required fields
  if (!body.postId || !body.platform || !body.fileId) {
    res.status(400).json({ error: 'missing_required_fields' })
    return
  }

  if (!VALID_PLATFORMS.has(body.platform)) {
    res.status(400).json({ error: 'invalid_platform' })
    return
  }

  // Derive filePath and publicUrl server-side — never accept from client (T-06-03)
  const uploadsRoot = process.env.UPLOADS_PATH ?? '/var/uploads'
  const filePath = path.resolve(uploadsRoot, userId, `${body.fileId}.mp4`)
  const vpsUrl = process.env.VPS_PUBLIC_URL ?? ''
  const publicUrl = `${vpsUrl}/uploads/${userId}/${body.fileId}.mp4`

  // AUTOUP-02 / T-06-06: Instagram 100 MB gate — reads actual file size via stat(), not client value
  if (body.platform === 'instagram') {
    const { size } = await stat(filePath)
    if (size > INSTAGRAM_MAX_SIZE) {
      res.status(413).json({
        error: 'instagram_file_too_large',
        message: 'Instagram maximum is 100 MB. Please compress the video before uploading.',
      })
      return
    }
  }

  // Lookup platform_posts row for status updates
  const platformPostRows = await db
    .select({ id: platform_posts.id })
    .from(platform_posts)
    .where(
      and(
        eq(platform_posts.post_id, body.postId),
        eq(platform_posts.user_id, userId),
        eq(platform_posts.platform, body.platform),
      ),
    )
    .limit(1)

  if (platformPostRows.length === 0) {
    res.status(404).json({ error: 'platform_post_not_found' })
    return
  }

  const platformPostId = platformPostRows[0].id

  // Build the job payload (UploadJobPayload — filePath/publicUrl assembled server-side above)
  const payload: UploadJobPayload = {
    userId,
    postId: body.postId,
    platformPostId,
    fileId: body.fileId,
    filePath,
    publicUrl,
    platform: body.platform,
    caption: body.caption ?? '',
    hashtags: body.hashtags ?? [],
    scheduledAt: body.scheduledAt ?? new Date().toISOString(),
  }

  // Mark upload as in-progress before enqueuing
  await db
    .update(platform_posts)
    .set({ upload_status: 'uploading' })
    .where(eq(platform_posts.id, platformPostId))

  const boss = await getBoss()
  const jobName = `upload-${body.platform}`
  const sendOptions = body.scheduledAt ? { startAfter: new Date(body.scheduledAt).toISOString() } : {}

  await boss.send(jobName, payload, sendOptions)

  res.json({ ok: true, platformPostId })
})

// GET /api/upload/peak-times?platform=<platform>
// Returns { slots: string[] } — up to 2 upcoming PKT peak-time slots as UTC ISO-8601 strings.
// Allowlist check on platform param guards against injection (T-06-11).
const PEAK_VALID_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']

uploadRouter.get('/peak-times', (req: Request, res: Response): void => {
  const platform = req.query['platform'] as string | undefined
  if (!platform || !PEAK_VALID_PLATFORMS.includes(platform)) {
    res.status(400).json({ error: 'invalid_platform' })
    return
  }
  const slots = getPeakTimes(platform as SchedulablePlatform)
  res.json({ slots })
})
