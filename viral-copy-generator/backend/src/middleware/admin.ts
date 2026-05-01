import type { Request, Response, NextFunction } from 'express'

// AUTH-05: Reject non-admin users with 403
// AUTH-06: Allow users with app_metadata.role === 'admin'
// Must be used after authMiddleware (which sets res.locals.user)
export function adminMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const user = res.locals.user as { app_metadata?: { role?: string } } | undefined
  if (user?.app_metadata?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
