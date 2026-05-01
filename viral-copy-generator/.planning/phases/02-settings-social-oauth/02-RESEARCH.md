# Phase 2: Settings + Social OAuth — Research

**Researched:** 2026-05-01
**Domain:** OAuth 2.0 (Google/Meta), AES-256-GCM encryption, pg-boss scheduling, Drizzle JSONB, React URL-param handling
**Confidence:** HIGH

---

## Summary

Phase 2 builds on the complete Phase 1 auth foundation (Express + Supabase JWT + Drizzle schema + pg-boss). The settings table already exists in the DB with `api_key_encrypted`, `platform_config JSONB`, `enabled_platforms TEXT[]`, `default_niche`, and `learned_weights`. No schema migration is needed — all required columns are present.

The phase has three independent capability areas: (1) AES-256-GCM API key encryption using Node.js built-in `crypto`, (2) Google OAuth for YouTube via the `googleapis` package, and (3) Meta OAuth for Instagram + Facebook via raw HTTP — two separate OAuth paths that must coexist in the same Meta app. A critical architectural finding: Instagram Reels publishing uses the Instagram Login path (`instagram_business_basic + instagram_business_content_publish`) targeting `graph.instagram.com`, while Facebook Reels requires Facebook Login for Business (`pages_show_list + pages_manage_posts + pages_read_engagement`) targeting `graph.facebook.com` with a page_access_token. These are architecturally distinct flows, not a single combined Meta OAuth.

The COOP/COEP constraint (same-origin) eliminates popup OAuth — all OAuth must use server-side redirect with URL parameter feedback to the frontend. The frontend's current `useState` screen-switching pattern (no routing library) means the OAuth callback data must be passed as URL query params and read in a `useEffect` on the settings screen.

**Primary recommendation:** Implement the two Meta flows as separate `GET /api/auth/instagram` and `GET /api/auth/facebook` initiation routes; share the same Meta app credentials but request different scopes. Store state tokens in a short-lived in-memory Map (keyed by random UUID, 10-min TTL) — no session middleware needed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AES-256-GCM encrypt/decrypt | Backend | — | Keys never leave server; decrypted key never sent to client |
| Settings CRUD (GET/POST) | Backend API | — | DB access, decryption, masking all server-side |
| Google OAuth initiation + callback | Backend API | — | client_secret never in browser; tokens stored backend-only |
| Meta Instagram OAuth initiation + callback | Backend API | — | client_secret + token exchange server-side only |
| Meta Facebook OAuth initiation + callback | Backend API | — | page_access_token backend-only; page_id safe to surface |
| OAuth state CSRF protection | Backend API | — | State stored in server-side Map; validated on callback |
| Weekly Meta token refresh job | Backend (pg-boss) | — | Runs server-side on schedule, no user involvement |
| Settings screen UI | Frontend | — | Form rendering, connect/disconnect buttons, status badges |
| OAuth redirect result detection | Frontend | — | useEffect reads URL params, strips them, refetches settings |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETTINGS-01 | AI provider selection + encrypted API key (AES-256-GCM per user, not localStorage) | `crypto.scryptSync` + `createCipheriv('aes-256-gcm')` pattern verified; return `{ masked: '****last4' }` |
| SETTINGS-02 | Default niche selection | Simple `PATCH /api/settings` updating `default_niche` column; already in schema |
| SETTINGS-03 | Platform toggles (YouTube / Instagram / Facebook / TikTok / X) | `enabled_platforms TEXT[]` column in settings table; JSONB merge pattern not needed for this field |
| SETTINGS-04 | YouTube via Google OAuth 2.0 — server-side redirect; tokens backend-only | `googleapis` OAuth2Client: `generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope })` |
| SETTINGS-05 | Instagram + Facebook via Meta Instagram Login (2025 scopes) | Instagram Login path: `https://api.instagram.com/oauth/authorize` with `instagram_business_basic,instagram_business_content_publish` |
| SETTINGS-06 | page_id + page_access_token from GET /me/accounts for Facebook Reels | Requires separate Facebook Login path (not Instagram Login); `GET https://graph.facebook.com/{user-id}/accounts` |
| SETTINGS-07 | Weekly pg-boss job refreshes 60-day Meta long-lived token | pg-boss v12 `createQueue` + `schedule('0 9 * * 1', {})` + `work(...)` pattern (same as Phase 1 cleanup job) |
| SETTINGS-08 | TikTok greyed out "Pending API approval" | Frontend-only: disabled input + label; no backend work required |
| SETTINGS-09 | Disconnect platform — token revoked, cleared from DB | `PATCH /api/settings` with JSONB merge setting platform key to `null`; call provider revoke endpoint |
| SETTINGS-10 | Timezone fixed to PKT (UTC+5) | Backend: use `Asia/Karachi` in all date formatting; frontend: display-only, no user config |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` (built-in) | Node 24 (built-in) | AES-256-GCM encryption/decryption | Zero dependency; FIPS-compliant; `scryptSync` + `randomBytes` built-in |
| `googleapis` | 171.4.0 [VERIFIED: npm view] | Google OAuth2Client + YouTube API calls | Official Google client; handles token refresh automatically |
| Native `fetch` (Node 24) | Node 24 built-in | Meta OAuth token exchange HTTP calls | No additional http client needed; already used in project |
| `pg-boss` | 12.18.1 [VERIFIED: codebase] | Weekly Meta token refresh scheduled job | Already installed and running; same pattern as Phase 1 cleanup job |
| `drizzle-orm` | 0.45.2 [VERIFIED: codebase] | JSONB partial update via `sql` helper | Already installed; `||` merge operator via `sql` tag |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomBytes` | Node built-in | CSRF state token generation | Every OAuth initiation — generate 32-byte hex state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `googleapis` OAuth2Client | Raw fetch to Google OAuth endpoints | googleapis handles token refresh, scope validation, and type-safety; raw fetch is more work for no benefit here |
| In-memory Map for OAuth state | `express-session` + PostgreSQL session store | In-memory is simpler (no extra dependency); acceptable because state TTL is 10 minutes and state is ephemeral; would lose state on server restart (acceptable edge case — user retries OAuth) |
| Separate Meta app per flow | Single Meta app with both Instagram + Facebook Login | Single app is correct — Meta supports both product configurations on the same app |

