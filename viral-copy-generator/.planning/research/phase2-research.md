# Phase 2 Deep Research
**Settings + OAuth: AI provider config, API key encryption, Google + Meta OAuth connect/disconnect**

**Researched:** 2026-04-30
**Researched by:** gsd-researcher
**Packages verified against npm registry:** googleapis@171.4.0, google-auth-library@10.6.2, drizzle-orm@0.45.2

---

## Confirmed Approach (no changes needed)

### Q1 — Google OAuth 2.0 server-side flow: scopes, token shape, refresh

**Scope decision:** Use `https://www.googleapis.com/auth/youtube.upload` only. This is narrower than the full `youtube` scope, passes OAuth consent review faster, and is sufficient for Phase 6 upload. The full `youtube` scope (manage account) is not needed in Phase 2 or 6.

**Server-side flow — exact steps:**
1. Backend builds authorization URL with `response_type=code`, `access_type=offline`, `prompt=consent`, `scope=https://www.googleapis.com/auth/youtube.upload`, `state=<csrf-token>`, `redirect_uri=https://yourdomain/api/auth/google/callback`
2. Frontend opens URL via `window.open()` or full redirect (see COEP issue below)
3. Google redirects to callback with `?code=...&state=...`
4. Backend verifies state, POST-exchanges code at `https://oauth2.googleapis.com/token` with `grant_type=authorization_code`, `client_id`, `client_secret`, `redirect_uri`, `code`
5. Response contains `access_token` (1-hour lifetime), `refresh_token` (permanent until revoked), `expires_in`, `token_type=Bearer`
6. Backend encrypts both tokens and stores in `settings.platform_config.youtube`

**Critical parameter:** `access_type=offline` is REQUIRED to receive a refresh_token. Without it you get an access_token only (1-hour expiry, no refresh). `prompt=consent` forces the consent screen every time — required to guarantee a refresh token is returned even if the user previously authorized the app.

**Token storage shape:**
```json
{
  "youtube": {
    "access_token": "<encrypted>",
    "refresh_token": "<encrypted>",
    "expires_at": 1714500000000,
    "scope": "https://www.googleapis.com/auth/youtube.upload",
    "connected": true
  }
}
```

**Refresh token handling:** Refresh tokens never expire (unless revoked or user changes Google password). Use `google-auth-library` OAuth2Client `.refreshAccessToken()` to exchange a refresh_token for a new access_token. Check `expires_at` before each upload; refresh if within 5 minutes of expiry.

**Packages:**
```bash
npm install googleapis@171.4.0 google-auth-library@10.6.2
```

[VERIFIED: npm registry — googleapis@171.4.0, google-auth-library@10.6.2]
[CITED: developers.google.com/youtube/v3/guides/auth/server-side-web-apps]

---

### Q3 — Meta Instagram token lifetime and refresh

**Token flow (Instagram Direct Login, launched July 2024):**
1. OAuth returns a **short-lived token** (1-hour expiry)
2. Backend immediately exchanges it for a **long-lived token** (60-day expiry) via:
   ```
   GET https://graph.instagram.com/access_token
     ?grant_type=ig_exchange_token
     &client_secret=<APP_SECRET>
     &access_token=<SHORT_LIVED_TOKEN>
   ```
3. Response: `{ access_token, token_type, expires_in }` (expires_in is seconds, ~5183944 = 60 days)
4. Store long-lived token + `expires_at = now + expires_in * 1000`

**Refresh before expiry (MUST implement):**
```
GET https://graph.instagram.com/refresh_access_token
  ?grant_type=ig_refresh_token
  &access_token=<LONG_LIVED_TOKEN>
```
Rules: token must be at least 24 hours old AND not yet expired. Refreshed token is valid for another 60 days from refresh date.

**CRITICAL:** There is NO separate refresh token for Instagram. If the long-lived token expires without being refreshed, the user MUST re-authorize from scratch. Implement a BullMQ cron job that runs weekly and refreshes any token older than 24 hours. Missing the 60-day window = forced re-auth.

[CITED: developers.facebook.com/docs/instagram-platform/reference/refresh_access_token]

---

### Q5 — JSONB merge pattern in Drizzle (confirmed approach)

Drizzle's `.update().set()` replaces the entire column value. To merge a single key into `platform_config` without wiping other keys, use raw SQL with the PostgreSQL `||` jsonb merge operator:

