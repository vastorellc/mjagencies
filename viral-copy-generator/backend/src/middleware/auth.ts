// backend/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { AuthError, ExternalApiError } from '../lib/errors.js'

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Authentication required', 'Missing or invalid Bearer token')
  }
  const token = authHeader.slice(7).trim()

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      throw new AuthError('Invalid authentication token', 'Supabase getUser returned null or error', { original: error })
    }

    // Attach user to request for downstream handlers
    res.locals.user = user
    res.locals.userId = user.id
    next()
  } catch (err) {
    // If Supabase is unreachable, treat as external API error
    if (err instanceof AuthError) throw err
    throw new ExternalApiError(
      'Authentication service unavailable',
      `Supabase auth check failed: ${err instanceof Error ? err.message : String(err)}`,
      { original: err, retryable: true }
    )
  }
}
