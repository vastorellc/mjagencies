---
phase: 1
slug: backend-auth-foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `backend/vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-auth-unauth | 01 | 1 | AUTH-02 | T-1-01 | GET /api/posts without token → 401 | Integration | `npx vitest run tests/auth.test.ts` | ✅ W0 | ⬜ pending |
| 1-auth-valid | 01 | 1 | AUTH-02 | T-1-01 | GET /api/posts with valid Supabase JWT → 200 | Integration | `npx vitest run tests/auth.test.ts` | ✅ W0 | ⬜ pending |
| 1-rls | 01 | 1 | AUTH-04 | T-1-02 | User A cannot read User B posts (RLS enforced) | Integration | `npx vitest run tests/rls.test.ts` | ✅ W0 | ⬜ pending |
| 1-admin-403 | 01 | 1 | AUTH-05 | T-1-03 | Non-admin JWT → 403 on admin routes | Unit | `npx vitest run tests/admin.test.ts` | ✅ W0 | ⬜ pending |
| 1-admin-200 | 01 | 1 | AUTH-06 | T-1-03 | Admin JWT → 200 on admin route | Integration | `npx vitest run tests/admin.test.ts` | ✅ W0 | ⬜ pending |
| 1-storage-init | 01 | 1 | STORE-01 | — | /var/uploads dir created on startup | Unit | `npx vitest run tests/storage.test.ts` | ✅ W0 | ⬜ pending |
| 1-login-ui | 01 | 1 | UI-06 | — | Login screen renders for unauthenticated users | Manual smoke | Manual browser check | — | ⬜ pending |
| 1-coop-coep | 01 | 1 | AUTH-02 | T-1-04 | self.crossOriginIsolated === true in DevTools | Manual smoke | Manual DevTools check | — | ⬜ pending |
| 1-logout | 04 | 3 | AUTH-03 | — | Clicking Sign out destroys session → LoginPage renders | Manual smoke | `grep "signOut" frontend/src/pages/GeneratorPage.tsx` | — | ⬜ pending |
| 1-session-persist | 04 | 3 | AUTH-03 | — | Page refresh while authenticated keeps user on app screen | Manual smoke | Manual browser check (refresh on GeneratorPage) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/vitest.config.ts` — test framework config; `npm install -D vitest` in backend
- [x] `backend/tests/auth.test.ts` — stubs for AUTH-02 (401 without token, 200 with valid token)
- [x] `backend/tests/rls.test.ts` — stubs for AUTH-04 (cross-user data isolation via RLS)
- [x] `backend/tests/admin.test.ts` — stubs for AUTH-05 (non-admin 403), AUTH-06 (admin 200)
- [x] `backend/tests/storage.test.ts` — stubs for STORE-01 (uploads dir created on startup)

Wave 0 items are addressed in plan 01-01 (Task 1 creates vitest.config.ts; Task 2 creates all test stubs).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login screen renders, submits, redirects to app | UI-06 | React rendering requires a browser | Open `http://localhost:5173` unauthenticated → see login form → sign in → redirected to app placeholder |
| `self.crossOriginIsolated === true` | AUTH-02 | Browser API, not testable via Vitest | Open DevTools Console → type `self.crossOriginIsolated` → must return `true` |
| HMR still works after Vite restart | COOP/COEP | Dev UX check | Stop Vite → restart → edit a component → hot reload fires without page refresh |
| pg-boss `pgboss.*` schema created in Supabase | STORE-04 | Requires live Supabase connection | Run backend → check Supabase SQL editor → `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pgboss'` returns 1 row |
| `/var/uploads/test.txt` served via Nginx | STORE-02 | Requires live VPS + Nginx | Create test file → `curl VPS_PUBLIC_URL/uploads/test.txt` → 200 with content (no `internal` — public access) |
| Sign out button returns to login screen | AUTH-03 | React state requires a browser | Sign in → click "Sign out" in header → LoginPage renders immediately |
| Page refresh keeps user on app screen | AUTH-03 | Browser session persistence | Sign in → refresh page → stays on GeneratorPage (not redirected to login) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