**Installation (new packages only):**
```bash
cd backend && npm install googleapis
```

**Version verification:** `npm view googleapis version` → `171.4.0` (verified 2026-05-01).
All other dependencies already installed in `backend/package.json`.

---

## Architecture Patterns

### System Architecture Diagram

```
Settings Screen (Frontend)
  │
  ├─► GET /api/settings ──────────────────────► DB SELECT (settings by user_id, RLS)
  │                                              Decrypt API key → return { masked: '****last4' }
  │
  ├─► POST /api/settings (save AI key)          Encrypt key (AES-256-GCM) → DB UPSERT
  │
  ├─► GET /api/auth/google/connect ──────────► Generate state → store in Map (10-min TTL)
  │                                              Redirect → Google OAuth consent screen
  │
  │   Google redirects → GET /api/auth/google/callback?code=...&state=...
  │                                              Validate state → exchange code for tokens
  │                                              Encrypt access+refresh tokens → DB JSONB patch
  │                                              Redirect → /?screen=settings&connected=youtube
  │
  ├─► GET /api/auth/instagram/connect ───────► Generate state → store in Map (10-min TTL)
  │                                              Redirect → https://api.instagram.com/oauth/authorize
  │
  │   Instagram redirects → GET /api/auth/instagram/callback?code=...
  │                                              Exchange code → short-lived token (1h)
  │                                              Exchange short-lived → long-lived token (60 days)
  │                                              GET https://graph.instagram.com/me (account type check)
  │                                              Encrypt long-lived token → DB JSONB patch
  │                                              Redirect → /?screen=settings&connected=instagram
  │
  ├─► GET /api/auth/facebook/connect ────────► Generate state → store in Map (10-min TTL)
  │                                              Redirect → https://www.facebook.com/v22.0/dialog/oauth
  │
  │   Facebook redirects → GET /api/auth/facebook/callback?code=...
  │                                              Exchange code → short-lived user token
  │                                              GET /me/accounts → page_id + page_access_token
  │                                              Encrypt page_access_token → DB JSONB patch
  │                                              Redirect → /?screen=settings&connected=facebook
  │
  └─► DELETE /api/auth/{platform}/disconnect   Revoke token at provider → DB JSONB patch (null)

pg-boss weekly job (0 9 * * 1):
  'meta-token-refresh'
  └─► For each user with instagram token:
        GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...
        Re-encrypt new token → DB UPDATE
```

### Recommended Project Structure (additions to existing)
```
backend/src/
  lib/
    encryption.ts        — AES-256-GCM encrypt/decrypt functions
    oauth.ts             — Google + Meta token refresh helpers (used in Phase 6)
  routes/
    settings.ts          — GET/PATCH /api/settings
    auth.ts              — OAuth initiation + callback handlers for all providers
  
frontend/src/
  pages/
    SettingsPage.tsx     — Settings screen (AI key, niche, platforms, OAuth buttons)
  lib/
    api.ts               — (existing, extend with settings endpoints)
```

### Pattern 1: AES-256-GCM Encrypt/Decrypt
**What:** Symmetric authenticated encryption for storing API keys and OAuth tokens
**When to use:** Any secret stored in DB (api_key_encrypted, platform_config tokens)
**CLAUDE.md requirement:** `randomBytes(12)` IV, `scryptSync` key derivation

