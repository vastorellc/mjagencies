// backend/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Attach user to request for downstream handlers
  res.locals.user = user
  res.locals.userId = user.id
  next()
}
