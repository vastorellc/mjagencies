// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import { authMiddleware } from './middleware/auth.js'
import { healthRouter } from './routes/health.js'
import { postsRouter } from './routes/posts.js'
import { settingsRouter } from './routes/settings.js'
import { authGoogleRouter } from './routes/auth-google.js'
import { authMetaRouter } from './routes/auth-meta.js'
import { aiRouter } from './routes/ai.js'
import { uploadRouter } from './routes/upload.js'
import { platformPostsRouter } from './routes/platformPosts.js'
import { learningRouter } from './routes/learning.js'
import pino from 'pino'

const logger = pino({
  redact: ['req.headers.authorization', 'body.password', 'body.api_key'],
})

export const app = express()

// ── Security headers — required on all responses ────────────────────────────
app.use((_req, res, next) => {
  // COOP/COEP: required for SharedArrayBuffer / @ffmpeg/core (Phase 3+)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  // Defensive headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  // CSP: tighten per phase as new domains (AI providers, CDNs) are added
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://api.anthropic.com; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:;",
  )
  next()
})

// ── Middleware ───────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
  throw new Error('APP_URL must be set in production')
}
app.use(cors({
  origin: process.env.APP_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Public routes (no auth) ──────────────────────────────────────────────────
app.use('/health', healthRouter)

// ── OAuth callbacks — registered BEFORE authMiddleware ───────────────────────
// OAuth callbacks arrive from the provider without a Bearer token; state param provides
// CSRF protection + userId binding. These routes validate state before any DB write.
// /connect routes on each router use per-route authMiddleware to keep initiation auth-gated.
app.use('/api/auth/google', authGoogleRouter)
// Meta: Instagram + Facebook share the same Meta app but use separate OAuth paths.
// /instagram/connect and /facebook/connect are per-route auth-gated; callbacks are public.
app.use('/api/auth', authMetaRouter)  // routes: /instagram/{connect,callback}, /facebook/{connect,callback}

// ── Auth-gated API routes ────────────────────────────────────────────────────
// authMiddleware applied to ALL /api/* routes — no exceptions per CLAUDE.md
app.use('/api', authMiddleware)
app.use('/api/posts', postsRouter)

// ── Phase 2: Settings + OAuth (auth-gated by app.use('/api', authMiddleware) above) ──
app.use('/api/settings', settingsRouter)

// ── Phase 5: AI proxy (auth-gated by app.use('/api', authMiddleware) above) ──
app.use('/api/ai', aiRouter)

// ── Phase 6: Upload + scheduling (auth-gated by app.use('/api', authMiddleware) above) ──
app.use('/api/upload', uploadRouter)

// ── Phase 7: History view logging + learning loops (auth-gated by app.use('/api', authMiddleware) above) ──
app.use('/api/platform-posts', platformPostsRouter)
app.use('/api/learning', learningRouter)

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