```typescript
// Source: Node.js crypto docs (https://nodejs.org/api/crypto.html)
// backend/src/lib/encryption.ts
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SALT_LEN = 16   // bytes — stored with cipher text
const IV_LEN = 12     // bytes — 96-bit NIST standard for GCM (CLAUDE.md)
const KEY_LEN = 32    // bytes — 256 bits
const TAG_LEN = 16    // bytes — GCM auth tag

// Master key from env: ENCRYPTION_KEY must be >=32 chars
function getMasterKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) throw new Error('ENCRYPTION_KEY missing or too short')
  return key
}

export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = scryptSync(getMasterKey(), salt, KEY_LEN)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Layout: [salt(16)] [iv(12)] [tag(16)] [ciphertext]
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const salt = buf.subarray(0, SALT_LEN)
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
  const data = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN)
  const key = scryptSync(getMasterKey(), salt, KEY_LEN)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8')
}
```

**Key masking (CLAUDE.md requirement):**
```typescript
// NEVER return decrypted key to client — return masked form only
function maskKey(decrypted: string): string {
  return `****${decrypted.slice(-4)}`
}
```

### Pattern 2: Google OAuth2Client Server-Side Flow
**What:** googleapis OAuth2Client for YouTube authorization
**When to use:** YouTube connect flow
**Scopes required:** `https://www.googleapis.com/auth/youtube.upload` + `https://www.googleapis.com/auth/youtube.readonly`

```typescript
// Source: Google OAuth2 docs (https://developers.google.com/identity/protocols/oauth2/web-server)
// backend/src/routes/auth.ts (Google section)
import { google } from 'googleapis'

function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/auth/google/callback`,  // exact match required
  )
}

// Initiation: GET /api/auth/google/connect
const oauth2Client = getGoogleOAuthClient()
const state = randomBytes(32).toString('hex')
oauthStateMap.set(state, { userId: res.locals.userId, expires: Date.now() + 10 * 60_000 })

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',       // required for refresh token
  prompt: 'consent',            // required to get refresh_token on every connect
  scope: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
  ],
  state,
  include_granted_scopes: true,
})
res.redirect(authUrl)

// Callback: GET /api/auth/google/callback?code=...&state=...
const stateEntry = oauthStateMap.get(state)
// validate stateEntry exists + not expired + delete after use (prevent replay)
oauthStateMap.delete(state)
const { tokens } = await oauth2Client.getToken(code)
// tokens.access_token, tokens.refresh_token, tokens.expiry_date
// Encrypt both tokens before storing
```

### Pattern 3: Meta Instagram Login OAuth Flow
**What:** Instagram Login path for Instagram Reels publishing
**When to use:** Connect Instagram account
**Authorization URL:** `https://api.instagram.com/oauth/authorize`
**Scopes (2025):** `instagram_business_basic,instagram_business_content_publish`

```typescript
// Source: Meta Instagram Login docs
// (https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/)

// Step 1: Redirect to Instagram
const instagramAuthUrl = new URL('https://api.instagram.com/oauth/authorize')
instagramAuthUrl.searchParams.set('client_id', process.env.META_APP_ID!)
instagramAuthUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/auth/instagram/callback`)
instagramAuthUrl.searchParams.set('response_type', 'code')
instagramAuthUrl.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish')
instagramAuthUrl.searchParams.set('state', state)

// Step 2: Exchange auth code for short-lived token
// NOTE: strip trailing '#_' from code param (Meta appends this — confirmed in docs)
const cleanCode = code.replace(/#_$/, '')
const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: `${process.env.APP_URL}/api/auth/instagram/callback`,
    code: cleanCode,
  }),
})
const { access_token: shortLived } = await tokenResponse.json()

// Step 3: Exchange short-lived (1h) for long-lived (60 days)
const longLivedUrl = new URL('https://graph.instagram.com/access_token')
longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token')
longLivedUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!)
longLivedUrl.searchParams.set('access_token', shortLived)
const { access_token: longLived, expires_in } = await (await fetch(longLivedUrl)).json()

// Step 4: Check account type (pre-flight — requires Creator or Business)
const profile = await (await fetch(
  `https://graph.instagram.com/me?fields=account_type,username&access_token=${longLived}`
)).json()
// profile.account_type: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL'
// If PERSONAL → surface setup instructions, do not store token

// Step 5: Encrypt + store in platform_config.instagram
```

### Pattern 4: Meta Facebook Login for Business (Facebook Reels)
**What:** Facebook Login path for page_id + page_access_token (Facebook Reels)
**When to use:** Connect Facebook Page for Facebook Reels
**Authorization URL:** `https://www.facebook.com/v22.0/dialog/oauth`
**Scopes:** `pages_show_list,pages_manage_posts,pages_read_engagement`

