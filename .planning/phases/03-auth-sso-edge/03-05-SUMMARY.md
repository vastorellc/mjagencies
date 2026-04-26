---
phase: 03-auth-sso-edge
plan: 05
subsystem: auth
tags: [server-actions, eslint, mfa, session, security]
dependency_graph:
  requires:
    - "03-01: verifyAccessToken + readAccessCookie + clearAuthCookies (tokens.ts, cookie.ts)"
    - "03-02: MFA enforcement context (mfaVerifiedAt claim, REQ-024)"
    - "02-02: no-session-set ESLint rule (pattern reference for require-session-first)"
  provides:
    - "requireSession(): Node-only server action session helper with MFA enforcement"
    - "ESLint rule mjagency-auth/require-session-first at error severity"
    - "docs/runbooks/server-action-pattern.md"
  affects:
    - "03-06: audit emit uses regenerateSession path (shared — no extra wiring needed)"
    - "All 12 apps: ESLint rule inherited via packages/config/eslint/index.js"
tech_stack:
  added:
    - "packages/auth/eslint/: ESLint plugin with require-session-first rule (ESM .js)"
  patterns:
    - "TDD: RED (test first) → GREEN (implementation) → verified for both tasks"
    - "MFA auto-detection by role set (super_admin, admin); opt-in via requireMfa:true"
    - "Cookie hygiene: clearAuthCookies() BEFORE redirect on verify failure (T-03-020)"
    - "ESLint AST visitor: Program (use server detect) + ExportNamedDeclaration selectors"
key_files:
  created:
    - packages/auth/src/require-session.ts
    - packages/auth/src/__tests__/require-session.test.ts
    - packages/auth/eslint/require-session-first.js
    - packages/auth/eslint/require-session-first.test.js
    - packages/auth/eslint/index.js
    - docs/runbooks/server-action-pattern.md
  modified:
    - packages/auth/src/index.ts
    - packages/auth/package.json
    - packages/config/eslint/index.js
decisions:
  - "requireSession() is Node-only (uses next/headers + next/navigation); NOT exported from @mjagency/auth/middleware to keep the Edge bundle lean"
  - "MFA auto-detection by Set(['super_admin','admin']); editor + future roles default to no MFA unless requireMfa:true opt-in"
  - "ESLint rule written as ESM (.js) — auth package has type:module; RuleTester from eslint 9.x works fine with ESM"
  - "No auto-fix for ESLint rule — incorrect insertion would be unsafe because the action's argument types affect the call shape"
  - "Arrow function form (export const action = async () => {}) covered via VariableDeclarator > ArrowFunctionExpression selector"
  - "Function-level 'use server' directive (rare) not covered at this plan; future hardening extension point"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  tests_added: 22
  files_created: 6
  files_modified: 3
---

# Phase 03 Plan 05: requireSession + ESLint Rule + Runbook Summary

Plan 03-05 ships the server-action auth pattern as a runtime helper, compile-time ESLint rule, and runbook — 22 enforcement tests total (10 unit + 12 RuleTester).

## What Was Built

### Task 3-5.1: requireSession() helper + unit tests

**`packages/auth/src/require-session.ts`** — Node-only server action session helper:

1. `readAccessCookie()` — reads access cookie; redirects to `/login` if absent.
2. `verifyAccessToken(token)` — jose verification with locked `alg=HS256`, `iss=mjagency`, `aud=mjagency-api` (REQ-310, SEC-N8); on failure calls `clearAuthCookies()` BEFORE `redirect('/login')` (T-03-020).
3. MFA enforcement — `MFA_REQUIRED_ROLES = Set(['super_admin', 'admin'])` auto-requires; any role can opt-in via `requireSession({ requireMfa: true })`; redirects to `/mfa/verify` when `mfaVerifiedAt` absent (REQ-024).
4. Returns `VerifiedAccessPayload` on success.

**`packages/auth/src/__tests__/require-session.test.ts`** — 10 Vitest tests:

