---
phase: 01-backend-auth-foundation
plan: 01
subsystem: scaffold
tags: [setup, dependencies, testing, environment]
dependency_graph:
  requires: []
  provides:
    - backend/package.json — pinned dependency manifest for all subsequent backend plans
    - backend/vitest.config.ts — test framework enabling all test execution
    - backend/src/middleware/admin.ts — adminMiddleware for AUTH-05/06
    - backend/src/lib/storage.ts — initStorage/cleanupStaleFiles for STORE-01/04
    - frontend/package.json — pinned frontend dependency manifest
    - .env.example — complete environment variable documentation
    - scripts/make-admin.ts — one-time admin JWT claim setter
    - .gitignore — .env excluded from version control (T-01-01 threat)
  affects: []
tech_stack:
  added:
    - express 5.2.1 (backend HTTP server)
    - "@supabase/supabase-js 2.105.1 (auth + DB client)"
    - drizzle-orm 0.45.2 (ORM)
    - pg 8.20.0 (PostgreSQL driver)
    - pg-boss 12.18.1 (job queue)
    - cors 2.8.6 (CORS middleware)
    - pino 10.3.1 (structured logging)
    - multer 1.4.5-lts.2 (file upload parsing)
    - typescript 6.0.3 (type system, strict mode)
    - tsx 4.21.0 (TypeScript dev runner)
    - drizzle-kit 0.31.10 (schema generation + migration)
    - vitest ^3.0.0 (test framework — resolves to 3.2.4)
    - react 19.2.5 (frontend framework)
    - react-dom 19.2.5 (React DOM renderer)
    - vite ^6.4.2 (frontend build tool)
    - tailwindcss 4.2.4 (CSS framework)
    - "@tailwindcss/vite 4.2.4 (Tailwind Vite integration)"
  patterns:
    - pinned exact versions for all locked dependencies (no ^ or ~ on express, @types/express)
    - NodeNext module resolution for backend ESM
    - Bundler module resolution for frontend
    - vitest globals mode with 30s timeout for integration tests
key_files:
  created:
    - backend/package.json
    - backend/tsconfig.json
    - backend/vitest.config.ts
    - backend/package-lock.json
    - backend/src/middleware/admin.ts
    - backend/src/lib/storage.ts
    - backend/tests/auth.test.ts
    - backend/tests/rls.test.ts
    - backend/tests/admin.test.ts
    - backend/tests/storage.test.ts
    - frontend/package.json
    - frontend/tsconfig.json
    - frontend/package-lock.json
    - .env.example
    - .gitignore
    - scripts/make-admin.ts
  modified: []
decisions:
  - "@vitejs/plugin-react downgraded from 6.0.1 to 4.7.0 — v6 requires vite@^8 which conflicts with locked vite@^6"
  - "adminMiddleware and storage.ts created alongside test stubs (tests require import targets to exist)"
  - ".gitignore created as part of this plan — T-01-01 threat mitigation requires .env exclusion"
metrics:
  duration: 6 minutes
  completed: "2026-05-01T04:39:04Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 16
  files_modified: 0
---

# Phase 1 Plan 01: Project Scaffold and Dependency Installation Summary

**One-liner:** Backend and frontend scaffolded with exact pinned dependency versions, Vitest test infrastructure confirmed passing (2 tests, 8 todo stubs), and complete environment variable documentation.

## What Was Built

Two tasks executed out of three total. Task 3 is a blocking checkpoint requiring manual Supabase project setup.

### Task 1 — Backend package manifests and TypeScript config
- `backend/package.json` with `"express": "5.2.1"` and `"@types/express": "5.0.6"` (exact pins, no ^ or ~)
- `backend/tsconfig.json` with strict mode, NodeNext module resolution, ES2022 target
- `backend/vitest.config.ts` with 30-second timeout and `tests/**/*.test.ts` glob
- `npm install` completed: 279 packages installed, 0 critical vulnerabilities