```typescript
// Source: Meta Graph API docs — Facebook Login for Business
// (https://developers.facebook.com/docs/facebook-login/guides/access-tokens/)

// Step 1: Redirect to Facebook
const facebookAuthUrl = new URL('https://www.facebook.com/v22.0/dialog/oauth')
facebookAuthUrl.searchParams.set('client_id', process.env.META_APP_ID!)
facebookAuthUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/auth/facebook/callback`)
facebookAuthUrl.searchParams.set('response_type', 'code')
facebookAuthUrl.searchParams.set('scope', 'pages_show_list,pages_manage_posts,pages_read_engagement')
facebookAuthUrl.searchParams.set('state', state)

// Step 2: Exchange code for user access token
const tokenRes = await fetch(
  `https://graph.facebook.com/v22.0/oauth/access_token?` +
  new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: `${process.env.APP_URL}/api/auth/facebook/callback`,
    code,
  }),
)
const { access_token: userToken } = await tokenRes.json()

// Step 3: GET /me/accounts to retrieve page list + page access tokens
const accountsRes = await fetch(
  `https://graph.facebook.com/v22.0/me/accounts?access_token=${userToken}`
)
const { data: pages } = await accountsRes.json()
// pages[0]: { id, name, access_token (page_access_token), category, tasks }
// User must have exactly one page with CREATE_CONTENT task
// If no pages found → surface "Facebook Page required" pre-flight warning in frontend

