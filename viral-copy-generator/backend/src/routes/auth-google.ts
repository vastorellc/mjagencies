import { Router, type Request, type Response } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { encrypt } from '../lib/encryption.js'
import { createOAuthState, consumeOAuthState } from '../lib/oauth-state.js'
import { getGoogleOAuthClient, GOOGLE_YOUTUBE_SCOPES } from '../lib/oauth-google.js'
import { authMiddleware } from '../middleware/auth.js'

export const authGoogleRouter = Router()

// Redirect target on failure (research Pitfall 8)
function failRedirect(res: Response, reason: string): void {
  const appUrl = process.env.APP_URL ?? ''
  res.redirect(`${appUrl}/?screen=settings&error=${encodeURIComponent(reason)}`)
}

// SETTINGS-04: Initiate Google OAuth (returns JSON auth_url for the frontend to navigate to)
// NOTE: NOT a 302 — browsers hide the Location header on cross-origin opaqueredirect (CORS),
// so the frontend cannot read it from an authenticated XHR. Returning JSON lets the frontend
// call window.location.assign(auth_url) for the full-page redirect.
// authMiddleware applied per-route here: this router is mounted before app.use('/api', authMiddleware)
// so that /callback can accept Google's redirect (no Bearer token). /connect still requires auth.
authGoogleRouter.get('/connect', authMiddleware, (_req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({ error: 'YouTube OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.' })
    return
  }
  const userId = res.locals['userId'] as string
  const state = createOAuthState(userId)
  const oauth = getGoogleOAuthClient()
  const auth_url = oauth.generateAuthUrl({
    access_type: 'offline',          // Required for refresh_token
    prompt: 'consent',                // Pitfall 2: forces refresh_token on every connect
    scope: [...GOOGLE_YOUTUBE_SCOPES],
    state,
    include_granted_scopes: true,
  })
  res.json({ auth_url })
})

// Callback: validate state, exchange code, encrypt + JSONB-merge tokens.
// No auth required: Google's browser redirect carries no Bearer token.
// CSRF protection: state param is single-use and binds to the userId from /connect.
authGoogleRouter.get('/callback', async (req: Request, res: Response) => {
  const code = typeof req.query['code'] === 'string' ? req.query['code'] : ''
  const state = typeof req.query['state'] === 'string' ? req.query['state'] : ''
  const errorParam = typeof req.query['error'] === 'string' ? req.query['error'] : ''

  if (errorParam) {
    failRedirect(res, errorParam)
    return
  }
  if (!code || !state) {
    failRedirect(res, 'missing_code_or_state')
    return
  }

  // CSRF: state binds to the user who initiated the flow. Single-use.
  const userId = consumeOAuthState(state)
  if (!userId) {
    failRedirect(res, 'oauth_failed')
    return
  }

  try {
    const oauth = getGoogleOAuthClient()
    const { tokens } = await oauth.getToken(code)
    if (!tokens.access_token || !tokens.refresh_token) {
      // refresh_token may be missing if user previously consented WITHOUT prompt=consent.
      // Should not happen because we always send prompt=consent, but treat as failure.
      failRedirect(res, 'no_refresh_token')
      return
    }

    // Encrypt tokens at the route layer BEFORE JSONB write (T-02-06)
    const youtubePatch = {
      youtube: {
        access_token: encrypt(tokens.access_token),
        refresh_token: encrypt(tokens.refresh_token),
        expiry: tokens.expiry_date ?? (Date.now() + 3600_000),
      },
    }

    // JSONB merge inside SELECT FOR UPDATE transaction (Pitfall 3)
    await db.transaction(async (tx) => {
      // Upsert empty row first if missing (otherwise platform_config update no-ops)
      await tx
        .insert(settings)
        .values({ user_id: userId })
        .onConflictDoNothing({ target: settings.user_id })
      await tx.execute(sql`SELECT id FROM settings WHERE user_id = ${userId} FOR UPDATE`)
      await tx
        .update(settings)
        .set({
          platform_config: sql`COALESCE(${settings.platform_config}, '{}')::jsonb || ${JSON.stringify(youtubePatch)}::jsonb`,
          updated_at: sql`NOW()`,
        })
        .where(eq(settings.user_id, userId))
    })

    const appUrl = process.env.APP_URL ?? ''
    res.redirect(`${appUrl}/?screen=settings&connected=youtube`)
  } catch (err) {
    // Never expose internal error details (CLAUDE.md)
    console.error('[google oauth callback]', (err as Error).message)
    failRedirect(res, 'oauth_failed')
  }
})
