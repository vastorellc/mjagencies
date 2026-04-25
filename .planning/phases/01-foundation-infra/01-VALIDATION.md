---
phase: 1
slug: foundation-infra
status: planned
nyquist_compliant: true
wave_0_complete: false  # waves still execute; Wave 0 helpers are scheduled into the tasks below
created: 2026-04-25
updated: 2026-04-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.x (pinned in `packages/testing/vitest.config.ts`) |
| **Config file** | `packages/testing/vitest.config.ts` (Wave 0 — installs in Plan 01-01 / Task 1.1) |
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

> Populated by gsd-planner 2026-04-25. Each row corresponds to a task in `01-NN-PLAN.md`. Wave 0 helpers are created within the listed tasks (no orphaned setup).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1.1 | 01-01 | 1 | REQ-001, REQ-307, REQ-426, REQ-502, REQ-503 | T-01-002, T-01-005, T-01-104 | Workspace boots; Pino redact paths enforced; ESLint bans jsonwebtoken + dangerouslyAllowSVG + NEXT_PUBLIC_*KEY | unit + smoke | `pnpm install --frozen-lockfile && pnpm turbo run typecheck && pnpm vitest run packages/config/src/__tests__/logger.test.ts` | ❌ Wave 0 (creates packages/testing + packages/config + logger.test.ts) | ⬜ pending |
| Task 1.2 | 01-01 | 1 | REQ-001, REQ-501, REQ-500 | T-01-003, T-01-101, T-01-102, T-01-104 | web-main boots Next 15 + Payload 3.82.1 via withPayload; health route on Node runtime; size-limit baseline file present; Stripe stub uses req.text() | smoke + unit | `pnpm vitest run apps/web-main/src/__tests__/health.test.ts && pnpm turbo run typecheck --filter=@mjagency/web-main && pnpm list payload --depth=0 \| grep "payload 3.82.1"` | ❌ Wave 0 (creates health.test.ts) | ⬜ pending |
| Task 1.3 | 01-01 | 1 | REQ-001, REQ-501 | T-01-003 | 11 agency apps scaffolded with identical Payload pin + ports 3001-3011; hosts script ships for both OS families | smoke | `[ "$(ls -d apps/web-* \| wc -l)" -eq 12 ] && pnpm list payload --depth=0 --json \| jq -e 'all(.[]; .dependencies.payload.version == "3.82.1")'` | ❌ Wave 0 (creates scaffold-agency-app.ts) | ⬜ pending |
| Task 2.1 | 01-02 | 2 | REQ-002 | T-01-007, T-01-201, T-01-202, T-01-203 | Compose stack boots with all services healthy; 13 logical DBs + roles; 127.0.0.1-only port bindings; `sk_test_*` keys only in dev | integration | `pnpm tsx scripts/compose-smoke.ts` | ❌ Wave 0 (creates compose-smoke.ts) | ⬜ pending |
| Task 2.2 | 01-02 | 2 | REQ-007 | T-01-008, T-01-204 | 12 PgBouncer instances supervised by PM2 in transaction mode with `max_prepared_statements=100` + `scram-sha-256`; pitfall 3.3 documented in packages/db README | integration | `pm2 start ecosystem.config.cjs && bash scripts/dev-pm2-smoke.sh` | ❌ Wave 0 (creates dev-pm2-smoke.sh) | ⬜ pending |
| Task 3.1 | 01-03 | 2 | REQ-003, REQ-304 | T-01-001, T-01-301, T-01-302 | @mjagency/media exports server-side-only Cloudflare Images, R2, BlurHash, cache-tags clients; factories throw on missing env | unit + gated integration | `pnpm vitest run packages/media/src/__tests__/cache-tags.test.ts packages/media/src/__tests__/cloudflare-images.unit.test.ts packages/media/src/__tests__/r2.unit.test.ts` | ❌ Wave 0 (creates media unit tests + integration test scaffold + cloudflare MSW handlers) | ⬜ pending |
| Task 3.2 | 01-03 | 2 | REQ-003 | T-01-303 | builder + tools type contracts locked (M010 implements against); Stream client server-side only; Puck installed but unused | unit | `pnpm turbo run typecheck --filter=@mjagency/builder --filter=@mjagency/tools --filter=@mjagency/media` | ✅ uses Plan 01-01 typecheck infra | ⬜ pending |
| Task 4.1 | 01-04 | 3 | REQ-004, REQ-307, REQ-426 | T-01-005, T-01-402, T-01-403 | OTel NodeSDK boots in Node only (Edge guard preserved); 13 apps expose `/api/metrics` with `agency.id` label; Pino auto-injects `trace_id`; Tempo receives traces | unit + gated integration | `pnpm vitest run packages/config/src/__tests__/metrics.test.ts && pnpm turbo run typecheck` (live: `INTEGRATION=otel-tempo pnpm vitest run apps/web-main/src/__tests__/otel-tempo.integration.test.ts`) | ❌ Wave 0 (creates metrics.test.ts + tempo-client.ts + otel-tempo.integration.test.ts) | ⬜ pending |
| Task 4.2 | 01-04 | 3 | REQ-004 | T-01-009, T-01-401 | Prometheus scrapes 12 agency apps; Loki indexes per-agency; Tempo ingests OTLP; Grafana auto-loads 3 dashboards with `agency_id` template; ports bound to 127.0.0.1 only | integration | `docker compose -f docker-compose.yml -f docker-compose.observability.yml --profile dev up -d && curl -s http://localhost:9090/api/v1/targets` | ✅ uses compose-smoke.ts pattern | ⬜ pending |
| Task 6.0 | 01-06 | 3 | REQ-428 | T-01-006 | User confirms Doppler tier capacity (path A — 13 projects, path B — 1 project + 39 configs, or paid plan) | manual checkpoint | (decision pause — `/gsd-execute-phase` resumes on user reply) | n/a (decision) | ⬜ pending |
| Task 6.1 | 01-06 | 3 | REQ-428, REQ-503, REQ-304 | T-01-006, T-01-601, T-01-602 | 13 Doppler projects (or 1+39 configs); per-app doppler.yaml × 13; doppler-verify rejects `sk_live_*` in dev configs and `NEXT_PUBLIC_*KEY` in any config | manual + script | `bash scripts/doppler-verify.sh mjagency-ecommerce dev` (live, after secret population) | ❌ Wave 0 (creates doppler-bootstrap.sh + doppler-verify.sh) | ⬜ pending |
| Task 6.2 | 01-06 | 3 | REQ-428 | T-01-603, T-01-604 | Rotation runbook with cadence (JWT quarterly, Stripe annual, API on-offboarding) + procedure + log scaffold | doc | `grep -qE "Quarterly\|Annual\|offboarding" docs/runbooks/secrets-rotation.md` | ✅ uses prior validation infra | ⬜ pending |
| Task 5.1 | 01-05 | 4 | REQ-005, REQ-006, REQ-501, REQ-502, REQ-503 | T-01-001, T-01-002, T-01-003, T-01-010, T-01-501, T-01-503 | PR pipeline runs `security-grep` first (fail-fast); REQ-501/502/503 + dangerouslyAllowSVG ban; CLAUDE.md/PROJECT.md parity; Dependabot ignores `payload` + `@payloadcms/*`; VPS spec doc shipped | smoke (full PR pipeline) | `pnpm dlx prettier --check .github/workflows/*.yml && bash scripts/check-claude-md-parity.sh` | ❌ Wave 0 (creates pr.yml + main.yml + dependabot.yml + CODEOWNERS + check-claude-md-parity.sh + dev-smoke.ts + github-setup.md + vps-provisioning.md) | ⬜ pending |
| Task 5.2 | 01-05 | 4 | REQ-427, REQ-307, REQ-426 | T-01-004, T-01-502 | scan-next-data.ts catches `sk_live_*`, `whsec_*`, `AKIA*`, JWT-shape, `xoxb-*`; check-bundle-size enforces +10/+25 thresholds; size baseline scaffold present | smoke | `pnpm tsx scripts/scan-next-data.ts && pnpm tsx scripts/check-bundle-size.ts` (after `pnpm turbo run build`) | ❌ Wave 0 (creates scan-next-data.ts + check-bundle-size.ts + .size-baseline.json) | ⬜ pending |

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
| 6 | `pnpm list payload` = 3.82.1 across all apps | `pnpm list payload --depth=0 --json \| jq -e 'all(.[]; .dependencies.payload.version == "3.82.1")'` | CI job `security-grep`/`install` step `REQ-501` |

