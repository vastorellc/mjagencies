// backend/src/routes/posts.ts
import { Router } from 'express'

export const postsRouter = Router()

// GET /api/posts — returns user's posts (stub for Phase 5)
// authMiddleware is applied at the app level for all /api/* routes
postsRouter.get('/', (_req, res) => {
  // res.locals.userId is set by authMiddleware
  res.json({ posts: [], userId: res.locals.userId as string })
})
