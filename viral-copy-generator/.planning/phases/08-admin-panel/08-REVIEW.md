---
phase: 08-admin-panel
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - backend/src/middleware/admin.ts
  - backend/src/routes/admin.ts
  - backend/src/app.ts
  - frontend/src/lib/types.ts
  - frontend/src/lib/api.ts
  - frontend/src/pages/AdminPage.tsx
  - frontend/src/App.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

The admin panel implementation is structurally sound. The double-gate auth pattern (`authMiddleware` at the `/api` mount point + `adminMiddleware` at the router level) is correctly wired. ADMIN-10 data exposure controls are applied consistently — no `api_key_encrypted` or OAuth token values are returned in any response. The self-lockout guard on `/disable` is present. The bar chart in `AdminPage.tsx` correctly uses inline `style={{ width }}` rather than dynamic Tailwind classes. TypeScript strict-mode is observed throughout both files.

Two critical issues were found: the `df` command in the health endpoint is hardcoded to the string `'df -h /var'` and cannot be injected from request input, but the `exec()` call itself is unnecessary — the path `/var` is a fixed literal, yet using `execAsync` with a shell command is higher risk than needed and exposes the `Error.message` from a failed exec in the API response (which can reveal internal OS details). More critically, the `/logs` endpoint returns `logPath` (the full server filesystem path, e.g. `/var/log/app.log`) in every response body, leaking VPS filesystem layout to the admin client. A second critical finding is a type-safety gap in the self-lockout guard: `res.locals.userId` is cast to `string | undefined` with `as` but the global `Express.Locals` declaration types it as `string` (non-optional), meaning if `authMiddleware` failed silently, the guard comparison would be `undefined === targetUserId` which is `false` — and the ban would proceed on the admin's own account.

