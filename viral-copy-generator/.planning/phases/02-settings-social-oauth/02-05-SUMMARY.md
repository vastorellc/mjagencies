---
phase: 02-settings-social-oauth
plan: 05
subsystem: infra
tags: [pg-boss, scheduled-job, meta-token-refresh, instagram, aes-256-gcm, jsonb-merge, cron]

requires:
  - phase: 02-01
    provides: AES-256-GCM encrypt/decrypt primitives (encryption.ts)
  - phase: 02-02
    provides: settings table schema, PlatformConfig type in schema.ts
  - phase: 02-04
    provides: refreshInstagramToken() from oauth-meta.ts

provides:
  - meta-refresh.ts: registerMetaTokenRefreshJob(boss) wires Mondays-09:00-UTC pg-boss cron job
  - meta-refresh.ts: refreshAllInstagramTokens() worker body — iterates all instagram-connected users, decrypts, refreshes, re-encrypts, JSONB-merges
  - index.ts: startup now calls registerMetaTokenRefreshJob(boss) after registerCleanupJob(boss)

affects: [06-autoupload]

tech-stack:
  added: []
  patterns:
    - pg-boss v12 createQueue() before schedule() (FK constraint Pitfall 5) — same pattern as registerCleanupJob
    - duplicate-key swallow on schedule() restart — try/catch checks msg.includes('duplicate') || msg.includes('unique')
    - Per-user error isolation in worker loop — catch per user, log with user_id, never propagate (Pitfall 6)
    - JSONB merge via sql`COALESCE(col, '{}')::jsonb || ${JSON.stringify(patch)}::jsonb` — preserves facebook/youtube keys
    - SELECT FOR UPDATE inside db.transaction() for concurrency safety (Phase 1 pattern)
    - SettingsRow type with index signature `[key: string]: unknown` to satisfy db.execute<T> Record constraint

key-files:
  created:
    - backend/src/lib/meta-refresh.ts
    - backend/tests/meta-refresh.test.ts
  modified:
    - backend/src/index.ts

key-decisions:
  - "Test 3 (non-duplicate error re-thrown) required error message without 'duplicate' substring — original test used 'connection refused — not a duplicate' which contains 'duplicate', causing the catch block to swallow it; fixed to 'connection refused to pg-boss'"
  - "SettingsRow uses type alias with index signature rather than interface — required for db.execute<T extends Record<string,unknown>> generic constraint; no as-unknown-as cast needed (CLAUDE.md rule 9)"
  - "Facebook page tokens deliberately excluded from this job (research Pattern 7 — different lifecycle); Instagram ig_refresh_token grant only"

requirements-completed:
  - SETTINGS-07

duration: 7min
completed: 2026-05-02
---

# Phase 2 Plan 05: Weekly Meta Token Refresh Job Summary

