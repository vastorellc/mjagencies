---
phase: 1
slug: foundation-infra
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.6.x (pinned in `packages/testing/vitest.config.ts`) |
| **Config file** | `packages/testing/vitest.config.ts` (Wave 0 — installs in slice 1 / Task 1.1) |
| **Quick run command** | `pnpm turbo run lint typecheck test --filter=...[origin/main]` (Turbo-affected only) |
| **Full suite command** | `pnpm turbo run lint typecheck test build size-limit` |
| **Estimated runtime** | Quick: ~30s (typical task) · Full: ~3–5min (cold cache) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm turbo run lint typecheck test --filter=...[origin/main]` (Turbo-affected, sub-30s for typical task)
- **After every plan wave:** Run `pnpm turbo run lint typecheck test build size-limit` (full suite)
- **Before phase verification:** Full suite green AND all Wave 0 test files exist AND CI green on milestone branch
- **Max feedback latency:** 30 seconds for task commits (Turbo affected); 5 minutes for wave gates

---

## Per-Task Verification Map

> **Skeleton.** The planner populates this as plans are written. Each task in every PLAN.md emits a row here through its `<acceptance_criteria>` and verification commands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD by planner | — | — | — | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase 1 Success Criteria → Verification (from RESEARCH §Validation Architecture)

| # | Criterion | Verification | Artifact |
|---|-----------|-------------|----------|
| 1 | `pnpm dev --filter=@mjagency/web-main` starts | CI job `dev-smoke`: `pnpm install --frozen-lockfile && pnpm dev --filter=@mjagency/web-main &` then `wait-on http://localhost:3000 -t 60000` then `curl -fsS http://localhost:3000` ≠ error | `.github/workflows/pr.yml` job `dev-smoke`; helper `scripts/dev-smoke.ts` |
| 2 | Docker Compose: all services healthy | `docker compose --profile dev up -d` then `docker compose ps --format json \| jq -e 'all(.[]; .Health == "healthy" or .State == "running")'` | `.github/workflows/pr.yml` job `compose-smoke`; helper `scripts/compose-smoke.ts` |
| 3 | CF Images upload returns AVIF URL | Vitest integration in `packages/media` gated by `INTEGRATION=cloudflare-images`; uploads 1×1 PNG, asserts response URL ends `/avif` and is fetchable | `packages/media/src/__tests__/cloudflare-images.integration.test.ts` |
| 4 | OTel trace visible in Tempo end-to-end | Vitest integration: bring up compose; `curl -H 'traceparent: …' /api/health`; `GET http://localhost:3200/api/traces/<id>`; assert spans include route handler + DB query | `apps/web-main/src/__tests__/otel-tempo.integration.test.ts` + `packages/testing/src/tempo-client.ts` |
| 5 | CI green on main | Full pipeline (`.github/workflows/main.yml`); branch protection requires green | GitHub branch protection (manual, documented in `docs/runbooks/github-setup.md`) |
| 6 | `pnpm list payload` = 3.82.1 across all apps | `pnpm list payload --depth=0 --json \| jq -e 'all(.[]; .dependencies.payload.version == "3.82.1")'` | CI job `security-grep` step `REQ-501` |

---

## Per-Requirement Verification Map (REQ-001…REQ-503)

