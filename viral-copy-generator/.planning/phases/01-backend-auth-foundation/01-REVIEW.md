# Phase 01 Code Review

**Date:** 2026-05-01
**Depth:** standard
**Reviewer:** gsd-code-reviewer

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH     | 5 |
| MEDIUM   | 5 |
| LOW      | 4 |
| INFO     | 3 |
| **Total** | **19** |

**Files reviewed:** 26
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/vitest.config.ts`
- `backend/drizzle.config.ts`
- `backend/src/db/schema.ts`
- `backend/src/db/index.ts`
- `backend/src/db/migrate.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/middleware/admin.ts`
- `backend/src/routes/health.ts`
- `backend/src/routes/posts.ts`
- `backend/src/lib/boss.ts`
- `backend/src/lib/storage.ts`
- `backend/src/lib/supabase.ts`
- `backend/src/app.ts`
- `backend/src/index.ts`
- `backend/src/scripts/make-admin.ts`
- `frontend/vite.config.ts`
- `frontend/src/styles.css`
- `frontend/src/lib/supabase.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/GeneratorPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/vite-env.d.ts`
- `nginx/vcg.conf`

---

## Findings

### [CRITICAL] Nginx serves all uploaded files with no auth — any URL is world-readable

**File:** `nginx/vcg.conf:48-51`
**Issue:** The `/uploads/` location block serves `/var/uploads/` directly with zero authentication. Files are stored at `/var/uploads/{user_id}/{uuid}.ext`. While UUIDs provide some obscurity, any leaked or guessed URL exposes another user's video file. There is no check that the requesting user owns the file. The comment justifies this as "public by design for Meta fetch," but Meta fetches happen server-side from the backend job, not from the user's browser — the backend can authenticate before serving or use a pre-signed approach. At minimum the rule makes the _entire_ `/var/uploads/` tree world-readable permanently, not just during the upload window.
**Fix:** In Phase 6, serve uploads through a signed URL or a backend proxy route (`GET /api/uploads/:userId/:file`) that verifies `res.locals.userId === userId` before streaming the file. Remove the static `/uploads/` nginx alias before Phase 6 lands. For Meta's server-side fetch, generate a short-lived (e.g., 1-hour) signed token appended to the URL rather than making the whole directory permanently public.

---

### [CRITICAL] `cleanupStaleFiles` walks the filesystem with no path-traversal guard

**File:** `backend/src/lib/storage.ts:19-31`
**Issue:** `readdir(UPLOADS_ROOT)` returns raw directory entries. Each entry is joined with `path.join(UPLOADS_ROOT, userDir)` and then joined again for each file. If an attacker can create a directory name that contains `..` (e.g., via a future upload endpoint that does not sanitise the user_id segment), `path.join` will happily resolve the traversal and `unlink` could delete arbitrary files outside `/var/uploads`. The current Phase 1 code does not have a write-path yet, but the cleanup function will be live from startup day one, and Phase 6 introduces a write path. No `path.resolve` + prefix check is performed.
**Fix:** After joining the path, assert it stays within `UPLOADS_ROOT`:
```typescript
const resolvedUserPath = path.resolve(userPath)
if (!resolvedUserPath.startsWith(path.resolve(UPLOADS_ROOT))) {
  console.warn(`[storage] suspicious directory entry skipped: ${userDir}`)
  continue
}
```
Apply the same guard for `filePath` before calling `unlink`.

---

### [HIGH] `supabase.auth.getSession()` in App.tsx is not trusted for server-gating — but the token is never forwarded to the backend

**File:** `frontend/src/App.tsx:13`
**Issue:** `getSession()` reads the locally cached session and does not re-validate it against Supabase's server. The Supabase docs explicitly warn that `getSession()` should not be trusted for security decisions — use `getUser()` for that. Here it is only used for UI routing (showing LoginPage vs GeneratorPage), which is acceptable for Phase 1 since the actual data is gated server-side. However, the `session.access_token` is never extracted and forwarded to the backend as an `Authorization: Bearer` header in `frontend/src/lib/api.ts` (which does not yet exist). If Phase 2 developers add API calls without establishing this pattern, routes will appear to work in the browser (session exists) but will hit the backend unauthenticated. The pattern must be established in Phase 1.
**Fix:** Create `frontend/src/lib/api.ts` now with a fetch wrapper that injects `Authorization: Bearer ${session.access_token}` on every request. Alternatively, at minimum document in a comment inside `App.tsx` that `session.access_token` must be passed to all backend calls and show the pattern. This prevents the gap from being missed in Phase 2.

---

### [HIGH] `authMiddleware` does not reject tokens with whitespace prefix (incomplete `replace`)

**File:** `backend/src/middleware/auth.ts:10`
**Issue:** `req.headers.authorization?.replace('Bearer ', '')` uses a plain string replace, not a regex. If the client sends `bearer token123` (lowercase), `BEARER token123`, or extra whitespace (`Bearer  token123` — two spaces), the entire string is passed to `supabaseAdmin.auth.getUser()` intact. Supabase's `getUser()` will reject it, so this is not an auth bypass, but it will cause valid tokens to be silently rejected with a 401 if the client doesn't capitalise correctly, and the error message gives no indication why. More critically, `replace` only replaces the **first** occurrence — a crafted header `Bearer Bearer realtoken` would be passed as `Bearer realtoken` and could confuse downstream parsing.
**Fix:**
```typescript
const authHeader = req.headers.authorization
if (!authHeader?.startsWith('Bearer ')) {
  res.status(401).json({ error: 'Unauthorized' })
  return
}
const token = authHeader.slice(7).trim()
```

---

### [HIGH] `make-admin.ts` calls `listUsers()` which paginates — only first page checked

**File:** `backend/src/scripts/make-admin.ts:18`
**Issue:** `supabase.auth.admin.listUsers()` returns a paginated result. By default it returns the first 50-100 users (Supabase default page size is 50). If the target email is on page 2+, `users.find(u => u.email === userEmail)` returns `undefined` and the script throws `User not found` even when the user exists. On a production platform with more than 50 users this is a silent failure that blocks legitimate admin promotion.
**Fix:**
```typescript
// Use the `page` + `perPage` approach or the newer `listUsers` pagination
let page = 1
let found: User | undefined
while (true) {
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
  if (error) throw error
  found = users.find(u => u.email === userEmail)
  if (found || users.length < 100) break
  page++
}
if (!found) throw new Error(`User not found: ${userEmail}`)
```
Alternatively, use `supabase.auth.admin.getUserByEmail(userEmail)` if available in the SDK version in use, which avoids pagination entirely.

---

### [HIGH] `platform_config` JSONB stores OAuth access tokens unencrypted

**File:** `backend/src/db/schema.ts:119-123` and `132`
**Issue:** `PlatformConfig` contains `access_token` and `refresh_token` fields stored as plain strings inside a JSONB column. CLAUDE.md rule 7 (Security) states: "API keys: AES-256-GCM, `randomBytes(12)` IV, `scryptSync` key derivation." The same requirement applies to OAuth tokens. If the database is breached, all platform OAuth tokens are immediately exposed in plaintext. The `api_key_encrypted` column in `settings` is named correctly (implies it will be encrypted), but `platform_config` has no such naming or encryption layer.
**Fix:** Before writing OAuth tokens to `platform_config`, encrypt them with the same AES-256-GCM routine that will be used for `api_key_encrypted`. Store the IV alongside the ciphertext (e.g., as `{ iv: '...', cipher: '...' }` in the JSONB). Decrypt on read in the settings route, never return plaintext to the client. Add a note to the schema that this column requires encryption at the route layer.

---

### [HIGH] CORS `origin` accepts any request in development with no allowlist

**File:** `backend/src/app.ts:25-28`
**Issue:** `origin: process.env.APP_URL ?? 'http://localhost:5173'` means that when `APP_URL` is not set (e.g., in a staging environment where someone forgot the env var), the CORS policy defaults to allowing only `localhost:5173`. This is acceptable locally. However, if `APP_URL` is set to a wildcard or an incorrect value, CORS is wide open. More importantly, the fallback creates a silent misconfiguration risk: a developer running the backend on a staging server without `APP_URL` will see CORS errors instead of a clear startup failure. There is no validation that `APP_URL` is a valid URL on startup.
**Fix:** On startup, validate that `APP_URL` is set and matches `https://` in non-development environments:
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
  throw new Error('APP_URL must be set in production')
}
```
Also consider an explicit allowlist array rather than a single string, anticipating future domain changes.

---

### [MEDIUM] `ssl: { rejectUnauthorized: false }` in database pool disables TLS certificate verification

**File:** `backend/src/db/index.ts:11`
**Issue:** `rejectUnauthorized: false` tells the `pg` driver to accept any TLS certificate, including self-signed or expired ones, and provides no protection against man-in-the-middle attacks on the database connection. This is a common workaround for Supabase's connection pooler, but the correct fix is to use the Supabase CA certificate rather than disabling verification entirely.
**Fix:** Download the Supabase project's CA certificate and set:
```typescript
ssl: {
  rejectUnauthorized: true,
  ca: process.env.SUPABASE_DB_CA_CERT, // PEM string from env
}
```
If the CA cert approach is not practical, at minimum add a comment explaining why verification is disabled and that this is a known accepted risk for this specific Supabase configuration.

---

### [MEDIUM] `registerCleanupJob` is not idempotent — `createQueue` + `schedule` throw on duplicate if called again

**File:** `backend/src/lib/boss.ts:25-28`
**Issue:** On every server startup, `registerCleanupJob` calls `createQueue('cleanup-stale-files')` and then `schedule(...)`. In pg-boss v12, `createQueue` is idempotent (it uses INSERT ... ON CONFLICT DO NOTHING), but `schedule` with the same name will throw a unique constraint violation if the schedule already exists from a prior startup. This means the server will crash on every restart after the first boot. The fix is to pass `{ ifNotExists: true }` or handle the conflict.
**Fix:**
```typescript
// pg-boss v12 schedule is NOT idempotent — use onConflict or try/catch
try {
  await bossInstance.schedule('cleanup-stale-files', '0 * * * *', {})
} catch (err: unknown) {
  // Ignore duplicate schedule errors (expected on restart)
  if (!(err as Error).message?.includes('duplicate') &&
      !(err as Error).message?.includes('unique')) {
    throw err
  }
}
```
Alternatively, check the pg-boss v12 docs — `unschedule` + `schedule` in sequence is also a safe pattern.

---

### [MEDIUM] No `Content-Security-Policy` header set anywhere

**File:** `backend/src/app.ts` and `nginx/vcg.conf`
**Issue:** COOP/COEP headers are correctly set, but there is no `Content-Security-Policy` header. Without CSP, an XSS vulnerability (in any future phase that renders user content) would have no second line of defence. The nginx config and the Express app both lack CSP.
**Fix:** Add a CSP header in the nginx config or as an Express middleware. A safe starting point for a SPA:
```
Content-Security-Policy: default-src 'self'; connect-src 'self' https://*.supabase.co; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:;
```
Tighten it per phase as new domains (CDNs, AI providers) are added.

---

### [MEDIUM] `App.tsx` session check does not handle `getSession()` errors

**File:** `frontend/src/App.tsx:13`
**Issue:** `supabase.auth.getSession().then(({ data: { session } }) => ...)` destructures `data.session` without checking for an `error` in the response. If `getSession()` returns an error (network failure, corrupt local storage), `session` will be `null` and the app will silently show the LoginPage — which may be acceptable in terms of security but provides no feedback to the user if they have a valid session that failed to load due to a transient network error.
**Fix:**
```typescript
supabase.auth.getSession().then(({ data: { session }, error }) => {
  if (error) {
    console.warn('[auth] getSession error:', error.message)
  }
  setSession(session)
  setLoading(false)
})
```

---

### [MEDIUM] `main.tsx` non-null assertion on `document.getElementById('root')` with no fallback

**File:** `frontend/src/main.tsx:6`
**Issue:** `document.getElementById('root')!` uses a non-null assertion. If the element is missing from `index.html` (e.g., a template misconfiguration), this throws a runtime error with no meaningful message. The `!` is common in Vite/React scaffolds but technically unsafe.
**Fix:**
```typescript
const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found in index.html')
createRoot(rootEl).render(...)
```

---

### [LOW] `LoginPage.tsx` does not set `loading = false` when `signInWithPassword` throws (unhandled rejection)

**File:** `frontend/src/pages/LoginPage.tsx:15-18`
**Issue:** The `handleLogin` function calls `supabase.auth.signInWithPassword()` with `await` inside a `try`-less async function. Supabase's JS SDK does not throw — it returns `{ error }` — so this is not an immediate bug. However, if the SDK is ever upgraded or the call is replaced, an unexpected throw would leave `loading` stuck at `true` (the button permanently disabled). The `setLoading(false)` on line 18 is also placed after the `if (authError)` check but outside a `finally`, which is fine for the current SDK but fragile.
**Fix:** Wrap in try/finally:
```typescript
try {
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) setError(authError.message)
} finally {
  setLoading(false)
}
```

---

### [LOW] `GeneratorPage.tsx` contains hardcoded placeholder text ("Generator coming in Phase 3.")

**File:** `frontend/src/pages/GeneratorPage.tsx:18`
**Issue:** CLAUDE.md rule 5 (Content-Complete Rule) states: "NEVER generate placeholder text. NEVER write 'TODO', 'Coming soon', [insert]..." The text "Generator coming in Phase 3." violates this rule.
**Fix:** Replace with real content that represents Phase 1 state, e.g., a loading spinner skeleton or a message that reflects actual system state (e.g., "Upload a video to generate copy"). If the page is genuinely empty in Phase 1, render nothing rather than a placeholder string.

---

### [LOW] `posts.ts` stub route leaks internal `userId` in response body

**File:** `backend/src/routes/posts.ts:10`
**Issue:** `res.json({ posts: [], userId: res.locals.userId as string })` returns the authenticated user's internal UUID in the response body. This is a stub for Phase 5, but the pattern should not be copied into real implementations. User IDs should never be leaked in API responses unless specifically required by a client-side need.
**Fix:** Remove `userId` from the response body. The client already knows its own user ID from the Supabase session object. When Phase 5 implements this route for real, return only `{ posts: [] }`.

---

### [LOW] `drizzle.config.ts` non-null assertion on `DATABASE_URL` with no startup validation

**File:** `backend/drizzle.config.ts:13`
**Issue:** `url: process.env.DATABASE_URL!` silently passes `undefined` as the URL string if the env var is not set, causing a confusing downstream error from `pg` rather than a clear "DATABASE_URL is not set" message at startup. The same applies to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `supabase.ts`.
**Fix:** Add an env validation block in `backend/src/index.ts` before any connections are made:
```typescript
const REQUIRED_ENV = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}
```

---

### [INFO] `backend/package.json` uses `^` on `dotenv` — version pinning inconsistent

**File:** `backend/package.json:20`
**Issue:** Most dependencies are pinned to exact versions (e.g., `"express": "5.2.1"`, `"pg-boss": "12.18.1"`) but `dotenv` uses `"^17.4.2"` and `@vitest/coverage-v8` / `vitest` use `"^3.0.0"`. The caret allows minor/patch version drift on `npm install`, which can cause subtle environment differences between deployments.
**Fix:** Pin all production dependencies to exact versions. Dev dependencies can tolerate carets but exact pins are preferable for reproducibility. Run `npm install --save-exact` to lock them.

---

### [INFO] No `X-Content-Type-Options` or `X-Frame-Options` security headers

**File:** `nginx/vcg.conf` and `backend/src/app.ts`
**Issue:** Standard defensive headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin` are absent. These are low-effort, high-value headers that mitigate MIME sniffing and clickjacking attacks.
**Fix:** Add to the nginx `server` block:
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```
Or set them in the Express COOP/COEP middleware block in `app.ts`.

---

### [INFO] `vitest.config.ts` has no coverage thresholds configured

**File:** `backend/vitest.config.ts`
**Issue:** `test:coverage` is available but no coverage thresholds are set. Without thresholds, coverage reports are generated but never enforced, so the CI gate provides no signal.
**Fix:** Add thresholds appropriate for Phase 1 (low, since only stubs exist), and raise them as phases complete:
```typescript
coverage: {
  provider: 'v8',
  thresholds: { lines: 60, functions: 60, branches: 50 },
}
```

---

## Verdict

**PASS_WITH_NOTES** — The authentication foundation is structurally sound (Supabase JWT verification is correct, RLS policies are in place, COOP/COEP headers are set via the correct plugin pattern, pg-boss v12 createQueue-before-schedule is followed), but two CRITICAL issues (unauthenticated nginx `/uploads/` exposure and missing path-traversal guard in the cleanup job) must be resolved before Phase 6 (file upload) ships, and the five HIGH findings — particularly unencrypted OAuth tokens in `platform_config` and the `schedule()` idempotency crash on restart — should be addressed in Phase 2 before new routes are built on top of this foundation.
