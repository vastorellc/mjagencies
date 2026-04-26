---
phase: 05-central-cms
plan: 01
subsystem: cms
tags: [payload, cms, payload-cms, access-control, typescript, nextjs, postgres]

# Dependency graph
requires:
  - phase: 03-auth-sso-edge
    provides: requireSession() and VerifiedAccessPayload type used in access control helpers
  - phase: 01-foundation-infra
    provides: Turborepo monorepo, packages/cms stub, apps/web-main with Next.js 15 + Payload peer deps
provides:
  - packages/cms exports buildPayloadConfig(), collectionAccess(), deleteAccess(), fieldImmutable(), superAdminOnly()
  - apps/web-main/payload.config.ts wired to @mjagency/cms buildPayloadConfig()
  - Payload (payload) route group with /admin and /api routes in apps/web-main
  - @payload-config TypeScript path alias resolving payload.config.ts
  - importMap.ts bootstrap stub for Payload component registry
affects: [05-02, 05-03a, 05-03b, 05-03c, 05-04, 05-05, 05-06]

# Tech tracking
tech-stack:
  added:
    - "@payloadcms/db-postgres 3.82.1 (peerDev in @mjagency/cms)"
    - "@payloadcms/richtext-lexical 3.82.1 (peerDev in @mjagency/cms)"
    - "payload 3.82.1 peerDependency in @mjagency/cms package.json"
    - "@mjagency/cms workspace dependency added to web-main"
  patterns:
    - "buildPayloadConfig() wraps Payload's buildConfig() — apps import from @mjagency/cms not payload directly"
    - "collectionAccess uses req.user.role + req.user.agencyId for agency-scoped access"
    - "Access defaults to false — explicit grants required (T-05-01-01 mitigated)"
    - "@payload-config TypeScript path alias for payload.config.ts"

key-files:
  created:
    - "packages/cms/src/access/collection-access.ts"
    - "packages/cms/src/config/build-payload-config.ts"
    - "apps/web-main/src/app/(payload)/importMap.ts"
  modified:
    - "packages/cms/src/index.ts (replaced cmsPlaceholder stub with real exports)"
    - "packages/cms/package.json (added peer/workspace deps)"
    - "apps/web-main/payload.config.ts (wired to buildPayloadConfig)"
    - "apps/web-main/tsconfig.json (added @payload-config alias + payload.config.ts include)"
    - "apps/web-main/src/app/(payload)/admin/[[...segments]]/page.tsx"
    - "apps/web-main/src/app/(payload)/admin/[[...segments]]/not-found.tsx"
    - "apps/web-main/src/app/(payload)/api/[...slug]/route.ts"
    - "apps/web-main/src/app/(payload)/api/graphql/route.ts"
    - "apps/web-main/src/app/(payload)/api/graphql-playground/route.ts"

key-decisions:
  - "buildPayloadConfig() wraps payload's buildConfig() to return SanitizedConfig Promise — required by @payloadcms/next route handlers"
  - "importMap.ts bootstrapped as empty {} for Plan 05-01 — withPayload() regenerates it at build with real component paths"
  - "@payload-config path alias + payload.config.ts in tsconfig include — fixes TS module resolution for route group imports"
  - "Access helpers default to false; super_admin gets unrestricted access, admin/editor get agency-scoped WHERE clause"

patterns-established:
  - "Access pattern: SUPER_ROLES check first, then AGENCY_WRITE_ROLES with agencyId, default false — prevents elevation of privilege"
  - "fieldImmutable = () => false — used on agency_id fields to enforce immutability post-creation"
  - "All Payload route handlers use @payload-config alias (not relative paths) to import payload.config.ts"
  - "buildPayloadConfig() as the single config factory — prevents drift between apps"

requirements-completed: [REQ-050, REQ-051, REQ-305]

# Metrics
duration: 21min
completed: 2026-04-26
---

# Phase 05 Plan 01: Payload CMS 3.82.1 Bootstrap Summary

**Payload CMS 3.82.1 wired into apps/web-main with buildPayloadConfig() factory, typed access control helpers (collectionAccess, deleteAccess, fieldImmutable, superAdminOnly), and working (payload) route group at /admin**

## Performance

- **Duration:** 21 min
- **Started:** 2026-04-26T07:46:08Z
- **Completed:** 2026-04-26T08:07:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Replaced `cmsPlaceholder()` stub in `packages/cms` with production-ready `buildPayloadConfig()` factory and access control helpers
- Wired `apps/web-main/payload.config.ts` to `@mjagency/cms` — single source of truth for Payload config shared across all agency apps
- Fixed `(payload)` route group: admin page, not-found, REST API, and GraphQL routes all use `@payload-config` alias and correct Payload 3.82.1 API signatures
- Security model implemented: `collectionAccess` defaults false, super_admin unrestricted, admin/editor get `{ agency_id: { equals: agencyId } }` WHERE clause, fieldImmutable prevents agency_id mutation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Payload dependencies and create access + config helpers** - `031a2e9` (feat)
2. **Task 2: Wire payload.config.ts to buildPayloadConfig and fix route group** - `0207c44` (feat)