```typescript
import { sql } from 'drizzle-orm'

// Merge youtube config into existing platform_config
await db
  .update(settings)
  .set({
    platform_config: sql`${settings.platform_config} || ${JSON.stringify({ youtube: youtubeData })}::jsonb`,
    updated_at: new Date(),
  })
  .where(eq(settings.id, SETTINGS_ID))
```

For concurrent writes (e.g., token refresh job running while user disconnects): wrap in a transaction with `FOR UPDATE`:
```typescript
await db.transaction(async (tx) => {
  const [row] = await tx
    .select()
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID))
    .for('update')

  await tx
    .update(settings)
    .set({
      platform_config: sql`${settings.platform_config} || ${JSON.stringify(patch)}::jsonb`,
      updated_at: new Date(),
    })
    .where(eq(settings.id, SETTINGS_ID))
})
```

[VERIFIED: drizzle-orm@0.45.2 docs — drizzle.team/docs/guides/upsert, drizzle.team/docs/update]

---

### Q8 — Settings persistence: upsert pattern

**Decision: single row with upsert.** There is exactly one settings row for this single-user tool. Use a fixed `id = 1` (or a constant `SETTINGS_ID`). Drizzle `onConflictDoUpdate` handles the upsert cleanly.

**Schema:**
```typescript
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  ai_provider: varchar('ai_provider', { length: 20 }),
  api_key_encrypted: text('api_key_encrypted'),
  api_key_iv: varchar('api_key_iv', { length: 32 }),   // 12-byte nonce as hex
  api_key_tag: varchar('api_key_tag', { length: 32 }),  // 16-byte auth tag as hex
  default_niche: varchar('default_niche', { length: 50 }),
  platform_config: jsonb('platform_config').default({}),
  updated_at: timestamp('updated_at').defaultNow(),
})
```

**Upsert pattern:**
```typescript
await db
  .insert(settings)
  .values({ id: 1, ai_provider, api_key_encrypted, ... })
  .onConflictDoUpdate({
    target: settings.id,
    set: { ai_provider, api_key_encrypted, updated_at: new Date() },
  })
```

[VERIFIED: drizzle-orm@0.45.2]

---

### Q7 — API key masking: where it happens

Masking happens in the **API response layer**, not in the DB query. The DB always stores and returns the full encrypted blob. The Express route decrypts the key server-side, then returns only `{ masked: '...sk-' + last4 }` to the frontend. Never decrypt and send the full key to the client.

**Pattern:**
```typescript
// GET /api/settings
const row = await db.select().from(settings).where(eq(settings.id, 1))
const decrypted = row.api_key_encrypted
  ? decrypt(row.api_key_encrypted, row.api_key_iv, row.api_key_tag)
  : null

return {
  ai_provider: row.ai_provider,
  api_key_masked: decrypted ? `${'*'.repeat(decrypted.length - 4)}${decrypted.slice(-4)}` : null,
  platform_config: {
    youtube: { connected: !!row.platform_config?.youtube?.connected },
    instagram: { connected: !!row.platform_config?.instagram?.connected },
    facebook: { connected: !!row.platform_config?.facebook?.connected },
  },
}
```

[ASSUMED] — pattern is standard, no official spec. Risk if wrong: low — masking in response layer is universal practice.

---

## Issues Found (must fix in plan)

### ISSUE-1 (BLOCKER): COOP `same-origin` breaks Google OAuth popup

**The conflict:** Phase 3 requires `COOP: same-origin` + `COEP: require-corp` for SharedArrayBuffer / ffmpeg.wasm. Phase 2 requires an OAuth popup (or redirect) that communicates back to the opener via `window.opener.postMessage()`. With `COOP: same-origin`, `window.opener` is null in the popup — the postMessage never arrives and the frontend never learns the OAuth completed.

**Status of `restrict-properties` fix:** Chrome 116+ experimental. Firefox: not supported as of 2025. Safari: not supported. This is not a viable cross-browser solution for production.

**Recommended fix — use the full redirect flow, not a popup:**

Instead of `window.open()`, use `window.location.href = oauthUrl`. The OAuth provider redirects back to `/api/auth/google/callback`, the backend processes the token, then redirects the browser back to `/?screen=settings&connected=youtube`. The frontend detects `?connected=youtube` in the URL on load, calls the settings API, and re-renders the connected badge.

This completely sidesteps the COOP/popup conflict and works in all browsers.