Four warnings cover: unhandled-error silently swallowed in `handleRetry`/`handleCancel` in `AdminPage.tsx` (no user feedback on failure), `df` error message exposed verbatim in the API response (internal OS detail leakage), missing UUID validation on `:userId` and `:id` route params (any string passes), and the `enable` endpoint lacking the self-lockout guard that `disable` has (enabling another admin's disabled account from their own session is harmless, but the asymmetry is a latent confusion risk).

---

## Critical Issues

### CR-01: Server filesystem path leaked in every `/api/admin/logs` response

**File:** `backend/src/routes/admin.ts:441` and `backend/src/routes/admin.ts:469`

**Issue:** The full absolute path of the log file on the VPS (e.g. `/var/log/app.log`, or whatever `LOG_FILE` resolves to) is included in every successful and failed response under `meta.logPath`. This exposes VPS filesystem layout to any admin-role holder and, more importantly, is sent over the wire unnecessarily. If the log path is configured via a non-standard env var (e.g. pointing to a path containing user or service names), it can reveal infrastructure topology.

```
// line 441 — error case
res.json({ lines: [], meta: { logPath, error: msg } })

// line 469 — success case
res.json({ lines: tailLines, meta: { logPath, total_lines: ..., ... } })
```

**Fix:** Remove `logPath` from both response objects. The frontend already displays this value on line 486 of `AdminPage.tsx` only for informational purposes; it is not needed for correct operation.

```typescript
// error case
res.json({ lines: [], meta: { error: msg } })

// success case
res.json({
  lines: tailLines,
  meta: {
    total_lines: allLines.length,
    filtered_lines: filtered.length,
    returned: tailLines.length,
  },
})
```

Also remove `logPath` from `AdminLogsMeta` in `frontend/src/lib/types.ts` (line 339) and remove the `logs.meta.logPath` reference from `AdminPage.tsx` line 486.

---

### CR-02: Self-lockout guard uses unreliable `as string | undefined` cast — bypass possible if `res.locals.userId` is unexpectedly `undefined`

**File:** `backend/src/routes/admin.ts:196`

**Issue:** The self-lockout guard reads:

```typescript
const adminUserId = res.locals.userId as string | undefined
```

The global `Express.Locals` declaration (defined in `admin.ts` lines 12-16) types `userId` as `string` (non-optional). If `authMiddleware` ever fails to set `res.locals.userId` — for example, if a future middleware ordering change runs `adminMiddleware` before `authMiddleware`, or if a test bypasses auth — `adminUserId` will be `undefined` at runtime. The comparison `targetUserId === adminUserId` would then be `false` for any valid UUID, and the admin would successfully ban themselves. The `as` cast hides this from TypeScript rather than making it safe.

**Fix:** Assert the presence of `adminUserId` explicitly before using it in the guard:

```typescript
const adminUserId = res.locals.userId
if (!adminUserId) {
  // This should never happen — authMiddleware guarantees userId is set
  res.status(500).json({ error: 'Internal Server Error' })
  return
}
if (targetUserId === adminUserId) {
  res.status(400).json({ error: 'Admin cannot disable their own account' })
  return
}
```

This makes the guard fail-closed rather than fail-open if the invariant is violated.

---

## Warnings

### WR-01: `exec()` error message exposed verbatim in API response — internal OS detail leakage

**File:** `backend/src/routes/admin.ts:378`

**Issue:** When `execAsync('df -h /var')` throws, the raw `Error.message` is returned in the response:

```typescript
diskError = (err as Error).message ?? 'df command failed'
```

On Linux, a failed `df` command error message can include the full command string, the path, and OS-level error details (e.g. `df: /var: No such file or directory`). This leaks internal path and OS information. The same pattern appears at line 390 for the DB error: `dbError = (err as Error).message ?? 'DB size query failed'` which can expose raw Postgres error messages including table names and query fragments.

**Fix:** Return a generic message and log the real error server-side:

```typescript
} catch (err: unknown) {
  logger.error({ err }, 'df command failed')
  diskError = 'Disk info unavailable'
}
```

Apply the same pattern to the `dbError` catch block at line 390.

---

### WR-02: Failed retry/cancel actions in `AdminPage.tsx` silently swallow errors — no user feedback

**File:** `frontend/src/pages/AdminPage.tsx:68-73` and `frontend/src/pages/AdminPage.tsx:83-87`

**Issue:** Both `handleRetry` and `handleCancel` catch errors and do nothing:

```typescript
// handleRetry — line 68
} catch {
  // Non-blocking — state badge will show updated on next refresh
}

// handleCancel — line 83
} catch {
  // Non-blocking
}
```

If the API call fails (network error, 502, job already in a terminal state), the admin sees no feedback. The job list refreshes after a successful call but not after a failed one, so the UI looks identical whether the operation succeeded or failed. This is a usability defect that could lead admins to assume an action succeeded when it did not.

**Fix:** Add error state for job-level action failures and display it inline:

```typescript
const [jobActionError, setJobActionError] = useState<string | null>(null)

async function handleRetry(jobId: string) {
  setRetryingId(jobId)
  setJobActionError(null)
  try {
    await retryAdminJob(jobId)
    await loadJobs()
  } catch {
    setJobActionError('Failed to retry job. It may have already transitioned state.')
  } finally {
    setRetryingId(null)
  }
}
```

Display `jobActionError` near the queue section header, similar to the existing `jobsError` display pattern.

---

### WR-03: No UUID/format validation on `:userId` and `:id` route params before DB/Supabase calls

**File:** `backend/src/routes/admin.ts:94-96`, `198-201`, `226-228`, `250-252`

**Issue:** All parameterised routes check only `!targetUserId || typeof targetUserId !== 'string'`, but since Express always provides route params as strings, the `typeof` check is always `true` and the guard is effectively dead. Any string — including SQL-special characters, very long strings, or invalid UUIDs — passes through to Supabase or the DB. While parameterised queries (Drizzle `sql` tagged template and Supabase SDK) prevent injection, an invalid UUID will cause Supabase's `updateUserById` to return an error rather than a 400, making the error path less clear.

**Fix:** Add a UUID format check using a regex or a simple length+format guard before using the param:

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

if (!UUID_RE.test(targetUserId)) {
  res.status(400).json({ error: 'Invalid userId format' })
  return
}
```

Apply consistently to `:userId` params in `/disable`, `/enable`, `/learning`, and `:id` params in `/jobs/:id/retry` and `/jobs/:id`.

---

### WR-04: `/users/:userId/enable` route missing self-lockout guard (asymmetric with `/disable`)

**File:** `backend/src/routes/admin.ts:223-241`

**Issue:** The `/disable` route (line 203-207) prevents an admin from banning themselves. The `/enable` route has no equivalent check. While enabling yourself when already active produces a no-op in Supabase, the asymmetry is a latent source of confusion: if future code changes make the enable path do more (e.g. resetting an MFA setting), the missing guard would become a real defect.

**Fix:** Add the same self-check to `/enable` for defensive parity:

```typescript
adminRouter.patch('/users/:userId/enable', async (req, res) => {
  const targetUserId = req.params.userId
  const adminUserId = res.locals.userId

  if (!targetUserId || typeof targetUserId !== 'string') {
    res.status(400).json({ error: 'Missing userId' })
    return
  }
  if (targetUserId === adminUserId) {
    res.status(400).json({ error: 'Use the Supabase dashboard to manage your own account' })
    return
  }
  // ...
})
```

---

## Info

### IN-01: `exec()` used for `df -h /var` — prefer `spawnSync` with arg array to avoid shell interpretation

**File:** `backend/src/routes/admin.ts:365`

**Issue:** `execAsync('df -h /var')` passes the command through a shell (`/bin/sh -c`). While `/var` is a hardcoded literal with no user input, using `exec` with a shell introduces an unnecessary attack surface class. If the command string is ever refactored to include a configurable path (e.g. the upload directory from an env var), the shell interpretation would enable injection unless the env var is carefully sanitised.

**Fix:** Use `execFile` (or `spawnSync`) with an argument array, which bypasses the shell entirely:

```typescript
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

// In the route handler:
const { stdout } = await execFileAsync('df', ['-h', '/var'])
```

This makes the call safe regardless of what value `/var` is replaced with in the future.

---

### IN-02: `AdminLogsMeta.logPath` field in `types.ts` — included in type but should be removed if CR-01 is fixed

**File:** `frontend/src/lib/types.ts:339`

**Issue:** The `AdminLogsMeta` interface includes `logPath: string` (line 339 — under the `AdminLogsMeta` block starting at line 338). If CR-01 is addressed and `logPath` is removed from the backend response, this field should be removed from the type and from the display in `AdminPage.tsx` line 486 to maintain type accuracy.

**Fix:** After fixing CR-01, remove `logPath` from `AdminLogsMeta` and update `AdminPage.tsx`:

```typescript
// types.ts — remove:
// logPath: string   ← delete this line

// AdminPage.tsx line 486 — remove the logPath reference:
// from {logs.meta.logPath}  ← delete this clause
```

---

_Reviewed: 2026-05-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
