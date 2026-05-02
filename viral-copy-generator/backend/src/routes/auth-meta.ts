import { Router, type Request, type Response } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings, type PlatformConfig } from '../db/schema.js'
import { encrypt } from '../lib/encryption.js'
import { createOAuthState, consumeOAuthState } from '../lib/oauth-state.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  buildInstagramAuthUrl,
  buildFacebookAuthUrl,
  exchangeInstagramCode,
  exchangeFacebookCode,
} from '../lib/oauth-meta.js'

export const authMetaRouter = Router()

// Redirect target on failure (research Pitfall 8)
function failRedirect(res: Response, reason: string): void {
  const appUrl = process.env.APP_URL ?? ''
  res.redirect(`${appUrl}/?screen=settings&error=${encodeURIComponent(reason)}`)
}

// JSONB-merge a partial PlatformConfig into the settings row.
// SELECT FOR UPDATE inside a transaction prevents concurrent writes racing (Pitfall 3).
async function mergePlatformConfig(userId: string, patch: Partial<PlatformConfig>): Promise<void> {
  await db.transaction(async (tx) => {
    // Upsert empty row first so the update below doesn't no-op on a missing row
    await tx.insert(settings).values({ user_id: userId }).onConflictDoNothing({ target: settings.user_id })
    await tx.execute(sql`SELECT id FROM settings WHERE user_id = ${userId} FOR UPDATE`)
    await tx
      .update(settings)
      .set({
        platform_config: sql`COALESCE(${settings.platform_config}, '{}')::jsonb || ${JSON.stringify(patch)}::jsonb`,
        updated_at: sql`NOW()`,
      })
      .where(eq(settings.user_id, userId))
  })
}

// ── Instagram Login flow (SETTINGS-05) ────────────────────────────────────

// /connect returns JSON { auth_url } (NOT 302) — see app.ts note on OAuth routing:
// CORS hides the Location header on cross-origin opaqueredirect responses from XHR.
// The frontend reads JSON and calls window.location.assign(auth_url) for the full-page redirect.
// Per-route authMiddleware here: this router is mounted before app.use('/api', authMiddleware)
// so that /callback can accept Meta's redirect (no Bearer token). /connect still requires auth.
authMetaRouter.get('/instagram/connect', authMiddleware, (_req: Request, res: Response) => {
  const userId = res.locals['userId'] as string
  const state = createOAuthState(userId)
  const auth_url = buildInstagramAuthUrl(state)
  res.json({ auth_url })
})

// Callback: validate state (CSRF), exchange code, preflight account_type, encrypt + JSONB-merge.
// No auth required: Meta's browser redirect carries no Bearer token.
// CSRF: state param is single-use and binds to the userId from /connect.
authMetaRouter.get('/instagram/callback', async (req: Request, res: Response) => {
  const code = typeof req.query['code'] === 'string' ? req.query['code'] : ''
  const state = typeof req.query['state'] === 'string' ? req.query['state'] : ''

  if (req.query['error']) {
    failRedirect(res, String(req.query['error']))
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
    const conn = await exchangeInstagramCode(code)

    // Pitfall 4: PERSONAL accounts cannot publish. Reject BEFORE storing the token.
    if (conn.accountType === 'PERSONAL') {
      failRedirect(res, 'instagram_personal_account')
      return
    }

    const expiry = Date.now() + conn.expiresIn * 1000
    await mergePlatformConfig(userId, {
      instagram: {
        access_token: encrypt(conn.longLivedToken),
        expiry,
      },
    })

    const appUrl = process.env.APP_URL ?? ''
    res.redirect(`${appUrl}/?screen=settings&connected=instagram`)
  } catch (err) {
    // Never expose internal error details (CLAUDE.md)
    console.error('[instagram callback]', (err as Error).message)
    failRedirect(res, 'oauth_failed')
  }
})

// ── Facebook Login for Business flow (SETTINGS-06) ─────────────────────────

// /connect returns JSON { auth_url } — same CORS rationale as /instagram/connect.
authMetaRouter.get('/facebook/connect', authMiddleware, (_req: Request, res: Response) => {
  const userId = res.locals['userId'] as string
  const state = createOAuthState(userId)
  const auth_url = buildFacebookAuthUrl(state)
  res.json({ auth_url })
})

// Callback: validate state (CSRF), exchange code, fetch /me/accounts, select CREATE_CONTENT page.
// If no qualifying page: store { setup_required: true } — UI surfaces "Create Page" CTA.
// No auth required: Facebook's browser redirect carries no Bearer token.
authMetaRouter.get('/facebook/callback', async (req: Request, res: Response) => {
  const code = typeof req.query['code'] === 'string' ? req.query['code'] : ''
  const state = typeof req.query['state'] === 'string' ? req.query['state'] : ''

  if (req.query['error']) {
    failRedirect(res, String(req.query['error']))
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
    const conn = await exchangeFacebookCode(code)

    if (!conn.page) {
      // Open Question 1: no qualifying Page → store setup_required flag so the UI can surface
      // a "Create a Facebook Page" CTA rather than failing the entire connection.
      // PlatformConfig.facebook now includes a { setup_required: true } variant in schema.ts
      // (widened in 02-04 Step 0) — no as-unknown cast needed (CLAUDE.md rule 9).
      const patch: Partial<PlatformConfig> = { facebook: { setup_required: true } }
      await mergePlatformConfig(userId, patch)
      const appUrl = process.env.APP_URL ?? ''
      res.redirect(`${appUrl}/?screen=settings&connected=facebook&warning=no_facebook_page`)
      return
    }

    const expiry = Date.now() + 60 * 24 * 3600 * 1000  // 60-day page_access_token; refresh job covers Instagram only
    await mergePlatformConfig(userId, {
      facebook: {
        access_token: encrypt(conn.page.access_token),
        page_id: conn.page.id,
        expiry,
      },
    })

    const appUrl = process.env.APP_URL ?? ''
    res.redirect(`${appUrl}/?screen=settings&connected=facebook`)
  } catch (err) {
    // Never expose internal error details (CLAUDE.md)
    console.error('[facebook callback]', (err as Error).message)
    failRedirect(res, 'oauth_failed')
  }
})