**Alternative if popup UX is preferred:** Use `COOP: same-origin-allow-popups` during the OAuth connect phase only (no COEP during that request), which means SharedArrayBuffer is not available on the Settings screen — acceptable since ffmpeg.wasm is only needed on the Analysis screen (Phase 3). Settings and Analysis are different screens in the useState switcher.

**Recommendation for Phase 2:** Use the full-redirect flow. It is simpler, requires zero COOP special-casing, and works in all browsers. The postMessage pattern is only needed for popup flows.

[CITED: developer.chrome.com/blog/coop-restrict-properties, MDN COOP docs, github.com/ffmpegwasm/ffmpeg.wasm/discussions/576]

---

### ISSUE-2 (CRITICAL FINDING): Meta Instagram — App Review is NOT required for a single developer posting to their own account

**Use Instagram Direct Login** (launched July 2024), not Facebook Login. This is the API path that does NOT require a Facebook Page connection.

**Exact permissions for Instagram Direct Login:**
- `instagram_business_basic` — required (basic profile)
- `instagram_business_content_publish` — required (post content)

**App Review requirement:**
- In **Development mode**, the developer (who has an Admin/Developer role in the Meta app) can grant any permission to their own account and use it without App Review. Posts to your own Instagram account work in Development mode without any review.
- App Review is only required to move to **Live mode** where other users (who are NOT admins/developers of the app) can authorize the app.
- Since this is a single-user personal tool where you are the admin, you NEVER need to switch to Live mode. Development mode is permanent for a personal tool.

**This removes the Phase 6 Meta upload blocker.** The earlier concern that `instagram_content_publish` requires App Review was based on the old Facebook Login flow. The new Instagram Direct Login flow (July 2024) does not require App Review for the developer's own account.

**Account type requirement:** Your Instagram account MUST be a Professional account (Business or Creator). Personal (consumer) accounts cannot use the Instagram Graph API. Switch your Instagram account to Creator mode in the Instagram app settings if not already done — it's free.

[CITED: gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc — Instagram Direct Login guide]
[CITED: developers.facebook.com/docs/development/build-and-test/app-roles — Development mode grants all permissions to app roles]
[CITED: developers.facebook.com/docs/instagram-platform/overview — Standard Access sufficient for own account]

---

### ISSUE-3 (FINDING): Facebook Reels requires a Facebook Page, not a personal profile

**Permissions for Facebook Reels (Facebook Login flow):**
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

**App Review status:** `pages_manage_posts` does NOT have standard access automatically — it requires App Review for Live mode. However, same rule applies as Instagram: in Development mode, as the app admin you can grant yourself this permission without App Review and post to your own Page.

**Requirement:** You MUST have a Facebook Page (not just a personal profile). Reels can only be posted to a Facebook Page, not a personal account. If you have a Facebook Page connected to your account, the Reels API will work in Development mode.

**Facebook Reels upload flow is different from Instagram:**
- Step 1: `POST /page-id/video_reels` with `upload_phase=start` on `graph.facebook.com`
- Step 2: Upload video binary to `POST https://rupload.facebook.com/video-upload/{video-id}`
- Step 3: `POST /page-id/video_reels` with `upload_phase=finish`, `video_state=PUBLISHED`, `video_id`

This is a 3-step flow (start → upload → finish), not the Instagram 2-step container flow. Plan must model them separately.

[CITED: developers.facebook.com/docs/video-api/guides/reels-publishing]

---

### ISSUE-4: Instagram token expires in 60 days with no refresh token fallback

If the long-lived Instagram token expires without being refreshed, the user must re-authorize manually. A BullMQ scheduled job MUST be implemented to refresh tokens weekly. This job should be included in Phase 2, not deferred to Phase 6.

**Refresh check logic:**
```typescript
const daysUntilExpiry = (token.expires_at - Date.now()) / (1000 * 60 * 60 * 24)
if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
  // Refresh the token
}
```

---

### ISSUE-5: AES-256-GCM — use 12-byte IV, not 16-byte

The Node.js crypto example in the Phase 1 research used a 16-byte IV. NIST recommends 12 bytes (96 bits) for AES-GCM. Using 16 bytes still works technically but is non-standard and less efficient. Use `randomBytes(12)` for the IV/nonce.

[CITED: NIST recommendation via cryptosys.net/pki — "12-byte nonce is standard for AES-GCM"]

---

## Implementation Notes (specific code patterns)