### Task 2 — Test stubs, frontend scaffold, .env.example, make-admin script
- 4 backend test stub files covering: AUTH-02, AUTH-04, AUTH-05/06, STORE-01
- `backend/src/middleware/admin.ts` — adminMiddleware implementation (required by admin.test.ts import)
- `backend/src/lib/storage.ts` — initStorage + cleanupStaleFiles (STORE-01 / STORE-04)
- `frontend/package.json` with React 19.2.5, Vite ^6.4.2, Tailwind CSS 4.2.4
- `frontend/tsconfig.json` with strict mode and Bundler moduleResolution
- `.env.example` documenting all 10 required environment variables with inline security notes
- `scripts/make-admin.ts` implementing Pattern 3 from RESEARCH.md exactly
- `.gitignore` created to protect `.env` from being committed (T-01-01 mitigation)
- `npm install` in frontend: 95 packages, 0 vulnerabilities
- `npx vitest run` in backend: exits 0 (2 tests passing, 8 todo)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @vitejs/plugin-react version incompatible with Vite 6**
- **Found during:** Task 2 frontend npm install
- **Issue:** Plan specified `@vitejs/plugin-react@6.0.1` which requires `vite@^8.0.0`. The stack has `vite@^6.4.2` locked in CLAUDE.md. `npm install` failed with ERESOLVE peer dependency conflict.
- **Fix:** Downgraded to `@vitejs/plugin-react@4.7.0` — this version supports `vite: "^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0"`, fully compatible with the locked Vite 6 constraint.
- **Files modified:** `frontend/package.json`
- **Commit:** 3812e5f

**2. [Rule 2 - Missing critical functionality] adminMiddleware and storage source files required by test imports**
- **Found during:** Task 2 test execution
- **Issue:** `admin.test.ts` imports `../src/middleware/admin.js` and `storage.test.ts` imports `../src/lib/storage.js`. Without these files, `npx vitest run` would fail at module resolution.
- **Fix:** Created `backend/src/middleware/admin.ts` (Pattern 2 from RESEARCH.md) and `backend/src/lib/storage.ts` (Pattern 9 from RESEARCH.md) as full implementations (not stubs — they are small and complete).
- **Files created:** `backend/src/middleware/admin.ts`, `backend/src/lib/storage.ts`
- **Commit:** 3812e5f

**3. [Rule 2 - Security] .gitignore missing — .env exposure risk**
- **Found during:** Task 2 environment setup
- **Issue:** No `.gitignore` existed in the project root. `.env` is mentioned as "never commit" in CLAUDE.md and the plan verification steps. Threat T-01-01 requires `.env` be excluded.
- **Fix:** Created comprehensive `.gitignore` covering `.env`, `node_modules`, `dist`, and upload directories.
- **Files created:** `.gitignore`
- **Commit:** 3812e5f

## Security Notes (Threat Register Coverage)

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-01-01 | Mitigated | `.gitignore` excludes `.env`; `.env.example` comment: "NEVER put this in VITE_ env vars" |
| T-01-02 | Accepted | `scripts/make-admin.ts` reads from `.env` only; no hardcoded credentials |

## Known Stubs

The following test cases are `it.todo` stubs — implementations deferred to later waves:

| File | Stub | Deferred to |
|------|------|-------------|
| backend/tests/auth.test.ts | 4 auth middleware tests | Wave 2 (when app.ts is created) |
| backend/tests/rls.test.ts | 3 RLS tests | Wave 2 (requires live Supabase users) |
| backend/tests/admin.test.ts | 1 admin pass-through test | Wave 2 |

These stubs are intentional — they document the test plan for Wave 2 and do not block this plan's goal. `npx vitest run` exits 0 with all todos shown as skipped.

## Task 3 — Awaiting Human Action

Task 3 is a `checkpoint:human-action` requiring the user to:
1. Create a Supabase project at https://supabase.com/dashboard
2. Disable public email signup (AUTH-01)
3. Create the admin user account
4. Confirm password reset email template is present (AUTH-07)
5. Copy credentials to `.env`

See the checkpoint message below for full instructions.

## Self-Check: PASSED

Files confirmed present:
- backend/package.json — contains "express": "5.2.1"
- backend/tsconfig.json — contains "strict": true
- backend/vitest.config.ts — contains tests/**/*.test.ts
- backend/src/middleware/admin.ts — contains adminMiddleware
- backend/src/lib/storage.ts — contains initStorage
- backend/tests/auth.test.ts — contains "Auth middleware (AUTH-02)"
- backend/tests/rls.test.ts — contains "Row Level Security (AUTH-04)"
- backend/tests/admin.test.ts — contains "Admin middleware (AUTH-05, AUTH-06)"
- backend/tests/storage.test.ts — contains "Storage init (STORE-01)"
- frontend/package.json — contains "react": "19.2.5"
- .env.example — contains SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL
- scripts/make-admin.ts — contains app_metadata: { role: 'admin' }
- .gitignore — contains .env

Commits confirmed:
- 5efdd53: chore(01-01): scaffold backend package manifests and TypeScript config
- 3812e5f: feat(01-01): add test stubs, frontend scaffold, env docs, and admin setup script