---

## Per-Requirement Verification Map (REQ-001…REQ-503)

| Req ID | Verification | Artifact |
|--------|-------------|----------|
| REQ-001 | `pnpm install --frozen-lockfile` succeeds; workspace lists 13 apps + 13 packages via `pnpm -r exec node -e 'console.log(require("./package.json").name)'` | CI job `install` |
| REQ-002 | Covered by Success Criterion #2 | as above |
| REQ-003 | `pnpm turbo run typecheck --filter=@mjagency/media` green; integration test gated by `INTEGRATION=cloudflare-images` (Success Criterion #3) | as above |
| REQ-004 | Covered by Success Criterion #4 | as above |
| REQ-005 | CI green on main; canary gate is M012 (deferred at M001) | branch protection |
| REQ-006 | Manual: `docs/runbooks/vps-provisioning.md` documents 8GB+4GB swap requirement | runbook file existence in CI (`bundle-size`/`install` job step) |
| REQ-007 | Dev only at M001: `pm2 start ecosystem.config.cjs && pm2 jlist \| jq '[.[] \| select(.name \| startswith("pgbouncer-"))] \| length' == 12` (prod app PM2 cluster mode is M012) | `scripts/dev-pm2-smoke.sh` |
| REQ-304 | Covered by REQ-503 grep + `packages/media` README "server-side only" invariant | as above |
| REQ-307 / REQ-426 | Vitest unit on `createLogger()`: log object containing `password`, `email`, `phone`, `token`, `secret`, `apiKey`, `creditCard`, `ssn`, `refreshToken`, `accessToken`, `jti` — assert each redacts to `[REDACTED]` | `packages/config/src/__tests__/logger.test.ts` |
| REQ-427 | `scripts/scan-next-data.ts` builds web-main, scans `.next/server/app/**/*.html` for known secret patterns; exit 0 = pass | `.github/workflows/pr.yml` job `next-data-secret-audit` |
| REQ-428 | Manual at signup: `doppler projects list \| grep -c '^mjagency-' >= 13` (or 1+39 configs if free-tier fallback) | `docs/runbooks/secrets.md` checklist |
| REQ-501 | `pnpm list payload --depth=0 \| grep "payload 3.82.1"` (all workspaces) | CI job `install` |
| REQ-502 | `! grep -rn "jsonwebtoken" apps packages --include='*.ts' --include='*.tsx' --include='package.json'` | CI job `security-grep` |
| REQ-503 | `! grep -rnE "NEXT_PUBLIC_[A-Z_]*KEY" apps packages --include='*.ts' --include='*.tsx' --include='*.env*'` | CI job `security-grep` |

---

## Wave 0 Requirements

Test infrastructure that must exist before per-requirement tests run. Each item is owned by a specific task above (no orphans).

- [ ] `packages/testing/vitest.config.ts` — Plan 01-01 Task 1.1
- [ ] `packages/testing/src/fixtures/agency-fixture.ts` — Plan 01-01 Task 1.1
- [ ] `packages/testing/src/msw/handlers.ts` — Plan 01-01 Task 1.1 (extended in Plan 01-03 Task 3.1 with cloudflare-handlers)
- [ ] `packages/testing/src/tempo-client.ts` — Plan 01-04 Task 4.1
- [ ] `packages/config/src/__tests__/logger.test.ts` — Plan 01-01 Task 1.1 (TDD-first)
- [ ] `packages/config/src/__tests__/metrics.test.ts` — Plan 01-04 Task 4.1 (TDD-first)
- [ ] `apps/web-main/src/__tests__/health.test.ts` — Plan 01-01 Task 1.2 (TDD-first)
- [ ] `apps/web-main/src/__tests__/otel-tempo.integration.test.ts` — Plan 01-04 Task 4.1 (gated by `INTEGRATION=otel-tempo`)
- [ ] `packages/media/src/__tests__/cloudflare-images.integration.test.ts` — Plan 01-03 Task 3.1 (gated by `INTEGRATION=cloudflare-images`)
- [ ] `packages/media/src/__tests__/cache-tags.test.ts` — Plan 01-03 Task 3.1 (TDD-first)
- [ ] `packages/media/src/__tests__/cloudflare-images.unit.test.ts` — Plan 01-03 Task 3.1
- [ ] `packages/media/src/__tests__/r2.unit.test.ts` — Plan 01-03 Task 3.1
- [ ] `scripts/scan-next-data.ts` — Plan 01-05 Task 5.2
- [ ] `scripts/check-bundle-size.ts` — Plan 01-05 Task 5.2
- [ ] `scripts/dev-smoke.ts` — Plan 01-05 Task 5.1
- [ ] `scripts/compose-smoke.ts` — Plan 01-02 Task 2.1
- [ ] `scripts/dev-pm2-smoke.sh` — Plan 01-02 Task 2.2
- [ ] `scripts/check-claude-md-parity.sh` — Plan 01-05 Task 5.1
- [ ] `scripts/doppler-bootstrap.sh` — Plan 01-06 Task 6.1
- [ ] `scripts/doppler-verify.sh` — Plan 01-06 Task 6.1
- [ ] `.github/workflows/pr.yml` — Plan 01-05 Task 5.1
- [ ] `.github/workflows/main.yml` — Plan 01-05 Task 5.1
- [ ] `.github/dependabot.yml` — Plan 01-05 Task 5.1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Doppler projects exist (13 per-agency + 1 shared) | REQ-428 | Account-level resource creation; cannot be automated without exposing org admin credentials in CI | After signup, run `doppler projects list` and confirm `mjagency-shared` + `mjagency-{agency}` for all 12 agencies; document in `docs/runbooks/secrets.md` |
| VPS provisioning runbook accuracy | REQ-006 | VPS itself is M012; runbook only needs review at M001 | Owner reviews `docs/runbooks/vps-provisioning.md` for stated 8GB+4GB swap requirement; CI checks file exists |
| GitHub branch protection rule on `main` | REQ-005 (success criterion #5) | GitHub-side configuration not stored in the repo | Owner sets branch protection per `docs/runbooks/github-setup.md`; verify via GitHub UI |
| Cloudflare account exists with Images + Stream + R2 enabled | REQ-003 | Org-level paid resource | Owner provisions CF account; CF API token added to `mjagency-shared` Doppler `ci` config; integration test gated by `INTEGRATION=cloudflare-images` runs in CI when token present |
| Payload `/admin` first-user wizard completes | success criterion (implicit) — `pnpm dev` boots | Requires interactive form completion via browser | After Plan 01-02 Postgres + PgBouncer up, navigate to http://localhost:3000/admin and create the first super_admin |
| Doppler tier path decision (Path A / B / paid) | REQ-428 | Account-level capacity check | Plan 01-06 Task 6.0 checkpoint pauses execution for user reply |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner enforces)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces — every plan has at least one automated verify)
- [x] Wave 0 covers all MISSING references (23 items above; each owned by a specific task)
- [x] No watch-mode flags in CI commands (Turbo + Vitest single-run)
- [x] Feedback latency < 30s for task commits, < 5min for wave gates
- [x] `nyquist_compliant: true` set in frontmatter (Per-Task Verification Map populated)

**Approval:** populated by gsd-planner 2026-04-25. Per-Task Verification Map covers 14 tasks across 6 plans. Wave 0 helpers scheduled into Tasks 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 4.1, 5.1, 5.2, 6.1.
