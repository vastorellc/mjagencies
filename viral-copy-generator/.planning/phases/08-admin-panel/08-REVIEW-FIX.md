---
phase: 08-admin-panel
fixed_at: 2026-05-04T01:41:03Z
review_path: .planning/phases/08-admin-panel/08-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-05-04T01:41:03Z
**Source review:** .planning/phases/08-admin-panel/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Server filesystem path leaked in every `/api/admin/logs` response

**Files modified:** `backend/src/routes/admin.ts`, `frontend/src/lib/types.ts`, `frontend/src/pages/AdminPage.tsx`
**Commit:** bcc41d0
**Applied fix:** Removed `logPath` from both the error-case and success-case JSON responses in GET /api/admin/logs. Removed `logPath: string` field from the `AdminLogsMeta` interface in types.ts. Replaced the `from {logs.meta.logPath}` display clause in AdminPage.tsx with plain "Showing N of M lines" text.

---

### CR-02: Self-lockout guard uses unreliable `as string | undefined` cast

**Files modified:** `backend/src/routes/admin.ts`
**Commit:** 35285ae
**Applied fix:** Changed `res.locals.userId as string | undefined` to an explicit `const adminUserId: string | undefined = res.locals.userId` (no unsafe cast). Added a fail-closed presence guard (`if (!adminUserId) return 500`) placed before the `targetUserId === adminUserId` self-lockout comparison, so the guard fails closed rather than silently allowing self-lockout if authMiddleware ever fails to set the value.

---

### WR-01: `exec()` error message exposed verbatim in API response

**Files modified:** `backend/src/routes/admin.ts`
**Commit:** 428d5dc
**Applied fix:** In the `df -h /var` catch block, replaced `diskError = (err as Error).message` with `console.error('[admin/health] df command failed:', err)` and a generic `diskError = 'Disk info unavailable'`. Applied the same pattern to the DB size catch block: logs the real error internally and returns `'Database size unavailable'` instead of the raw Postgres error message.

---

### WR-02: Failed retry/cancel actions silently swallow errors — no user feedback

**Files modified:** `frontend/src/pages/AdminPage.tsx`
**Commit:** a3118c1
**Applied fix:** Added `const [jobActionError, setJobActionError] = useState<string | null>(null)` to Queue state. Updated `handleRetry` to call `setJobActionError(null)` on entry and `setJobActionError('Failed to retry job. It may have already transitioned state.')` in the catch block. Updated `handleCancel` identically with a cancel-specific message. Added an inline amber error banner `{jobActionError && <p ...>{jobActionError}</p>}` in the Queue section, displayed below `jobsError` and above the job list.

---

### WR-03: No UUID/format validation on `:userId` and `:id` route params

**Files modified:** `backend/src/routes/admin.ts`
**Commit:** c0c3a58
**Applied fix:** Added `const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` constant near the top of the file (after `execAsync`). Added a `UUID_RE.test(param)` guard returning 400 Bad Request to five route handlers: POST `/jobs/:id/retry`, DELETE `/jobs/:id`, PATCH `/users/:userId/disable`, PATCH `/users/:userId/enable`, and DELETE `/users/:userId/learning`. Each guard is placed immediately after the existing string presence check.

---

### WR-04: `/users/:userId/enable` route missing self-lockout guard

**Files modified:** `backend/src/routes/admin.ts`
**Commit:** 3bf268c
**Applied fix:** Added `const adminUserId: string | undefined = res.locals.userId` to the enable route handler. Added a fail-closed presence check (`if (!adminUserId) return 500`) and a self-lockout guard (`if (targetUserId === adminUserId) return 400 'Cannot re-enable your own account'`), matching the structure of the disable route for defensive parity.

---

_Fixed: 2026-05-04T01:41:03Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
