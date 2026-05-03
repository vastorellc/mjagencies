// backend/src/routes/admin.ts
// ADMIN-01: All /api/admin/* routes. adminMiddleware applied to entire router — no
// individual route escapes the admin check. authMiddleware is applied upstream in app.ts.
import { Router } from 'express'
import { adminMiddleware } from '../middleware/admin.js'
import { db } from '../db/index.js'
import { getBoss } from '../lib/boss.js'
import { sql } from 'drizzle-orm'
import { supabaseAdmin } from '../lib/supabase.js'

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