| Test | Scenario |
|------|----------|
| 1 | No cookie → redirect('/login') |
| 2 | Invalid token → clearAuthCookies() THEN redirect('/login') — order verified |
| 3 | Valid editor token → returns payload |
| 4 | Valid admin WITH mfaVerifiedAt → returns payload |
| 5 | Valid admin WITHOUT mfaVerifiedAt → redirect('/mfa/verify') |
| 6 | Valid super_admin WITHOUT mfaVerifiedAt → redirect('/mfa/verify') |
| 7 | Valid editor + requireMfa:true → redirect('/mfa/verify') |
| 8 | Valid editor + no opts → returns payload (editor does not auto-require MFA) |
| 9 | Wrong audience token (refresh JWT) → redirect('/login') |
| 10 | Expired token → clearAuthCookies() THEN redirect('/login') — order verified |

All 10 pass. Real jose sign/verify exercised end-to-end via `signAccessToken` with stubbed env secrets.

**`packages/auth/src/index.ts`** extended (additive):
```ts
export { requireSession, type RequireSessionOpts } from './require-session.js'
```

### Task 3-5.2: ESLint rule + RuleTester + base config + runbook

**`packages/auth/eslint/require-session-first.js`** — ESLint rule:
- `Program` visitor detects top-level `'use server'` Literal directive.
- `ExportNamedDeclaration > FunctionDeclaration` selector checks FunctionDeclaration form.
- `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression` covers `export const action = async () => {}` form.
- `isRequireSessionCall()` helper: checks first body statement is `VariableDeclaration` + `AwaitExpression` + `CallExpression` to `requireSession` (direct Identifier or MemberExpression).
- Exempt: names starting with `_` (private helpers).
- No auto-fix — incorrect insertion is unsafe.

**`packages/auth/eslint/require-session-first.test.js`** — 12 RuleTester cases:

| Case | Type | Scenario |
|------|------|----------|
| V1 | Valid | FunctionDeclaration, `await requireSession()` first |
| V2 | Valid | FunctionDeclaration, `await requireSession({ requireMfa: true })` |
| V3 | Valid | Arrow function, `await requireSession()` first |
| V4 | Valid | No `'use server'` directive — pass-through |
| V5 | Valid | `_internalHelper` — exempt by naming convention |
| V6 | Valid | Namespaced `await auth.requireSession()` |
| I1 | Invalid | requireSession not first — preceded by `const x = 1` |
| I2 | Invalid | Guard before requireSession — if-guard is first statement |
| I3 | Invalid | requireSession missing entirely |
| I4 | Invalid | First await is not requireSession — wrong function |
| I5 | Invalid | Arrow function, no requireSession at all |
| I6 | Invalid | Synchronous call — missing `await` |

All 12 pass via `node packages/auth/eslint/require-session-first.test.js`.

**`packages/auth/eslint/index.js`** — ESLint plugin index:
```js
export default { rules: { 'require-session-first': requireSessionFirst } }
```

**`packages/auth/package.json`** updated:
- Added `"./eslint": { "default": "./eslint/index.js" }` export
- Added `"test:eslint": "node eslint/require-session-first.test.js"` script

**`packages/config/eslint/index.js`** extended (additive — `no-session-set` preserved):
```js
import authEslintPlugin from '@mjagency/auth/eslint'
// ...appended at bottom of array:
{
  files: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
  plugins: { 'mjagency-auth': authEslintPlugin },
  rules: { 'mjagency-auth/require-session-first': 'error' },
},
```

**`docs/runbooks/server-action-pattern.md`** — canonical docs with:
- The Pattern (code example)
- Why First Line (CVE-2025-29927 + middleware bypass rationale)
- The ESLint Rule (name, severity, scope, config file, rule source, test suite)
- Recipes: plain action, MFA-required, cross-agency ownership check
- Common Mistakes: forgot await, guard before requireSession, wrong capitalisation, try/catch wrapping
- Bypass for Helpers: `_`-prefix convention explained
- Test Coverage: 12-case reference

## Plan-Time Decisions

