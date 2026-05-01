// backend/src/routes/health.ts
// Public route — no auth middleware applied
import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})
