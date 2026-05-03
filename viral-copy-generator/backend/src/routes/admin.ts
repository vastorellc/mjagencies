// backend/src/routes/admin.ts
// ADMIN-01: All /api/admin/* routes. adminMiddleware applied to entire router — no
// individual route escapes the admin check. authMiddleware is applied upstream in app.ts.
import { Router } from 'express'
import { adminMiddleware } from '../middleware/admin.js'
import { db } from '../db/index.js'
import { getBoss } from '../lib/boss.js'
import { eq, sql } from 'drizzle-orm'
import { learning_signals, settings, platform_posts, posts } from '../db/schema.js'
import { supabaseAdmin } from '../lib/supabase.js'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'

const execAsync = promisify(exec)

export const adminRouter = Router()

// Apply admin guard to ALL routes on this router.
// authMiddleware (upstream at app.use('/api', authMiddleware)) runs first,
// then adminMiddleware runs — double-gated.
adminRouter.use(adminMiddleware)

// ── Placeholder — routes added in subsequent plans ──────────────────────────
// 08-02: GET /api/admin/jobs, POST /api/admin/jobs/:id/retry, DELETE /api/admin/jobs/:id
// 08-03: GET /api/admin/users, PATCH /api/admin/users/:userId/disable
// 08-04: DELETE /api/admin/users/:userId/learning, GET /api/admin/stats/platforms
// 08-05: GET /api/admin/health, GET /api/admin/logs
adminRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, role: 'admin' })
})

// ── ADMIN-02: List all pg-boss jobs across all users ────────────────────────
// Uses raw SQL on pgboss.job — Drizzle has no schema for pg-boss internal tables.
// Returns last 200 jobs ordered newest-first. State filter excludes 'cancelled' by default
// to keep the list actionable (add ?state=all to include cancelled).
adminRouter.get('/jobs', async (req, res) => {
  const stateFilter = req.query.state === 'all'
    ? sql`state IN ('created', 'retry', 'active', 'completed', 'cancelled', 'failed')`
    : sql`state IN ('created', 'retry', 'active', 'failed')`

  const rows = await db.execute<{
    id: string
    name: string
    state: string
    data: Record<string, unknown> | null
    createdon: string
    startedon: string | null
    completedon: string | null
  }>(
    sql`
      SELECT id, name, state, data, createdon, startedon, completedon
      FROM pgboss.job
      WHERE ${stateFilter}
      ORDER BY createdon DESC
      LIMIT 200
    `
  )

  // ADMIN-10: Strip any sensitive fields from job data before returning.
  // Job payloads may contain filePath (safe), platform (safe), userId (safe for admin),
  // but MUST NOT contain api_key_encrypted or OAuth token fields.
  const jobs = rows.rows.map(row => {
    const data = row.data ?? {}
    // Allowlist of safe data fields only — omit anything not explicitly listed
    const safeData: Record<string, unknown> = {
      userId: data['userId'],
      platform: data['platform'],
      fileId: data['fileId'],
      scheduledAt: data['scheduledAt'],
      postId: data['postId'],
    }
    return {
      id: row.id,
      name: row.name,
      state: row.state,
      data: safeData,
      createdon: row.createdon,
      startedon: row.startedon,
      completedon: row.completedon,
    }
  })

  res.json({ jobs })
})

// ── ADMIN-03: Retry a failed job ─────────────────────────────────────────────
// boss.resume(name, jobId) transitions the job from 'failed' back to 'created' state.
// pg-boss v12 requires both the queue name and the job id — we look up the name
// from pgboss.job before calling resume so the caller only needs the id.
adminRouter.post('/jobs/:id/retry', async (req, res) => {
  const jobId = req.params.id
  if (!jobId || typeof jobId !== 'string') {
    res.status(400).json({ error: 'Missing job id' })
    return
  }

  // Look up the queue name for this job (required by pg-boss v12 API)
  const lookup = await db.execute<{ name: string }>(
    sql`SELECT name FROM pgboss.job WHERE id = ${jobId} LIMIT 1`
  )
  if (lookup.rows.length === 0) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  const queueName = lookup.rows[0]!.name

  const boss = await getBoss()
  // boss.resume returns CommandResponse — transitions failed job back to created
  await boss.resume(queueName, jobId)
  res.json({ ok: true, jobId })
})

// ── ADMIN-03: Cancel a pending or active job ─────────────────────────────────
// boss.cancel(name, jobId) transitions a job from 'created' or 'active' to 'cancelled'.
// pg-boss v12 requires both the queue name and the job id — we look up the name
// from pgboss.job before calling cancel so the caller only needs the id.
adminRouter.delete('/jobs/:id', async (req, res) => {
  const jobId = req.params.id
  if (!jobId || typeof jobId !== 'string') {
    res.status(400).json({ error: 'Missing job id' })
    return
  }

  // Look up the queue name for this job (required by pg-boss v12 API)
  const lookup = await db.execute<{ name: string }>(
    sql`SELECT name FROM pgboss.job WHERE id = ${jobId} LIMIT 1`
  )
  if (lookup.rows.length === 0) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  const queueName = lookup.rows[0]!.name

  const boss = await getBoss()
  await boss.cancel(queueName, jobId)
  res.json({ ok: true, jobId })
})