| Decision | Rationale |
|----------|-----------|
| requireSession() is Node-only | Uses `next/headers` (cookies()) and `next/navigation` (redirect()) — not available in Edge runtime; NOT exported from `@mjagency/auth/middleware` |
| MFA auto-detection via Set | Explicit enumeration of `super_admin` and `admin`; easy to extend; `editor` defaults to no MFA |
| ESLint rule as ESM `.js` | `packages/auth` has `"type":"module"`; ESLint 9.x RuleTester works with ESM natively |
| No auto-fix | Safe insertion requires knowledge of function signature — too risky to auto-insert |
| Arrow function form covered | `export const action = async () => {}` is common in Next.js; covered via VariableDeclarator selector |
| Function-level `'use server'` not covered | Rare in practice; deferred to future hardening |

## Test Summary

| Test Suite | Count | Status |
|-----------|-------|--------|
| require-session.test.ts (Vitest) | 10 | All pass |
| require-session-first.test.js (RuleTester) | 12 | All pass |
| **Total enforcement tests** | **22** | **All pass** |

## Requirements Satisfied

| Requirement | Description | How |
|-------------|-------------|-----|
| REQ-031 | requireSession() as first line of server actions | Helper + ESLint rule |
| REQ-301 | Server action auth check | requireSession() implementation |
| REQ-024 | MFA enforcement for privileged roles | Auto-detect super_admin/admin in requireSession() |
| REQ-310 | Locked alg/iss/aud on every verify | Uses verifyAccessToken (03-01) exclusively |

## STRIDE Threat Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-03-018 | ESLint rule at error severity prevents missing requireSession() from merging |
| T-03-019 | requireSession() auto-detects admin/super_admin and redirects to /mfa/verify if mfaVerifiedAt absent |
| T-03-020 | clearAuthCookies() called BEFORE redirect() on verify failure; Test 2 + Test 10 prove order |

## Files Plan 03-06 Consumes

- `requireSession()` is the shared verify path; `regenerateSession` (used by login + SSO) shares the same token primitives.
- Plan 03-06 adds the audit emit on `regenerateSession` calls — no extra wiring needed here.
- Plan 03-06 also adds the CVE-2025-29927 Next.js version CI gate (`>=15.2.3`).

## Deviations from Plan

None. Plan executed exactly as written with one minor adaptation:
- ESLint rule and test written as ESM `.js` (not CJS `'use strict'`/`module.exports`) because `packages/auth` has `"type":"module"`. ESLint 9.x RuleTester accepts ESM. This is equivalent to the plan's CJS specification and was the appropriate adaptation for the package's module system.

## Self-Check

### Files created/modified
- [x] `packages/auth/src/require-session.ts` — exists, contains `verifyAccessToken|readAccessCookie|clearAuthCookies|redirect.*login|redirect.*mfa|MFA_REQUIRED_ROLES|requireMfa`
- [x] `packages/auth/src/__tests__/require-session.test.ts` — exists, contains 10 `it(...)` blocks
- [x] `packages/auth/src/index.ts` — contains `requireSession` export
- [x] `packages/auth/eslint/require-session-first.js` — exists, contains `use server|missingRequireSession|ExportNamedDeclaration`
- [x] `packages/auth/eslint/require-session-first.test.js` — exists, contains `RuleTester|valid:|invalid:`
- [x] `packages/auth/eslint/index.js` — exists, contains `require-session-first`
- [x] `packages/auth/package.json` — contains `./eslint` export + `test:eslint` script
- [x] `packages/config/eslint/index.js` — contains `mjagency-auth/require-session-first` at error severity
- [x] `docs/runbooks/server-action-pattern.md` — exists, contains REQ-031, CVE-2025-29927, Common Mistakes

### Commits
- [x] `026c27b` — Task 5.1 (requireSession helper + tests)
- [x] `4bc806e` — Task 5.2 (ESLint rule + RuleTester + runbook)

### Test results
- [x] `vitest run src/__tests__/require-session.test.ts` — 10/10 pass
- [x] `node packages/auth/eslint/require-session-first.test.js` — 12/12 pass

## Self-Check: PASSED
