---
phase: 03-auth-sso-edge
plan: "06"
subsystem: audit-emit-redirect-cve-gate
status: complete
completed: 2026-04-26
duration: ~35min
tags:
  - audit
  - open-redirect
  - cve
  - last-admin-guard
---

# Phase 3 Plan 06: Audit Emit + Open-Redirect Prevention + Last-Admin Guard + CVE-2025-29927 CI Gate

**Wires Phase 2's audit hash chain into auth events, prevents open-redirect at the canonical layer, blocks last-admin self-delete with both server-action guard + DB trigger backstop, and adds the third layer of CVE-2025-29927 defense via a CI version gate.**

## Accomplishments

### Task 6.1 — Open-redirect + last-admin guard + DB trigger
- `packages/auth/src/redirect.ts` — `validateReturnTo()` canonical same-origin gate (REQ-308, REQ-424, SEC-N5, T-03-021). Rejects external origins, protocol-relative `//`, and `javascript:/data:/vbscript:/file:` schemes. Returns `null` (forces fallback to safe default) on any non-same-origin input.
- `packages/auth/src/guards.ts` — `assertNotAgencyOwner()` server-action guard (REQ-028, REQ-400, T-03-022). Early-returns when actor is deleting someone else; throws `ForbiddenError` if actor is deleting themselves AND they are the last admin.
- `packages/db/src/migrations/custom/006_prevent_last_admin_delete.sql` — `BEFORE DELETE` trigger backstop. Raises `RAISE EXCEPTION 'Cannot delete the last admin user' USING ERRCODE = 'integrity_constraint_violation'`. Defense-in-depth: even if a future code path bypasses `assertNotAgencyOwner`, the DB enforces invariant.
- `packages/db/src/migrate/apply-custom.ts` — `CUSTOM_FILES` extended from 5 to 6 entries (cross-plan touch from Plan 02-03's pattern).
- `apps/web-main/src/app/api/auth/login/route.ts` — replaced inline `validateReturnToInline()` with import from `@mjagency/auth`.
- 13 unit tests for redirect; 5 integration tests for guards (skip without DB).

### Task 6.2 — Audit emit + CVE CI gate
- `packages/auth/src/audit-emit.ts`:
  - `setAppActor(tx, userId)` — wraps `SET LOCAL app.actor_id` so Phase 2 hash-chain triggers attribute correctly (REQ-027, T-03-023).
  - `emitAuthAudit()` — Pino observability (NOT compliance log — DB triggers handle the compliance trail).
  - `AuthEventName` union — 14 canonical event names (login, logout, refresh, mfa_setup, mfa_verify, etc.).
- `scripts/check-next-version.ts` — walks all 26 `package.json` files in monorepo, exits 1 if any `next` version < 15.2.3 (REQ-029, CVE-2025-29927). Exits 0 against current monorepo (Next.js 15.5.x).
- `.github/workflows/pr.yml` — new `cve-2025-29927-gate` job added (`needs: install`, runs `pnpm tsx scripts/check-next-version.ts`).
- `docs/runbooks/auth-audit-events.md` — 14 auth event catalog, `capture_audit_row` contract, SQL query examples, **DB-vs-Pino split** (DB = compliance, Pino = ops), three-layer CVE defense reference.
- 4 audit-emit tests: 1 unit passes (Pino event field format); 3 integration skip without DB.

## Key Decisions Locked

1. **DB-vs-Pino split:** Audit triggers (Phase 2) handle the immutable, hash-chained compliance log. Pino emits human-readable structured events for operations dashboards. Don't conflate.
2. **Defense-in-depth for last-admin delete:** Server-action guard (`assertNotAgencyOwner`) AS the primary check; DB trigger 006 as backstop for SQL-direct paths.
3. **Open-redirect:** strict same-origin via canonical `validateReturnTo`. Returns null instead of throwing — caller falls back to safe default URL.

## Three-Layer CVE-2025-29927 Defense Complete

| Layer | Where | Mechanism |
|-------|-------|-----------|
| 1. Network edge | Plan 03-04 | Cloudflare WAF managed rule blocks `x-middleware-subrequest` injection |
| 2. CI gate | Plan 03-06 (this) | `scripts/check-next-version.ts` blocks any PR with Next.js < 15.2.3 |
| 3. App code | Plan 03-05 | `requireSession()` first line in every server action — no middleware bypass possible |

## Self-Check

- [x] All 2 tasks executed
- [x] redirect.ts: 13 unit tests pass
- [x] guards.ts: 5 integration tests skip cleanly without DB
- [x] CUSTOM_FILES has 6 entries (001-006)
- [x] CI workflow has cve-2025-29927-gate job
- [x] audit-emit.ts unit test passes (Pino field format)
- [x] No `jsonwebtoken` introduced anywhere
- [x] Three-layer CVE defense verified

## Operator Note

The agent's worktree-level commits landed cleanly (020a3c3, 29031d4). The SUMMARY.md was originally written to the orchestrator's main filesystem (untracked) and got cleaned during the pre-merge clean step; this file was reconstructed from the agent's completion report. No data loss — all implementation files are committed and in main.

## Next

**Phase 3 ✅ COMPLETE.** All 6 plans done.
- 03-01 ✓ JWT (jose) + cookies + Redis revocation
- 03-02 ✓ MFA TOTP + recovery codes
- 03-03 ✓ SSO at accounts.brand.com
- 03-04 ✓ Cloudflare middleware
- 03-05 ✓ requireSession + ESLint
- 03-06 ✓ Audit emit + CVE gate + last-admin guard

Phase 4: Design System + Theme Engine.