### AES-256-GCM API key encryption (corrected — 12-byte nonce)

```typescript
// packages/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LEN = 32    // 256 bits
const IV_LEN = 12     // 96 bits — NIST recommended for GCM
const TAG_LEN = 16    // 128-bit auth tag

function getKey(): Buffer {
  // Derive key from env — use a stable salt stored in env, not hardcoded
  return scryptSync(process.env.ENCRYPTION_KEY!, process.env.ENCRYPTION_SALT!, KEY_LEN)
}

export function encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  }
}

export function decrypt(encrypted: string, ivHex: string, tagHex: string): string {
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_LEN })
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}
```

Required env vars: `ENCRYPTION_KEY` (long random string), `ENCRYPTION_SALT` (separate random string, stable). Both stored server-side only, never in NEXT_PUBLIC_ or sent to client.

---

### Google OAuth server-side flow (full redirect, not popup)

```typescript
// backend/routes/auth/google.ts
import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI  // https://yourdomain/api/auth/google/callback
)

// Step 1: Initiate — GET /api/auth/google/connect
router.get('/connect', (req, res) => {
  const state = randomBytes(16).toString('hex')
  // Store state in a short-lived cookie or in-memory store (single user, so in-memory is fine)
  req.app.locals.oauthState = state
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',      // Required to always get refresh_token
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
    state,
  })
  res.redirect(url)  // Full redirect — not a popup
})

// Step 2: Callback — GET /api/auth/google/callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query

  if (error || state !== req.app.locals.oauthState) {
    return res.redirect('/?screen=settings&error=google_auth_failed')
  }

  const { tokens } = await oauth2Client.getToken(code as string)
  // tokens = { access_token, refresh_token, expiry_date, scope, token_type }

  const encryptedAccess = encrypt(tokens.access_token!)
  const encryptedRefresh = encrypt(tokens.refresh_token!)

  const youtubeConfig = {
    access_token: encryptedAccess.encrypted,
    access_iv: encryptedAccess.iv,
    access_tag: encryptedAccess.tag,
    refresh_token: encryptedRefresh.encrypted,
    refresh_iv: encryptedRefresh.iv,
    refresh_tag: encryptedRefresh.tag,
    expires_at: tokens.expiry_date,
    connected: true,
  }

  await db.update(settings).set({
    platform_config: sql`${settings.platform_config} || ${JSON.stringify({ youtube: youtubeConfig })}::jsonb`,
    updated_at: new Date(),
  }).where(eq(settings.id, 1))

  res.redirect('/?screen=settings&connected=youtube')
})
```

---

### Instagram Direct Login OAuth flow

```typescript
// Step 1: Initiate — GET /api/auth/instagram/connect
router.get('/connect', (req, res) => {
  const state = randomBytes(16).toString('hex')
  req.app.locals.instagramOauthState = state

  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    scope: 'instagram_business_basic,instagram_business_content_publish',
    response_type: 'code',
    state,
  })
  res.redirect(`https://api.instagram.com/oauth/authorize?${params}`)
})

// Step 2: Callback — GET /api/auth/instagram/callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query

  if (error || state !== req.app.locals.instagramOauthState) {
    return res.redirect('/?screen=settings&error=instagram_auth_failed')
  }

  // Exchange code for short-lived token
  const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
      code: code as string,
    }),
  })
  const { access_token: shortToken, user_id } = await tokenRes.json()

  // Exchange for long-lived token (60-day)
  const longRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortToken}`
  )
  const { access_token: longToken, expires_in } = await longRes.json()

  const encrypted = encrypt(longToken)
  const instagramConfig = {
    access_token: encrypted.encrypted,
    iv: encrypted.iv,
    tag: encrypted.tag,
    user_id,
    expires_at: Date.now() + expires_in * 1000,
    connected: true,
  }

  await db.update(settings).set({
    platform_config: sql`${settings.platform_config} || ${JSON.stringify({ instagram: instagramConfig })}::jsonb`,
    updated_at: new Date(),
  }).where(eq(settings.id, 1))

  res.redirect('/?screen=settings&connected=instagram')
})
```

---

### Token revocation on disconnect

