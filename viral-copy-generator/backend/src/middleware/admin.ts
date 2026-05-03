// backend/src/middleware/admin.ts
// ADMIN-01: Admin guard — enforces role: 'admin' JWT claim on all /api/admin/* routes.
// This middleware is ALWAYS applied AFTER authMiddleware — res.locals.user is guaranteed
// to be set when this runs. It is a SEPARATE file from auth.ts (CLAUDE.md: never mix concerns).
import type { Request, Response, NextFunction } from 'express'
import type { User } from '@supabase/supabase-js'

// Extend Express locals so TypeScript knows res.locals.user is a Supabase User.
// This matches the shape set by authMiddleware in auth.ts.
declare global {
  namespace Express {
    interface Locals {
      user: User
      userId: string
    }
  }
}

export function adminMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // res.locals.user is guaranteed by authMiddleware which runs first at app.use('/api', authMiddleware).
  // app_metadata.role is set server-side via Supabase service role key — cannot be forged by JWT claim body.
  const role = res.locals.user?.app_metadata?.role as string | undefined
  if (role !== 'admin') {
    // ADMIN-10 baseline: always 403, never expose why (enumeration risk)
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