// ── ADMIN-04: List all users (safe fields only) ──────────────────────────────
// ADMIN-10: Returns ONLY safe metadata — never api_key_encrypted, platform_config tokens,
// or any OAuth data. Connected platforms shown as string array of keys (not token values).
adminRouter.get('/users', async (_req, res) => {
  // Fetch users from Supabase Auth (up to 1000 — sufficient for v1 scale)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  })
  if (authError) {
    res.status(502).json({ error: 'Failed to fetch users from Supabase' })
    return
  }

  const users = authData.users

  // Batch-fetch upload counts per user_id from posts table
  const uploadCountRows = await db.execute<{ user_id: string; upload_count: string }>(
    sql`SELECT user_id, COUNT(*)::text AS upload_count FROM posts GROUP BY user_id`
  )
  const uploadCountMap: Record<string, number> = {}
  for (const row of uploadCountRows.rows) {
    uploadCountMap[row.user_id] = parseInt(row.upload_count, 10)
  }

  // Batch-fetch platform_config from settings to determine connected platforms.
  // ADMIN-10: Only extract KEYS (which platforms are configured), never token values.
  const settingsRows = await db.execute<{ user_id: string; platform_config: Record<string, unknown> | null }>(
    sql`SELECT user_id, platform_config FROM settings`
  )
  const platformMap: Record<string, string[]> = {}
  for (const row of settingsRows.rows) {
    const cfg = row.platform_config ?? {}
    // Only include platforms with non-null config — connected platforms only
    platformMap[row.user_id] = Object.keys(cfg).filter(k => cfg[k] != null)
  }

  // Build safe user response — ADMIN-10 enforced: no api_key_encrypted, no token values
  const safeUsers = users.map(u => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    banned: u.banned_until != null && new Date(u.banned_until) > new Date(),
    upload_count: uploadCountMap[u.id] ?? 0,
    connected_platforms: platformMap[u.id] ?? [],
  }))

  res.json({ users: safeUsers })
})

// ── ADMIN-05: Disable a user account ─────────────────────────────────────────
// Sets ban_duration to '87600h' (10 years) — the user cannot log in while banned.
// Admin cannot disable themselves (safety guard).
adminRouter.patch('/users/:userId/disable', async (req, res) => {
  const targetUserId = req.params.userId
  const adminUserId = res.locals.userId as string | undefined

  if (!targetUserId || typeof targetUserId !== 'string') {
    res.status(400).json({ error: 'Missing userId' })
    return
  }

  // Prevent admin from accidentally locking themselves out
  if (targetUserId === adminUserId) {
    res.status(400).json({ error: 'Admin cannot disable their own account' })
    return
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    ban_duration: '87600h',  // 10 years — effectively permanent; reversible via /enable
  })

  if (error) {
    res.status(502).json({ error: 'Failed to disable user' })
    return
  }

  res.json({ ok: true, userId: targetUserId, action: 'disabled' })
})

// ── ADMIN-05: Re-enable a disabled user account ───────────────────────────────
// Clears the ban by setting ban_duration to 'none'. User can log in immediately.
adminRouter.patch('/users/:userId/enable', async (req, res) => {
  const targetUserId = req.params.userId

  if (!targetUserId || typeof targetUserId !== 'string') {
    res.status(400).json({ error: 'Missing userId' })
    return
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    ban_duration: 'none',
  })

  if (error) {
    res.status(502).json({ error: 'Failed to enable user' })
    return
  }

  res.json({ ok: true, userId: targetUserId, action: 'enabled' })
})