**Plan metadata:** `[TBD — final commit below]` (docs: complete plan)

## Files Created/Modified

- `packages/cms/src/access/collection-access.ts` — collectionAccess, deleteAccess, fieldImmutable, superAdminOnly helpers
- `packages/cms/src/config/build-payload-config.ts` — buildPayloadConfig() wrapping Payload's buildConfig()
- `packages/cms/src/index.ts` — package entry re-exporting all cms helpers (cmsPlaceholder removed)
- `packages/cms/package.json` — added @mjagency/auth, @mjagency/config, @mjagency/queue workspace deps; payload peerDep; @payloadcms/* devDeps
- `apps/web-main/payload.config.ts` — delegates to buildPayloadConfig() from @mjagency/cms
- `apps/web-main/tsconfig.json` — @payload-config alias + payload.config.ts in include
- `apps/web-main/src/app/(payload)/importMap.ts` — empty ImportMap bootstrap for Plan 05-01
- `apps/web-main/src/app/(payload)/admin/[[...segments]]/page.tsx` — RootPage with config+importMap+params+searchParams
- `apps/web-main/src/app/(payload)/admin/[[...segments]]/not-found.tsx` — NotFoundPage with correct 3.82.1 API
- `apps/web-main/src/app/(payload)/api/[...slug]/route.ts` — REST handlers using @payload-config alias
- `apps/web-main/src/app/(payload)/api/graphql/route.ts` — GraphQL POST using @payload-config alias
- `apps/web-main/src/app/(payload)/api/graphql-playground/route.ts` — GraphQL playground using @payload-config alias

## Decisions Made

- **buildPayloadConfig wraps buildConfig():** Route handlers (`RootPage`, `REST_GET`, etc.) in @payloadcms/next 3.82.1 expect `Promise<SanitizedConfig>`, not `Config`. Wrapping `buildConfig()` satisfies this without changing the caller interface.
- **importMap.ts empty bootstrap:** Payload's `withPayload()` regenerates `importMap.js` at build time from component registry. For Plan 05-01 (no custom components), an empty `ImportMap = {}` is correct. Plans 05-02+ will populate custom block component paths.
- **@payload-config alias over relative paths:** The pre-existing route.ts files used `'../../../../payload.config'` which resolved to `src/` (wrong directory). The Payload-recommended alias `@payload-config` → `./payload.config.ts` is the correct pattern and is stable across directory restructuring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong relative import path in existing Payload route files**
- **Found during:** Task 2 (Wire payload.config.ts)
- **Issue:** Existing `(payload)/api/[...slug]/route.ts`, `graphql/route.ts`, and `graphql-playground/route.ts` imported `from '../../../../payload.config'` — 4 directory levels up from route file lands at `src/`, not the app root where `payload.config.ts` lives. TypeScript TS2307 "Cannot find module" confirmed the path was broken.
- **Fix:** Replaced all three broken relative imports with `@payload-config` alias. Added `"@payload-config": ["./payload.config.ts"]` to `tsconfig.json` paths and added `"payload.config.ts"` to `tsconfig.json` include array.
- **Files modified:** `apps/web-main/src/app/(payload)/api/[...slug]/route.ts`, `graphql/route.ts`, `graphql-playground/route.ts`, `apps/web-main/tsconfig.json`
- **Verification:** TypeScript TS2307 errors for these files resolved.
- **Committed in:** `0207c44` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed RootPage/NotFoundPage API signature — added config, importMap, params as Promise**
- **Found during:** Task 2 (Wire payload.config.ts)
- **Issue:** The pre-existing `page.tsx` called `generatePageMetadata({ params, searchParams })` and `RootPage({ params, searchParams })` without `config` or `importMap` — both required by Payload 3.82.1's typed API (`config: Promise<SanitizedConfig>`, `importMap: ImportMap`, `params: Promise<{ segments: string[] }>`).
- **Fix:** Updated page.tsx and not-found.tsx to pass `config` (from @payload-config), `importMap` (from importMap.ts), and properly typed `params`/`searchParams` as `Promise<...>`.
- **Files modified:** `apps/web-main/src/app/(payload)/admin/[[...segments]]/page.tsx`, `not-found.tsx`
- **Verification:** TypeScript errors for these files resolved.
- **Committed in:** `0207c44` (Task 2 commit)

**3. [Rule 2 - Missing Critical] Added @mjagency/cms dependency to apps/web-main/package.json**
- **Found during:** Task 2 (Wire payload.config.ts)
- **Issue:** `payload.config.ts` imports from `@mjagency/cms` but `apps/web-main/package.json` did not declare this workspace dependency — the import would fail at runtime and at build time.
- **Fix:** Added `"@mjagency/cms": "workspace:*"` to `dependencies` in `apps/web-main/package.json`.
- **Files modified:** `apps/web-main/package.json`, `pnpm-lock.yaml`
- **Verification:** TypeScript resolves @mjagency/cms types; `pnpm install` succeeded.
- **Committed in:** `0207c44` (Task 2 commit)

**4. [Rule 1 - Bug] Updated buildPayloadConfig to call buildConfig() from payload**
- **Found during:** Task 2 (typecheck revealed type mismatch)
- **Issue:** Original plan specified `buildPayloadConfig()` returning `Config` — but `@payloadcms/next` route handlers (`REST_GET`, `RootPage`, `generatePageMetadata`) all require `Promise<SanitizedConfig>`. The `buildConfig()` function from `payload` package returns the correct type.
- **Fix:** Changed `buildPayloadConfig()` to call `buildConfig(opts)` from `payload` package and return `ReturnType<typeof buildConfig>`.
- **Files modified:** `packages/cms/src/config/build-payload-config.ts`
- **Verification:** TypeScript errors for route files resolved; `pnpm --filter @mjagency/cms typecheck` passes.
- **Committed in:** `0207c44` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical, 1 Rule 1 type fix)
**Impact on plan:** All fixes were necessary for correctness and TypeScript compliance. No scope creep. The plan's specified output shapes are preserved.

## Issues Encountered

- **Pre-existing TypeScript errors in other packages:** `packages/db/src/schema/*.ts` (Drizzle RLS `PgPolicyToOption` type mismatch), `packages/config/src/otel-node.ts` (OpenTelemetry semantic conventions import), and `src/__tests__/otel-tempo.integration.test.ts` (`@mjagency/testing/tempo-client` missing) are pre-existing failures from Phases 1-3. These are out of scope per deviation rules (not caused by Plan 05-01 changes). Deferred to relevant phase owners.

## Deferred Issues

| Issue | File | Phase |
|-------|------|-------|
| `SQL<unknown>` not assignable to `PgPolicyToOption` | `packages/db/src/schema/mfa-config.ts`, `sessions.ts`, `users.ts`, `permissions-vault.ts` | Phase 02 (Drizzle RLS) |
| `ATTR_SERVICE_NAMESPACE` missing from `@opentelemetry/semantic-conventions` | `packages/config/src/otel-node.ts` | Phase 01 (OTel) |
| `@mjagency/testing/tempo-client` not found | `apps/web-main/src/__tests__/otel-tempo.integration.test.ts` | Phase 01 (testing) |

## Known Stubs

- `apps/web-main/src/app/(payload)/importMap.ts` — Empty `ImportMap = {}`. This is intentional for Plan 05-01 bootstrap. `withPayload()` regenerates this at build time. Plans 05-02+ will populate custom Payload component paths. The empty map does not affect functionality (no custom components yet).
- `apps/web-main/payload.config.ts` — `collections: []` comment says "Plan 05-02 adds all 10 core collections here". This is correct and intentional.

## Threat Surface Scan

All STRIDE threats from the plan's `<threat_model>` are mitigated:

| Threat ID | Mitigation | Verified |
|-----------|-----------|---------|
| T-05-01-01 Elevation of Privilege | `collectionAccess` checks `req.user.role` explicitly; default return is `false` | collectionAccess returns false if no user |
| T-05-01-02 Information Disclosure | `meta.robots: 'noindex, nofollow'` in buildPayloadConfig admin config | In build-payload-config.ts line 48 |
| T-05-01-03 Spoofing | `fieldImmutable = () => false` exported for agency_id fields | In collection-access.ts |
| T-05-01-04 Elevation of Privilege | `secret` sourced from `process.env.PAYLOAD_SECRET ?? ''`; no NEXT_PUBLIC_ | In payload.config.ts |

No new threat surface introduced beyond what was planned.

## User Setup Required

None - no external service configuration required for this plan. `DATABASE_URL` and `PAYLOAD_SECRET` env vars are required at runtime but were already documented in Phase 1 Doppler setup.

## Next Phase Readiness

- **Plan 05-02 ready:** `buildPayloadConfig()` accepts `collections?: CollectionConfig[]` — Plan 05-02 fills this with the 10 core collections
- **Access helpers ready:** `collectionAccess`, `deleteAccess`, `fieldImmutable`, `superAdminOnly` are exported from `@mjagency/cms` for immediate use in all 05-02 collection definitions
- **Concern:** Pre-existing TypeScript errors in `packages/db` and `packages/config` may surface during 05-02 integration testing if those packages are transitively typechecked. Phase owners should address the Drizzle RLS type issue and OTel semantic conventions version mismatch.

---
*Phase: 05-central-cms*
*Completed: 2026-04-26*