**Google (YouTube):**
```typescript
// DELETE /api/auth/google/disconnect
router.delete('/disconnect', async (req, res) => {
  const row = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
  const cfg = row[0]?.platform_config?.youtube
  if (cfg?.access_token) {
    const accessToken = decrypt(cfg.access_token, cfg.access_iv, cfg.access_tag)
    // Revoking the access_token also revokes the refresh_token
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: accessToken }),
    })
  }
  // Clear from DB regardless of revoke success (token may already be expired)
  await db.update(settings).set({
    platform_config: sql`${settings.platform_config} - 'youtube'`,
    updated_at: new Date(),
  }).where(eq(settings.id, 1))
  res.json({ ok: true })
})
```

**Meta (Instagram / Facebook):**
```typescript
// DELETE /api/auth/meta/disconnect
router.delete('/disconnect', async (req, res) => {
  const row = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
  const cfg = row[0]?.platform_config?.instagram
  if (cfg?.access_token) {
    const accessToken = decrypt(cfg.access_token, cfg.iv, cfg.tag)
    const userId = cfg.user_id
    // DELETE /{user-id}/permissions — de-authorizes app and invalidates all user tokens
    await fetch(`https://graph.instagram.com/${userId}/permissions`, {
      method: 'DELETE',
      body: new URLSearchParams({ access_token: accessToken }),
    })
  }
  // Clear both instagram and facebook from DB
  await db.update(settings).set({
    platform_config: sql`(${settings.platform_config} - 'instagram') - 'facebook'`,
    updated_at: new Date(),
  }).where(eq(settings.id, 1))
  res.json({ ok: true })
})
```

Note: The Instagram Direct Login token and the Facebook Reels token come from different OAuth flows (different app setups). Single Meta login covering BOTH platforms only works if you use Facebook Login (which requires Facebook Page). If using Instagram Direct Login (recommended), you get Instagram access only. Facebook Reels requires a separate Facebook Login OAuth with `pages_manage_posts` scope. See ISSUE-3.

---

### Settings screen — handling OAuth redirect callback without a routing library

Since the app uses `useState` screen switching with no URL router, the frontend cannot "listen" to `/callback` routes. The backend OAuth callback redirects to `/?screen=settings&connected=youtube`. The frontend detects this on initial render:

```typescript
// App.tsx — top-level useEffect
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const connected = params.get('connected')
  const error = params.get('error')

  if (connected || error) {
    // Switch to settings screen
    setCurrentScreen('settings')
    // Clear query params from URL without reload
    window.history.replaceState({}, '', '/')
    // Refetch settings to get updated connected state
    refetchSettings()
    if (error) setSettingsError(`OAuth failed: ${error}`)
  }
}, [])
```

This pattern requires zero routing library and handles the redirect cleanly. The `refetchSettings()` call re-fetches `/api/settings` which now returns `connected: true` for the newly authorized platform.

---

### Instagram token refresh BullMQ job

```typescript
// jobs/refreshInstagramToken.ts
export async function refreshInstagramTokenIfNeeded(): Promise<void> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
  const cfg = row?.platform_config?.instagram
  if (!cfg?.connected) return

  const daysUntilExpiry = (cfg.expires_at - Date.now()) / (1000 * 60 * 60 * 24)
  if (daysUntilExpiry > 30) return  // Not yet needed
  if (daysUntilExpiry <= 0) {
    // Expired — mark as disconnected, user must re-auth
    await db.update(settings).set({
      platform_config: sql`jsonb_set(${settings.platform_config}, '{instagram,connected}', 'false')`,
      updated_at: new Date(),
    }).where(eq(settings.id, 1))
    return
  }

  const accessToken = decrypt(cfg.access_token, cfg.iv, cfg.tag)
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`
  )
  const { access_token: newToken, expires_in } = await res.json()
  const encrypted = encrypt(newToken)

  await db.update(settings).set({
    platform_config: sql`${settings.platform_config} || ${JSON.stringify({
      instagram: {
        ...cfg,
        access_token: encrypted.encrypted,
        iv: encrypted.iv,
        tag: encrypted.tag,
        expires_at: Date.now() + expires_in * 1000,
      }
    })}::jsonb`,
    updated_at: new Date(),
  }).where(eq(settings.id, 1))
}
```

Schedule in BullMQ: repeat every 7 days (`{ repeat: { every: 7 * 24 * 60 * 60 * 1000 } }`).

---

## Dependency Checklist (must be true before phase starts)

