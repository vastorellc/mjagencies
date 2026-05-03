// backend/src/routes/admin.ts
// ADMIN-01: All /api/admin/* routes. adminMiddleware applied to entire router — no
// individual route escapes the admin check. authMiddleware is applied upstream in app.ts.
import { Router } from 'express'
import { adminMiddleware } from '../middleware/admin.js'

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
