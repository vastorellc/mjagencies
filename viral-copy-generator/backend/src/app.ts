// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import { authMiddleware } from './middleware/auth.js'
import { healthRouter } from './routes/health.js'
import { postsRouter } from './routes/posts.js'
import pino from 'pino'

const logger = pino({
  redact: ['req.headers.authorization', 'body.password', 'body.api_key'],
})

export const app = express()

// ── COOP/COEP headers — required on all responses (CLAUDE.md Security) ──────
// Cross-Origin-Opener-Policy: same-origin + Cross-Origin-Embedder-Policy: require-corp
// ensures SharedArrayBuffer is available for @ffmpeg/core (Phase 3+)
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
})

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.APP_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Public routes (no auth) ──────────────────────────────────────────────────
app.use('/health', healthRouter)

// ── Auth-gated API routes ────────────────────────────────────────────────────
// authMiddleware applied to ALL /api/* routes — no exceptions per CLAUDE.md
app.use('/api', authMiddleware)
app.use('/api/posts', postsRouter)

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// ── Express 5 error handler ───────────────────────────────────────────────────
// Express 5 forwards async errors natively — no express-async-errors needed
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'unhandled error')
  // Never expose internal error details to clients (CLAUDE.md Security)
  res.status(500).json({ error: 'Internal Server Error' })
})