- [ ] Phase 1 complete: settings table exists in PostgreSQL, Drizzle migration applied, Express routes scaffold in place
- [ ] Google Cloud Console project created with YouTube Data API v3 enabled
- [ ] Google OAuth 2.0 credentials created (Web Application type), `https://yourdomain/api/auth/google/callback` in Authorized Redirect URIs
- [ ] Meta Developer account created, app created in Development mode with Instagram login product added
- [ ] Instagram account switched to Creator or Business mode (required for Graph API — personal accounts not supported)
- [ ] Meta app has `instagram_business_basic` and `instagram_business_content_publish` permissions configured
- [ ] If Facebook Reels needed: Facebook Developer app with Facebook Login product, `pages_manage_posts` + `pages_show_list` + `pages_read_engagement` permissions, and a Facebook Page (not personal profile)
- [ ] Environment variables set: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `ENCRYPTION_KEY`, `ENCRYPTION_SALT`
- [ ] COOP/COEP headers confirmed on Phase 1 backend (from Phase 1 checklist) — verify OAuth redirect flow does NOT require headers to be absent
- [ ] `googleapis@171.4.0` and `google-auth-library@10.6.2` added to backend package.json

---

## Estimated Risk

**Overall: MEDIUM**

| Area | Risk | Reason |
|------|------|--------|
| Google OAuth | LOW | Standard server-side flow with mature `googleapis` library. Full redirect avoids COOP issue entirely. |
| Instagram OAuth (own account) | LOW | Instagram Direct Login (July 2024) works without App Review for personal use. No external blocker. |
| Facebook Reels OAuth | MEDIUM | Requires a Facebook Page (not personal profile). If the user only has a personal Facebook account, Facebook Reels posting is blocked. Page creation is a 2-minute setup but it's a prerequisite that exists outside the codebase. |
| Meta App Review (Phase 6 blocker) | RESOLVED | Development mode is sufficient for single-user personal tool. App Review only needed if you let other users authorize the app. Phase 6 Meta upload is unblocked. |
| Instagram token expiry | MEDIUM | No refresh token fallback — 60-day window requires a scheduled BullMQ job in Phase 2. If omitted, user will need to reconnect every 60 days. |
| COOP/popup conflict | RESOLVED | Use full redirect flow. No popup needed. |
| AES-256-GCM | LOW | Built-in Node.js crypto, well-documented pattern. 20 lines of code. |
| JSONB merge | LOW | PostgreSQL `||` operator is stable; Drizzle `sql` template handles it cleanly. |

---

## Sources

### Primary (HIGH confidence)
- [CITED: developers.google.com/youtube/v3/guides/auth/server-side-web-apps] — Google OAuth server-side flow, scopes, access_type=offline
- [CITED: developers.google.com/identity/protocols/oauth2/web-server] — Token revoke endpoint, refresh endpoint
- [CITED: developers.facebook.com/docs/instagram-platform/reference/refresh_access_token] — Instagram token refresh endpoint and rules
- [CITED: gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc] — Instagram Direct Login guide (July 2024), no App Review for own account
- [CITED: developers.facebook.com/docs/development/build-and-test/app-roles] — Development mode grants all permissions to admins/developers
- [CITED: developers.facebook.com/docs/video-api/guides/reels-publishing] — Facebook Reels 3-step upload flow, permissions
- [CITED: developer.chrome.com/blog/coop-restrict-properties] — COOP restrict-properties Chrome-only status
- [VERIFIED: npm registry] — googleapis@171.4.0, google-auth-library@10.6.2, drizzle-orm@0.45.2
- [CITED: nodejs.org/api/crypto.html] — AES-256-GCM createCipheriv/createDecipheriv pattern
- [CITED: NIST via cryptosys.net] — 12-byte IV recommendation for AES-GCM

### Secondary (MEDIUM confidence)
- [CITED: drizzle.team/docs/guides/upsert] — onConflictDoUpdate pattern
- [CITED: developers.facebook.com/docs/facebook-login/guides/permissions/request-revoke] — DELETE /{user-id}/permissions revocation endpoint
- MDN Cross-Origin-Opener-Policy — COOP same-origin breaks popup, restrict-properties Chrome-only
- github.com/ffmpegwasm/ffmpeg.wasm/discussions/576 — confirmed COOP same-origin breaks cross-origin resources

### Tertiary (LOW confidence — verify before coding)
- [ASSUMED] API key masking at response layer (universal pattern, no official spec)
- [ASSUMED] BullMQ weekly repeat syntax — verify against BullMQ 5.x docs before implementing the token refresh job