// Step 4: Store first qualifying page
const page = pages.find((p: { tasks: string[] }) => p.tasks?.includes('CREATE_CONTENT'))
// Encrypt page.access_token → store in platform_config.facebook
```

### Pattern 5: JSONB Partial Update (Drizzle + PostgreSQL)
**What:** Merge platform_config patch without replacing whole column
**When to use:** Updating one platform's tokens without overwriting others
**Critical note:** ROADMAP specifies `SELECT FOR UPDATE` transaction

```typescript
// Source: Drizzle ORM community pattern + ROADMAP spec
// (https://maxleiter.com/notes/updating-jsonb-drizzle)
import { sql, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'

export async function patchPlatformConfig(
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await db.transaction(async (tx) => {
    // SELECT FOR UPDATE — prevent concurrent writes corrupting JSONB
    await tx.execute(
      sql`SELECT id FROM settings WHERE user_id = ${userId} FOR UPDATE`
    )
    await tx
      .update(settings)
      .set({
        platform_config: sql`COALESCE(${settings.platform_config}, '{}')::jsonb || ${JSON.stringify(patch)}::jsonb`,
        updated_at: sql`NOW()`,
      })
      .where(eq(settings.user_id, userId))
  })
}
```

### Pattern 6: OAuth State CSRF Protection (In-Memory Map)
**What:** Store ephemeral OAuth state without session middleware
**When to use:** All three OAuth initiation flows

```typescript
// Source: ASSUMED pattern based on standard OAuth CSRF protection
// In-memory state store (per-process, TTL-enforced)
interface OAuthState {
  userId: string
  expires: number
}
const oauthStateMap = new Map<string, OAuthState>()

export function createOAuthState(userId: string): string {
  const state = randomBytes(32).toString('hex')
  oauthStateMap.set(state, { userId, expires: Date.now() + 10 * 60_000 })
  return state
}

export function consumeOAuthState(state: string): string | null {
  const entry = oauthStateMap.get(state)
  oauthStateMap.delete(state)  // single-use
  if (!entry || Date.now() > entry.expires) return null
  return entry.userId
}
```

### Pattern 7: Weekly Meta Token Refresh Job (pg-boss v12)
**What:** pg-boss scheduled job refreshing 60-day Meta long-lived token
**When to use:** Token refresh — ROADMAP spec `0 9 * * 1` (Mondays 9AM UTC)

```typescript
// Source: pg-boss v12 pattern (established in Phase 1 boss.ts)
// [VERIFIED: codebase — see backend/src/lib/boss.ts]
export async function registerMetaTokenRefreshJob(bossInstance: PgBoss): Promise<void> {
  await bossInstance.createQueue('meta-token-refresh')
  try {
    await bossInstance.schedule('meta-token-refresh', '0 9 * * 1', {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  await bossInstance.work('meta-token-refresh', async (_job) => {
    // Query all users with instagram access_token in platform_config
    // For each: GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...
    // Re-encrypt + store updated token + new expiry
    // NOTE: No refresh token for Meta — if token expired, user must re-auth
  })
}
```

### Pattern 8: Frontend OAuth Redirect Result Detection
**What:** Read `?screen=settings&connected=youtube` URL param in useEffect after OAuth redirect
**When to use:** App.tsx or SettingsPage.tsx mount

```typescript
// Source: ASSUMED — standard URLSearchParams pattern (no routing library)
// App.tsx screen switcher extended for Phase 2
type Screen = 'generator' | 'settings' | 'history' | 'research'

// In App.tsx (or SettingsPage.tsx for local concerns):
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const screen = params.get('screen') as Screen | null
  const connected = params.get('connected') // 'youtube' | 'instagram' | 'facebook' | null

  if (screen) {
    setCurrentScreen(screen)
  }
  if (connected) {
    // Trigger settings refetch to show new 'Connected ✓' badge
    // Strip params from URL so refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname)
  }
}, [])
```

### Anti-Patterns to Avoid
- **OAuth in popup:** COOP `same-origin` kills `window.opener` — use redirect flow only. [VERIFIED: CLAUDE.md]
- **Storing tokens in localStorage:** All OAuth tokens backend-only in DB. [VERIFIED: CLAUDE.md]
- **Direct DB token storage without encryption:** `platform_config` tokens MUST be AES-256-GCM encrypted before write. [VERIFIED: schema.ts security comment]
- **Single Meta OAuth flow for both Instagram + Facebook:** Instagram Login and Facebook Login are architecturally distinct paths; cannot combine into one redirect. [VERIFIED: Meta docs research]
- **prompt=consent omission for Google:** Without `prompt: 'consent'`, Google only returns `refresh_token` on the *first* authorization. Re-connecting without this means no refresh token. [VERIFIED: Google docs]
- **Using `instagram_basic` scope:** Deprecated January 27, 2025. Must use `instagram_business_basic`. [VERIFIED: Meta docs]
- **Meta token exchange without stripping `#_`:** The authorization code redirect appends `#_` — must strip before token exchange. [CITED: developers.facebook.com/docs/instagram-platform/reference/oauth-authorize/]
- **JSONB full-column replacement:** Never `SET platform_config = ${JSON.stringify(full)}` — use merge operator to preserve other platforms' tokens. [VERIFIED: ROADMAP + Drizzle pattern]
- **Using `drizzle-kit push`:** Silently drops RLS policies. Use `generate + migrate` only. [VERIFIED: Phase 1 SUMMARY, CLAUDE.md]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube token exchange + refresh | Manual fetch to Google token endpoint | `googleapis` OAuth2Client | Handles token refresh, expiry, scope validation, type-safety automatically |
| AES key derivation | Iteration-count PBKDF2 or direct password | `crypto.scryptSync` | scrypt is memory-hard (brute-force resistant), NIST-recommended for key derivation |
| GCM authentication verification | Manual tag comparison | `decipher.setAuthTag()` + Node.js built-in | Built-in handles constant-time comparison; manual is vulnerable to timing attacks |
| OAuth CSRF state storage | Redis or PostgreSQL sessions | In-memory Map with TTL | State is ephemeral (10-min window); in-memory is simpler and sufficient for single-process VPS |

**Key insight:** The `googleapis` package is the only new dependency needed. All cryptographic primitives (AES-256-GCM, scryptSync, randomBytes) are in Node.js built-in `crypto` at zero cost.

---

## Common Pitfalls

### Pitfall 1: Meta Code Trailing `#_`
**What goes wrong:** Token exchange fails with "Invalid Code" error.
**Why it happens:** Instagram appends `#_` to the redirect URI code parameter. `req.query.code` includes it.
**How to avoid:** `const cleanCode = (req.query.code as string).replace(/#_$/, '')`
**Warning signs:** 400 response from `https://api.instagram.com/oauth/access_token` with error code 100.

### Pitfall 2: Google Refresh Token Only Returned Once
**What goes wrong:** Re-connecting YouTube shows no refresh token in second auth.
**Why it happens:** Google only returns `refresh_token` on the very first `access_type=offline` authorization per app+user combination.
**How to avoid:** Always include `prompt: 'consent'` to force the consent screen (and guarantee refresh token issuance).
**Warning signs:** `tokens.refresh_token` is `undefined` or `null` after second connect.

### Pitfall 3: JSONB Concurrent Write Race
**What goes wrong:** Two simultaneous JSONB patches overwrite each other.
**Why it happens:** Read-modify-write is not atomic without locking.
**How to avoid:** Wrap JSONB patch in `db.transaction()` with `SELECT FOR UPDATE`.
**Warning signs:** Occasional platform connection status disappearing after rapid settings changes.

### Pitfall 4: Instagram Account Type Pre-Flight Skip
**What goes wrong:** Token stored for a PERSONAL Instagram account; content publishing fails in Phase 6.
**Why it happens:** Instagram Login works for any account type; only Creator/Business can publish.
**How to avoid:** After getting long-lived token, call `GET /me?fields=account_type` and reject if `account_type === 'PERSONAL'`.
**Warning signs:** Phase 6 `POST /{ig-user-id}/media` returns permission error.

### Pitfall 5: pg-boss Duplicate Schedule on Restart
**What goes wrong:** Server restart throws `duplicate key` from `boss.schedule()`.
**Why it happens:** `schedule()` inserts a row; calling it again on restart is duplicate.
**How to avoid:** Wrap in try/catch and ignore `duplicate` / `unique` errors — exact pattern from Phase 1 `registerCleanupJob`.
**Warning signs:** Server fails to start on restart.

### Pitfall 6: Meta Token Expiry on Refresh Job Miss
**What goes wrong:** pg-boss job fails silently; Meta token expires at 60 days; uploads fail in Phase 6.
**Why it happens:** Unlike Google OAuth, Meta long-lived tokens have NO refresh token — missed window requires user re-auth.
**How to avoid:** Refresh weekly (60-day token with 7-day refresh cadence gives 8.5x safety margin). Log failures with user_id for admin visibility.
**Warning signs:** Phase 6 Meta upload returns 190 error code (OAuth token invalid).

### Pitfall 7: Missing `ENCRYPTION_KEY` in Env
**What goes wrong:** Encryption throws at runtime on first API key save.
**Why it happens:** `process.env.ENCRYPTION_KEY` not added to `.env`.
**How to avoid:** Add to required env var check in `backend/src/index.ts` startup validation. Add to `.env.example`.
**Warning signs:** 500 error on POST /api/settings.

### Pitfall 8: OAuth State Lost on Server Restart
**What goes wrong:** User clicks "Connect YouTube", server restarts mid-flow, callback returns 400 (state not found).
**Why it happens:** In-memory Map is wiped on restart.
**How to avoid:** Return `/?screen=settings&error=oauth_failed` from callback if state not found; frontend shows "Connection failed — please try again." This is acceptable behavior for the in-memory approach.
**Warning signs:** User reports OAuth never completes after server restart.

### Pitfall 9: Facebook Reels Requires Separate OAuth Flow
**What goes wrong:** Assuming Instagram Login also provides `page_access_token` for Facebook Reels.
**Why it happens:** The two paths are architecturally distinct; Instagram Login uses `graph.instagram.com` and does not yield page tokens.
**How to avoid:** Implement two separate Meta connect buttons: "Connect Instagram" (Instagram Login path) and "Connect Facebook" (Facebook Login for Business path).
**Warning signs:** `GET /me/accounts` called with an Instagram Login token returns empty or errors.

---

## Code Examples

### Settings GET endpoint pattern
```typescript
// Source: ASSUMED — based on Phase 1 auth patterns + CLAUDE.md masking rule
// GET /api/settings
export async function getSettings(req: Request, res: Response): Promise<void> {
  const userId = res.locals.userId as string
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.user_id, userId))
    .limit(1)
  
  if (!rows[0]) {
    // First-time user: return defaults (no DB row yet)
    res.json({ ai_provider: 'gemini', api_key_masked: null, ... })
    return
  }
  
  const row = rows[0]
  const api_key_masked = row.api_key_encrypted
    ? `****${decrypt(row.api_key_encrypted).slice(-4)}`
    : null
  
  res.json({
    ai_provider: row.ai_provider,
    api_key_masked,
    default_niche: row.default_niche,
    enabled_platforms: row.enabled_platforms,
    // platform_config: return connection status only, NEVER tokens
    connected: {
      youtube: !!(row.platform_config as PlatformConfig)?.youtube,
      instagram: !!(row.platform_config as PlatformConfig)?.instagram,
      facebook: !!(row.platform_config as PlatformConfig)?.facebook,
    }
  })
}
```

### Settings UPSERT pattern
```typescript
// Source: ASSUMED — ON CONFLICT pattern from ROADMAP spec
await db
  .insert(settings)
  .values({
    user_id: userId,
    ai_provider: body.ai_provider,
    api_key_encrypted: body.api_key ? encrypt(body.api_key) : null,
    // ...
  })
  .onConflictDoUpdate({
    target: settings.user_id,
    set: {
      ai_provider: sql`excluded.ai_provider`,
      api_key_encrypted: sql`excluded.api_key_encrypted`,
      updated_at: sql`NOW()`,
    },
  })
```

### Meta long-lived token refresh (weekly job)
```typescript
// Source: Meta docs (https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/)
const refreshUrl = new URL('https://graph.instagram.com/refresh_access_token')
refreshUrl.searchParams.set('grant_type', 'ig_refresh_token')
refreshUrl.searchParams.set('access_token', currentLongLivedToken)
const resp = await fetch(refreshUrl)
const { access_token: newToken, expires_in } = await resp.json()
```

### Frontend: Read URL params after OAuth redirect
```typescript
// Source: ASSUMED — standard URLSearchParams + window.history.replaceState
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const screen = params.get('screen')
  const connected = params.get('connected')
  const error = params.get('error')
  
  if (params.size > 0) {
    // Clean up URL before any state changes
    window.history.replaceState({}, '', window.location.pathname)
  }
  if (screen === 'settings') setCurrentScreen('settings')
  if (connected) refetchSettings()
  if (error) setOauthError(error)
}, [])
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `instagram_basic` scope | `instagram_business_basic` | Deprecated Jan 27, 2025 | Old scope broken — must use new name |
| `business_content_publish` scope | `instagram_business_content_publish` | Deprecated Jan 27, 2025 | Old scope broken — must use new name |
| `jsonwebtoken` for JWT | `jose` | JWT library policy | `jsonwebtoken` does not work in Edge runtime; N/A here (backend only uses Supabase JWT) |
| `randomBytes(16)` IV for AES-GCM | `randomBytes(12)` (96-bit) | NIST SP 800-38D | 96-bit is the NIST-recommended GCM nonce size; 128-bit works but is non-standard |

**Deprecated/outdated:**
- `instagram_basic`: Deprecated January 27, 2025 — use `instagram_business_basic` [VERIFIED: Meta docs]
- `business_content_publish`: Deprecated January 27, 2025 — use `instagram_business_content_publish` [VERIFIED: Meta docs]
- Instagram popup OAuth: COOP `same-origin` renders `window.opener` null — redirect-only [VERIFIED: CLAUDE.md]

---

## Runtime State Inventory

> Phase 2 is not a rename/refactor phase — this section is omitted (greenfield additions only).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | In-memory Map is acceptable for OAuth state (single-process VPS) | Pattern 6 | If VPS runs multiple processes, state map is not shared → OAuth fails intermittently; fix: use DB-backed state or sticky sessions |
| A2 | Meta app can be configured with both Instagram Login AND Facebook Login for Business products enabled simultaneously | Pitfall 9 / Pattern 3+4 | If Meta enforces single-product-per-app, need two separate Meta apps; low risk — multi-product Meta apps are standard |
| A3 | `googleapis` v171 OAuth2Client API is backward-compatible with patterns shown | Pattern 2 | Breaking change in googleapis would require different method signatures; verify against googleapis docs after install |
| A4 | Frontend screen switcher in App.tsx uses a string `currentScreen` state that Phase 2 introduces | Pattern 8 | If App.tsx screen switching design changes, URL param reading logic needs adjustment |
| A5 | No schema migration needed for Phase 2 | Summary | All required columns exist in Phase 1 schema — verified against schema.ts; no new columns needed |

---

## Open Questions

1. **Facebook Reels: User must have a Facebook Page — pre-flight requirement**
   - What we know: Facebook Reels requires `page_access_token` + `page_id`; user must have a Facebook Page with CREATE_CONTENT task
   - What's unclear: Exact UX when no Facebook Page found — block connection or allow and warn?
   - Recommendation: Allow the Facebook OAuth flow to complete; after `GET /me/accounts`, if no qualifying page found, store a flag in `platform_config.facebook = { setup_required: true }` and show "Setup Required — Create a Facebook Page first" in the UI. Do not block the flow entirely.

2. **ENCRYPTION_KEY rotation**
   - What we know: scryptSync derives a new key from ENCRYPTION_KEY + random salt per encryption; changing ENCRYPTION_KEY would break decryption of existing ciphertext
   - What's unclear: Is key rotation in scope for Phase 2?
   - Recommendation: Out of scope for Phase 2. Document in `.env.example` that ENCRYPTION_KEY must never change once set.

3. **Meta App Review requirement for Facebook pages_manage_posts scope**
   - What we know: `pages_manage_posts` is a gated permission requiring Meta app review; review takes days-weeks
   - What's unclear: Whether the app has started app review or is in development mode
   - Recommendation: In development mode, the app owner's own Facebook Pages are accessible without review. Document this constraint clearly — other users cannot connect Facebook until app review is approved.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js crypto | AES-256-GCM encryption | ✓ | Node v24 built-in | — |
| `googleapis` npm | Google/YouTube OAuth | Not installed yet | 171.4.0 (latest) | — |
| `pg-boss` | Weekly token refresh job | ✓ | 12.18.1 (installed) | — |
| Drizzle ORM | JSONB partial update | ✓ | 0.45.2 (installed) | — |
| `ENCRYPTION_KEY` env var | AES-256-GCM key derivation | Not set (not in .env.example yet) | — | None — blocking |
| `GOOGLE_CLIENT_ID` env var | YouTube OAuth | Not set | — | None — blocking |
| `GOOGLE_CLIENT_SECRET` env var | YouTube OAuth | Not set | — | None — blocking |
| `META_APP_ID` env var | Instagram + Facebook OAuth | Not set | — | None — blocking |
| `META_APP_SECRET` env var | Instagram + Facebook OAuth | Not set | — | None — blocking |

**Missing dependencies with no fallback (blocking):**
- `googleapis` must be installed: `cd backend && npm install googleapis`
- `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `META_APP_ID`, `META_APP_SECRET` must be added to `.env` and `.env.example`
- These are user-supplied secrets — plan must include a Wave 0 checkpoint for human to supply credentials

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `backend/vitest.config.ts` |
| Quick run command | `cd backend && npm test` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETTINGS-01 | `encrypt(plaintext)` then `decrypt(ciphertext)` roundtrip | unit | `npm test -- --grep "encryption"` | ❌ Wave 0 |
| SETTINGS-01 | API key stored encrypted; GET returns `****last4` mask | integration | `npm test -- --grep "settings api key"` | ❌ Wave 0 |
| SETTINGS-04 | Google OAuth initiation redirects to accounts.google.com | integration (mock) | `npm test -- --grep "google oauth"` | ❌ Wave 0 |
| SETTINGS-05 | Instagram OAuth initiation redirects to api.instagram.com | integration (mock) | `npm test -- --grep "instagram oauth"` | ❌ Wave 0 |
| SETTINGS-07 | Meta token refresh job registered in pg-boss | unit | `npm test -- --grep "meta token refresh"` | ❌ Wave 0 |
| SETTINGS-09 | Disconnect clears platform_config entry | integration | `npm test -- --grep "disconnect"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npm test`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/encryption.test.ts` — unit tests for encrypt/decrypt roundtrip, auth tag verification, wrong-key rejection
- [ ] `backend/tests/settings.test.ts` — integration tests for GET/PATCH /api/settings (mock Supabase auth)
- [ ] `backend/tests/oauth.test.ts` — stub tests for OAuth initiation redirect URLs and state management

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase JWT (established Phase 1); OAuth tokens encrypted at rest |
| V3 Session Management | yes | OAuth state in server-side Map with 10-min TTL + single-use deletion |
| V4 Access Control | yes | All settings routes behind `authMiddleware`; user can only read/write own settings (RLS) |
| V5 Input Validation | yes | API key input: trim, max 200 chars; platform selection: enum validation |
| V6 Cryptography | yes | AES-256-GCM with scryptSync key derivation; randomBytes(12) IV per encryption |

### Known Threat Patterns for OAuth + Encryption Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF via forged OAuth callback | Spoofing | State parameter: `randomBytes(32).toString('hex')`, single-use, 10-min TTL |
| Token theft from DB | Information Disclosure | AES-256-GCM encryption before storage; ENCRYPTION_KEY in env only |
| Decrypted key in API response | Information Disclosure | Return `{ masked: '****last4' }` only; never decrypt to client |
| Replay attack on OAuth state | Spoofing | Single-use state: `oauthStateMap.delete(state)` before processing |
| Cross-user settings read | Elevation of Privilege | RLS on `settings` table (`user_id = auth.uid()`) enforced at DB level |
| ENCRYPTION_KEY in git | Information Disclosure | Never in `.env` (gitignored); only in `.env.example` as placeholder |

---

## Sources

### Primary (HIGH confidence)
- `backend/src/db/schema.ts` — verified `settings` table columns match Phase 2 needs; no migration required
- `backend/src/lib/boss.ts` — verified pg-boss v12 `createQueue` + `schedule` + `work` pattern
- `backend/package.json` — verified installed dependencies; `googleapis` not yet installed
- Node.js v24 crypto module — AES-256-GCM + scryptSync + randomBytes verified working (tested in session)

### Secondary (MEDIUM confidence)
- [Meta Instagram Login — Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/) — Instagram OAuth authorization URL, scopes, token exchange endpoints
- [Meta OAuth Authorize Reference](https://developers.facebook.com/docs/instagram-platform/reference/oauth-authorize/) — exact URL format, code trailing `#_` detail
- [Meta Instagram Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/) — confirmed Instagram Reels uses Instagram User token (not page token)
- [Meta Access Tokens Guide](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/) — `GET /me/accounts` for page_access_token
- [Google OAuth2 Web Server Guide](https://developers.google.com/identity/protocols/oauth2/web-server) — OAuth2Client pattern, `access_type: 'offline'`, `prompt: 'consent'`
- [Drizzle JSONB partial update](https://maxleiter.com/notes/updating-jsonb-drizzle) — `COALESCE(col, '{}')::jsonb || patch::jsonb` pattern

### Tertiary (LOW confidence)
- [Facebook Reels via Ayrshare](https://www.ayrshare.com/facebook-reels-api-how-to-post-fb-reels-using-a-social-media-api/) — confirmed `page_access_token` required for Facebook Reels; `pages_manage_posts` etc. permissions
- [AES-256-GCM gist](https://gist.github.com/AndiDittrich/4629e7db04819244e843) — modified scryptSync pattern; adapted to CLAUDE.md `randomBytes(12)` IV spec

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry or codebase grep
- Architecture: HIGH — built on verified Phase 1 patterns; Meta/Google OAuth flows confirmed via official docs
- Pitfalls: HIGH — derived from official documentation and confirmed Phase 1 patterns
- Meta dual-flow (Instagram Login vs Facebook Login): MEDIUM — confirmed architecturally distinct but exact combined-app setup not verified

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (Meta scope changes are the main risk; 30-day window safe)
