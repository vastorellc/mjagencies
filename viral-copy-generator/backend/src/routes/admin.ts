// backend/src/routes/admin.ts
// ADMIN-01: All /api/admin/* routes. adminMiddleware applied to entire router — no
// individual route escapes the admin check. authMiddleware is applied upstream in app.ts.
import { Router } from 'express'
import { adminMiddleware } from '../middleware/admin.js'
import { db } from '../db/index.js'
import { getBoss } from '../lib/boss.js'
import { sql } from 'drizzle-orm'

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