// ── ADMIN-06: Reset learning data for a user ─────────────────────────────────
// Atomically: DELETE all learning_signals WHERE user_id = $userId
//             + UPDATE settings SET learned_weights = NULL WHERE user_id = $userId
// Both writes are in a single db.transaction() — LEARNING-08 pattern: no partial commit.
// Returns count of deleted learning_signals rows for confirmation.
adminRouter.delete('/users/:userId/learning', async (req, res) => {
  const targetUserId = req.params.userId

  if (!targetUserId || typeof targetUserId !== 'string') {
    res.status(400).json({ error: 'Missing userId' })
    return
  }

  let deletedCount = 0

  await db.transaction(async (tx) => {
    // Count before delete (for response feedback)
    const countResult = await tx.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM learning_signals WHERE user_id = ${targetUserId}`
    )
    deletedCount = parseInt(countResult.rows[0]?.count ?? '0', 10)

    // Write 1: Delete all learning_signals for this user
    await tx.delete(learning_signals).where(eq(learning_signals.user_id, targetUserId))

    // Write 2: Null out learned_weights in settings
    await tx.update(settings)
      .set({ learned_weights: null })
      .where(eq(settings.user_id, targetUserId))
  })

  res.json({ ok: true, userId: targetUserId, deleted: deletedCount })
})

// ── ADMIN-09: Aggregate platform stats across all users ──────────────────────
// Returns: total uploads per platform, success/failure counts, avg virality score.
// ADMIN-10: No individual post content, copy, or AI output returned — aggregates only.
adminRouter.get('/stats/platforms', async (_req, res) => {
  // Aggregate upload stats from platform_posts — group by platform
  const uploadStatsRows = await db.execute<{
    platform: string
    total: string
    succeeded: string
    failed: string
  }>(
    sql`
      SELECT
        platform,
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE upload_status = 'posted')::text AS succeeded,
        COUNT(*) FILTER (WHERE upload_status = 'failed')::text AS failed
      FROM platform_posts
      GROUP BY platform
      ORDER BY total DESC
    `
  )

  // Aggregate avg virality score from posts — group by platform via platform_posts join
  const scoreStatsRows = await db.execute<{
    platform: string
    avg_score: string
  }>(
    sql`
      SELECT
        pp.platform,
        AVG(p.virality_score)::text AS avg_score
      FROM platform_posts pp
      JOIN posts p ON p.id = pp.post_id
      GROUP BY pp.platform
    `
  )

  // Merge into a single response object keyed by platform
  const scoreMap: Record<string, number> = {}
  for (const row of scoreStatsRows.rows) {
    scoreMap[row.platform] = parseFloat(row.avg_score)
  }

  const platformStats = uploadStatsRows.rows.map(row => ({
    platform: row.platform,
    total_uploads: parseInt(row.total, 10),
    succeeded: parseInt(row.succeeded, 10),
    failed: parseInt(row.failed, 10),
    success_rate: parseInt(row.total, 10) > 0
      ? Math.round((parseInt(row.succeeded, 10) / parseInt(row.total, 10)) * 100)
      : 0,
    avg_virality_score: scoreMap[row.platform]
      ? Math.round(scoreMap[row.platform])
      : null,
  }))

  // Overall totals
  const totalUploads = platformStats.reduce((s, p) => s + p.total_uploads, 0)
  const totalSucceeded = platformStats.reduce((s, p) => s + p.succeeded, 0)

  res.json({
    platform_stats: platformStats,
    totals: {
      uploads: totalUploads,
      succeeded: totalSucceeded,
      overall_success_rate: totalUploads > 0
        ? Math.round((totalSucceeded / totalUploads) * 100)
        : 0,
    },
  })
})

// ── ADMIN-07: System health dashboard ────────────────────────────────────────
// Returns VPS CPU/memory, disk usage via df -h, and Supabase DB size via SQL.
// Disk usage: exec('df -h /var') — /var is where VPS uploads are stored.
// Fail-partial: if disk or DB query fails, returns what is available + error field.
adminRouter.get('/health', async (_req, res) => {
  const cpuCount = os.cpus().length
  const totalMemMB = Math.round(os.totalmem() / (1024 * 1024))
  const freeMemMB = Math.round(os.freemem() / (1024 * 1024))
  const usedMemMB = totalMemMB - freeMemMB
  const memUsePct = Math.round((usedMemMB / totalMemMB) * 100)

  // Disk usage — parse df -h /var output
  let diskInfo: { size: string; used: string; avail: string; usePct: string } | null = null
  let diskError: string | null = null
  try {
    const { stdout } = await execAsync('df -h /var')
    const lines = stdout.trim().split('\n')
    // Second line has the data row: Filesystem Size Used Avail Use% Mountpoint
    const parts = lines[1]?.split(/\s+/) ?? []
    if (parts.length >= 5) {
      diskInfo = {
        size: parts[1] ?? '?',
        used: parts[2] ?? '?',
        avail: parts[3] ?? '?',
        usePct: parts[4] ?? '?',
      }
    }
  } catch (err: unknown) {
    diskError = (err as Error).message ?? 'df command failed'
  }

  // Supabase DB size — raw SQL query on current database
  let dbSize: string | null = null
  let dbError: string | null = null
  try {
    const result = await db.execute<{ db_size: string }>(
      sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`
    )
    dbSize = result.rows[0]?.db_size ?? null
  } catch (err: unknown) {
    dbError = (err as Error).message ?? 'DB size query failed'
  }

  // pg-boss queue depth — count of pending/active jobs
  let queueDepth = 0
  try {
    const queueResult = await db.execute<{ depth: string }>(
      sql`SELECT COUNT(*)::text AS depth FROM pgboss.job WHERE state IN ('created', 'active', 'retry')`
    )
    queueDepth = parseInt(queueResult.rows[0]?.depth ?? '0', 10)
  } catch {
    // Non-fatal — leave queueDepth at 0
  }

  res.json({
    cpu: { count: cpuCount },
    memory: {
      total_mb: totalMemMB,
      free_mb: freeMemMB,
      used_mb: usedMemMB,
      use_pct: memUsePct,
    },
    disk: diskInfo ?? { error: diskError },
    database: dbSize != null
      ? { size: dbSize }
      : { error: dbError },
    queue: { pending_jobs: queueDepth },
    timestamp: new Date().toISOString(),
  })
})