**pg-boss scheduled job (Mondays 09:00 UTC) refreshes 60-day Instagram long-lived tokens with per-user error isolation, AES-256-GCM encrypt/decrypt round-trip, and JSONB merge — 7/7 Vitest tests passing**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-02T01:15:08Z
- **Completed:** 2026-05-02T01:22:02Z
- **Tasks:** 1/1 complete (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- `meta-refresh.ts` — `registerMetaTokenRefreshJob(boss)` registers queue (createQueue → schedule → work, v12 FK order), `refreshAllInstagramTokens()` worker iterates all instagram-connected rows, decrypts stored ciphertext, calls `refreshInstagramToken`, re-encrypts rotated token, JSONB-merges via SELECT FOR UPDATE transaction. Per-user errors logged with user_id but never abort the loop.
- `index.ts` — startup wires `registerMetaTokenRefreshJob(boss)` after `registerCleanupJob(boss)`
- `meta-refresh.test.ts` — 7 tests: createQueue-before-schedule order (verified via mock call sequence), restart-safe duplicate swallow, non-duplicate error re-throw, skip users without instagram (refresh called exactly 2× for 3-user mock with 1 null), encrypt/decrypt round-trip, per-user error isolation (user-B throws, user-A still processed), expiry = Date.now() + expires_in * 1000 (captured via JSON.stringify spy)

## Task Commits

TDD cycle:
1. **RED: failing tests** — `1da9e0f` (test)
2. **GREEN: meta-refresh.ts implementation + index.ts wiring** — `6e733f6` (feat)

## Files Created/Modified

- `backend/src/lib/meta-refresh.ts` — Weekly Meta token refresh job (queue registration + worker body)
- `backend/tests/meta-refresh.test.ts` — 7 Vitest unit tests
- `backend/src/index.ts` — registerMetaTokenRefreshJob(boss) wired at startup

## Test Results

| Test | Behavior | Status |
|------|----------|--------|
| Test 1 | createQueue called BEFORE schedule (order verified), cron = '0 9 * * 1', work registered | PASS |
| Test 2 | Duplicate-key schedule error swallowed on second registration (restart-safe) | PASS |
| Test 3 | Non-duplicate schedule error re-thrown | PASS |
| Test 4 | refreshAllInstagramTokens skips user-C (null instagram), calls refresh exactly 2× for A+B | PASS |
| Test 5 | encrypt/decrypt round-trip — decrypt(encrypt('user-a-token')) === 'user-a-token' | PASS |
| Test 6 | Per-user error isolation — user-B throws 'meta down', user-A still processed + error logged with user_id | PASS |
| Test 7 | Expiry recomputed as Date.now() + expires_in * 1000; re-encrypted token decrypt === 'new-token' | PASS |

**Regression: 47/47 tests pass across full suite (oauth-google 5/5 + settings 10/10 + oauth-meta 9/9 + meta-refresh 7/7)**

## Acceptance Criteria Verification

```
✓ File meta-refresh.ts exists, exports registerMetaTokenRefreshJob + refreshAllInstagramTokens
✓ Named PgBoss import: import { PgBoss } from 'pg-boss' (not default)
✓ Cron '0 9 * * 1' (Mondays 09:00 UTC)
✓ createQueue(QUEUE_NAME) before schedule(QUEUE_NAME, CRON, {}) — Pitfall 5 order
✓ Duplicate-key swallow: !msg.includes('duplicate') && !msg.includes('unique')
✓ SQL filter: platform_config -> 'instagram' IS NOT NULL (facebook untouched)
✓ Per-user error: console.error([meta-token-refresh] FAILED user ${row.user_id}: ...)
✓ decrypt(...) and encrypt(refreshed.access_token) both present (round-trip)
✓ No 'as unknown as' double-cast in meta-refresh.ts (grep returns nothing)
✓ registerMetaTokenRefreshJob wired in index.ts after registerCleanupJob
✓ npx tsc --noEmit exits 0
✓ npm test -- meta-refresh: 7/7 pass
✓ Console logs never emit token values (T-02-19) — grep confirmed user_id + status only
```

## Decisions Made

- **Test error message must avoid 'duplicate' substring**: Original Test 3 used `'connection refused — not a duplicate'` which silently matched the `msg.includes('duplicate')` swallow predicate. Fixed to `'connection refused to pg-boss'`. Auto-fixed during GREEN (Rule 1 — bug in test).
- **SettingsRow type alias with index signature** over interface: `db.execute<T>` requires `T extends Record<string, unknown>`; adding `[key: string]: unknown` satisfies the constraint without a cast. Auto-fixed during TypeScript check (Rule 1 — type error).
- **Facebook tokens excluded by design**: This job only handles Instagram `ig_refresh_token` grant. Facebook page_access_tokens have a different expiry model tied to the user token (research Pattern 7). No Facebook refresh logic here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 3 error message contained 'duplicate' substring causing silent swallow**
- **Found during:** Task 1 GREEN phase (running tests after implementation)
- **Issue:** Test message `'connection refused — not a duplicate'` matched `msg.includes('duplicate')` in the catch block, causing the re-throw test to falsely pass as resolved
- **Fix:** Changed error message to `'connection refused to pg-boss'` (no 'duplicate' substring)
- **Files modified:** `backend/tests/meta-refresh.test.ts`
- **Verification:** Test 3 now asserts `.rejects.toThrow('connection refused to pg-boss')` correctly
- **Committed in:** `6e733f6` (GREEN commit)

**2. [Rule 1 - Bug] SettingsRow interface lacked index signature for db.execute<T> generic**
- **Found during:** Task 1 GREEN phase (npx tsc --noEmit)
- **Issue:** `interface SettingsRow` did not satisfy `T extends Record<string, unknown>` constraint on `db.execute<T>`
- **Fix:** Changed to `type SettingsRow = { user_id: string; platform_config: PlatformConfig | null; [key: string]: unknown }`
- **Files modified:** `backend/src/lib/meta-refresh.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `6e733f6` (GREEN commit)

**3. [Rule 1 - Bug] Test 7 JSON.stringify(drizzle_set_patch) circular reference**
- **Found during:** Task 1 GREEN phase (first test run)
- **Issue:** Drizzle `set()` receives an object with SQL template objects (circular structure), not a plain JSON-serializable object. `JSON.stringify(capturedPatch)` threw circular structure error.
- **Fix:** Instead of capturing the drizzle set() patch, spy on `JSON.stringify` to intercept the `patch` object created in the worker before it is passed to the SQL template. The worker calls `JSON.stringify(patch)` where `patch = { instagram: { access_token: encrypt(...), expiry: ... } }` — this is a plain object and captures the values before they enter drizzle's internals.
- **Files modified:** `backend/tests/meta-refresh.test.ts`
- **Verification:** Test 7 asserts expiry range and decrypt(access_token) === 'new-token'; all 7 pass
- **Committed in:** `6e733f6` (GREEN commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in test assertions or TypeScript types; implementation unchanged)
**Impact on plan:** All fixes are in tests or TypeScript type annotations. The implementation logic is exactly as specified in the plan. No scope creep.

## Issues Encountered

None beyond the three auto-fixed deviations above.

## Known Stubs

None — the job is fully implemented. `refreshInstagramToken` is the real implementation from oauth-meta.ts (Plan 02-04); the pg-boss `work()` handler calls `refreshAllInstagramTokens()` which does the full decrypt → refresh → encrypt → JSONB merge cycle.

Note: The job will not execute in the test suite because it requires a live pg-boss instance and real DATABASE_URL. Integration verification deferred to Plan 02-07 Wave 5 E2E verification.

## Threat Surface Scan

All T-02-* threat mitigations implemented as planned:
- T-02-04 (Meta token expiry): Weekly cron '0 9 * * 1' — 7-day cadence on 60-day token = 8.5× safety margin
- T-02-19 (Plaintext token in logs): All console outputs emit user_id + status only; verified via grep — no token values written
- T-02-20 (One user failure aborts iteration): Per-user try/catch — Test 6 confirms user-A processes successfully even when user-B throws
- T-02-21 (pg-boss restart duplicate): try/catch swallows 'duplicate'/'unique' on schedule(); Test 2 confirms

No new network endpoints or trust boundaries introduced beyond what is in the plan's threat model.

## Next Phase Readiness

- Plan 02-06 (Settings UI frontend) can proceed independently — no backend changes needed
- Plan 02-07 (Wave 5 E2E verification) will test the full pg-boss job cycle with real Meta credentials
- `registerMetaTokenRefreshJob` exported and wired — Phase 6 auto-upload will benefit from guaranteed token freshness

---
*Phase: 02-settings-social-oauth*
*Completed: 2026-05-02*