| Req ID | Verification | Artifact |
|--------|-------------|----------|
| REQ-001 | `pnpm install --frozen-lockfile` succeeds; workspace lists 13 apps + 13 packages via `pnpm -r exec node -e 'console.log(require("./package.json").name)'` | CI job `install` |
| REQ-002 | Covered by Success Criterion #2 | as above |
| REQ-003 | `pnpm turbo run typecheck --filter=@mjagency/media` green; integration test gated by `INTEGRATION=cloudflare-images` (Success Criterion #3) | as above |
| REQ-004 | Covered by Success Criterion #4 | as above |
| REQ-005 | CI green on main; canary gate is M012 (deferred at M001) | branch protection |
| REQ-006 | Manual: `docs/runbooks/vps-provisioning.md` documents 8GB+4GB swap requirement | runbook file existence in CI |
| REQ-007 | Dev only at M001: `pm2 start ecosystem.config.cjs && pm2 jlist \| jq '[.[] \| select(.name \| startswith("pgbouncer-"))] \| length' == 13` (prod app PM2 cluster mode is M012) | `scripts/dev-pm2-smoke.sh` |
| REQ-304 | Covered by REQ-503 grep | as above |
| REQ-307 / REQ-426 | Vitest unit on `createLogger()`: log object containing `password`, `email`, `phone`, `token`, `secret`, `apiKey`, `creditCard`, `ssn`, `refreshToken`, `accessToken`, `jti` — assert each redacts to `[REDACTED]` | `packages/config/src/__tests__/logger.test.ts` |
| REQ-427 | `scripts/scan-next-data.ts` builds web-main, scans `.next/server/app/**/*.html` for known secret patterns; exit 0 = pass | `.github/workflows/pr.yml` job `next-data-secret-audit` |
| REQ-428 | Manual at signup: `doppler projects list \| grep -c '^mjagency-' >= 13` (or 1+13 configs if free-tier fallback) | `docs/runbooks/secrets.md` checklist |
| REQ-501 | `pnpm list payload --depth=0 \| grep "payload 3.82.1"` (all workspaces) | CI job `install` |
| REQ-502 | `! grep -rn "jsonwebtoken" apps packages --include='*.ts' --include='*.tsx' --include='package.json'` | CI job `security-grep` |
| REQ-503 | `! grep -rnE "NEXT_PUBLIC_[A-Z_]*KEY" apps packages --include='*.ts' --include='*.tsx' --include='*.env*'` | CI job `security-grep` |

---

## Wave 0 Requirements

Test infrastructure that must exist before per-requirement tests run. Created in slice 1 / 2 / 5 of Phase 1.

- [ ] `packages/testing/vitest.config.ts` — shared Vitest config + tsconfig + coverage setup
- [ ] `packages/testing/src/fixtures/agency-fixture.ts` — 12 agency slugs + UUIDs for tests
- [ ] `packages/testing/src/msw/handlers.ts` — base MSW handlers (Stripe webhook, CF Images, Cal.com)
- [ ] `packages/testing/src/tempo-client.ts` — Tempo HTTP query helper for OTel integration tests
- [ ] `packages/config/src/__tests__/logger.test.ts` — Pino redact (REQ-307, REQ-426)
- [ ] `apps/web-main/src/__tests__/health.test.ts` — `/api/health` + OTel + metrics smoke
- [ ] `apps/web-main/src/__tests__/otel-tempo.integration.test.ts` — Success Criterion #4
- [ ] `packages/media/src/__tests__/cloudflare-images.integration.test.ts` — Success Criterion #3 (gated by `INTEGRATION=cloudflare-images`)
- [ ] `scripts/scan-next-data.ts` — REQ-427
- [ ] `scripts/check-bundle-size.ts` — D-16 (+10% warn / +25% hard-fail)
- [ ] `scripts/dev-smoke.ts` — Success Criterion #1 helper
- [ ] `scripts/compose-smoke.ts` — Success Criterion #2 helper
- [ ] `scripts/dev-pm2-smoke.sh` — REQ-007 helper
- [ ] `.github/workflows/pr.yml` — PR pipeline (install, lint, typecheck, test, build, security-grep, dev-smoke, compose-smoke, next-data-secret-audit, bundle-size)
- [ ] `.github/workflows/main.yml` — Main branch pipeline (full suite + branch-protection inputs)
- [ ] `.github/dependabot.yml` — ignore: `payload`, `@payloadcms/*` (REQ-500 / payload pin)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Doppler projects exist (13 per-agency + 1 shared) | REQ-428 | Account-level resource creation; cannot be automated without exposing org admin credentials in CI | After signup, run `doppler projects list` and confirm `mjagency-shared` + `mjagency-{agency}` for all 12 agencies; document in `docs/runbooks/secrets.md` |
| VPS provisioning runbook accuracy | REQ-006 | VPS itself is M012; runbook only needs review at M001 | Owner reviews `docs/runbooks/vps-provisioning.md` for stated 8GB+4GB swap requirement; CI checks file exists |
| GitHub branch protection rule on `main` | REQ-005 (success criterion #5) | GitHub-side configuration not stored in the repo | Owner sets branch protection per `docs/runbooks/github-setup.md`; verify via GitHub UI |
| Cloudflare account exists with Images + Stream + R2 enabled | REQ-003 | Org-level paid resource | Owner provisions CF account; CF API token added to `mjagency-shared` Doppler `ci` config; integration test gated by `INTEGRATION=cloudflare-images` runs in CI when token present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner enforces)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces)
- [ ] Wave 0 covers all MISSING references (16 items above)
- [ ] No watch-mode flags in CI commands (Turbo + Vitest single-run)
- [ ] Feedback latency < 30s for task commits, < 5min for wave gates
- [ ] `nyquist_compliant: true` set in frontmatter (after planner populates Per-Task Verification Map)

**Approval:** pending — Per-Task Verification Map will be populated by `gsd-planner` in step 8 of `/gsd-plan-phase`.
