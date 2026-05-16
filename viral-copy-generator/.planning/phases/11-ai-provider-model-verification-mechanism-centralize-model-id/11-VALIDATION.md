---
phase: 11
slug: ai-provider-model-verification-mechanism-centralize-model-id
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-16
updated: 2026-05-16
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled from `11-RESEARCH.md` §"Validation Architecture (Dimension 8 / Nyquist)" + 6 plans (11-01 through 11-06).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (existing — frontend + backend both configured) |
| **Config file** | `frontend/vitest.config.ts` + `backend/vitest.config.ts` (existing) |
| **Quick run command** | `cd backend && npm test -- --run <target>.test.ts` (per-plan target file) |
| **Full suite command** | `cd backend && npm test -- --run && cd ../frontend && npm run test:run && cd ../frontend && npm run build` |
| **Estimated runtime** | ~45-60 seconds (backend ~25s, frontend ~20s, build ~10s) |

---

## Sampling Rate

- **After every task commit:** Run targeted unit test for the file touched
- **After every plan wave:** Run full backend + frontend suite
- **Before `/gsd-verify-work`:** Full suite green + DeepSeek V4 manual smoke confirmed
- **Max feedback latency:** 30 seconds (targeted unit test)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | VERIFY-01..06 | — | REQUIREMENTS.md captures the verification contract | grep | `grep -c "VERIFY-0[1-6]" .planning/REQUIREMENTS.md` ≥ 7 | ✅ (REQUIREMENTS.md exists) | ⬜ pending |
| 11-01-02 | 01 | 1 | VERIFY-01, VERIFY-02 | T-11-01 | Shared model manifest exists as parity oracle | json-shape | `node -e "..."` validates 8-entry sorted array | ❌ W0 → Plan 01 Task 2 | ⬜ pending |
| 11-01-03 | 01 | 1 | VERIFY-01, VERIFY-02 | T-11-01 | Backend MODELS const has all 8 entries with required fields | unit | `cd backend && npm test -- --run src/test/lib/models.test.ts` | ❌ W0 → Plan 01 Task 3 | ⬜ pending |
| 11-01-04 | 01 | 1 | VERIFY-03, VERIFY-04, VERIFY-05 | — | Wave 0 stubs exist for all downstream plans (RED state) | unit (it.todo) | `cd backend && npm test -- --run src/test/lib/provider-health-check.test.ts src/test/db/admin-provider-health.test.ts tests/routes/settings.validate-key.test.ts` | ❌ W0 → Plan 01 Task 4 | ⬜ pending |
| 11-02-01 | 02 | 1 | VERIFY-01, VERIFY-02 | T-11-11 | Frontend MODELS parity with backend manifest | unit | `cd frontend && npm run test:run -- --run src/lib/models.test.ts` | ❌ W0 → Plan 02 Task 1 | ⬜ pending |
| 11-02-02 | 02 | 1 | VERIFY-04 | T-11-03, T-11-10 | parseProviderError maps SDK 404 → model_not_found for 4 providers (incl. Claude triple-nesting Pitfall 3) | unit + grep | `cd frontend && npx tsc --noEmit && grep -c "gemini-2.5-flash\|claude-sonnet-4-5" frontend/src/lib/ai.ts` == 0 | ✅ (ai.ts exists) | ⬜ pending |
| 11-02-03 | 02 | 1 | VERIFY-04 | T-11-03, T-11-10 | Per-provider error shape tests lock parseProviderError behavior | unit (≥20 tests) | `cd frontend && npm run test:run -- --run src/lib/ai.parseProviderError.test.ts` | ❌ W0 → Plan 02 Task 3 | ⬜ pending |
| 11-03-01 | 03 | 2 | VERIFY-01, VERIFY-02 | T-11-12 | backend/src/routes/ai.ts uses MODELS lookups + correct DeepSeek baseURL | grep + tsc | `grep -c "MODELS\[" backend/src/routes/ai.ts` ≥ 2; `grep "api.deepseek.com/v1" backend/src/routes/ai.ts` == 0 | ✅ (ai.ts exists) | ⬜ pending |
| 11-03-02 | 03 | 2 | VERIFY-03 | T-11-02, T-11-12, T-11-14 | validate-key returns key_valid + model_valid + capabilities + error_kind | integration (mocked SDK) | `cd backend && npm test -- --run tests/routes/settings.validate-key.test.ts` | ❌ W0 (stub from Plan 01) → Plan 03 Task 2/3 | ⬜ pending |
| 11-03-03 | 03 | 2 | VERIFY-03 | T-11-02 | 4 providers × 4 cases mocked-SDK tests (≥16 GREEN) | integration | `cd backend && npm test -- --run tests/routes/settings.validate-key.test.ts` count ≥ 16 | ❌ W0 → Plan 03 Task 3 | ⬜ pending |
| 11-04-01 | 04 | 3 | VERIFY-05 (prerequisite) | T-11-04, T-11-07 | admin_provider_health table defined in schema.ts with 6 columns + 2 indexes, NO RLS | grep + tsc | `grep "admin_provider_health = pgTable" backend/src/db/schema.ts` == 1; `grep "admin_provider_health.*pgPolicy" backend/src/db/schema.ts` == 0 | ✅ (schema.ts exists) | ⬜ pending |
| 11-04-02 | 04 | 3 | VERIFY-05 | T-11-15 | Drizzle migration is additive only; does not drop RLS on other tables | manual + grep | Inspect generated migration SQL; assert no `DROP POLICY`, `DISABLE ROW LEVEL` clauses | ❌ Plan 04 Task 2 [BLOCKING] | ⬜ pending |
| 11-04-03 | 04 | 3 | VERIFY-05 | T-11-04 | pg-mem PatchedPool integration tests for insert/index/DISTINCT ON | integration | `cd backend && npm test -- --run src/test/db/admin-provider-health.test.ts` ≥ 6 tests GREEN | ❌ W0 → Plan 04 Task 3 | ⬜ pending |
| 11-05-01 | 05 | 4 | VERIFY-05 | T-11-05, T-11-06, T-11-08 | runProviderHealthCheck: fail-partial, missing key→not_configured, error classification, cleanup | integration (mocked SDK) | `cd backend && npm test -- --run src/test/lib/provider-health-check.test.ts` ≥ 8 GREEN | ❌ W0 (stub from Plan 01) → Plan 05 Task 2 | ⬜ pending |
| 11-05-02 | 05 | 4 | VERIFY-05 | T-11-16 | pg-boss registration: createQueue→schedule→work, cron 0 7 * * 1, lazy import | grep + tsc | `grep "registerProviderHealthCheckJob" backend/src/lib/boss.ts backend/src/index.ts` ≥ 3 | ✅ (boss.ts + index.ts exist) | ⬜ pending |
| 11-05-03 | 05 | 4 | VERIFY-05 | T-11-05 | .env.example documents 4 HEALTHCHECK_*_KEY vars; no NEXT_PUBLIC prefix | grep | `grep -c "HEALTHCHECK_" backend/.env.example` == 4; `grep "NEXT_PUBLIC.*HEALTHCHECK" backend/.env.example` == 0 | ✅ (.env.example exists) | ⬜ pending |
| 11-05-04 | 05 | 4 | VERIFY-06 (backend half) | T-11-17 | GET /api/admin/provider-health returns merged MODELS + latest + p95 latency | grep + tsc | `grep "/provider-health" backend/src/routes/admin.ts` ≥ 1; tsc clean | ✅ (admin.ts exists) | ⬜ pending |
| 11-06-01 | 06 | 5 | VERIFY-06 (frontend types) | — | AdminProviderHealth type + fetchAdminProviderHealth client exported | grep + tsc | `grep -c "AdminProviderHealth\|fetchAdminProviderHealth" frontend/src/lib/types.ts frontend/src/lib/api.ts` ≥ 3 | ✅ (types.ts + api.ts exist) | ⬜ pending |
| 11-06-02 | 06 | 5 | VERIFY-03, VERIFY-04 (UI) | T-11-19, T-11-20 | SettingsPage: model dropdown, 3-way error banners, capability chips on success | render test + grep | `grep "MODELS_BY_PROVIDER\|error_kind === 'model_not_found'" frontend/src/pages/SettingsPage.tsx` ≥ 2 | ✅ (SettingsPage.tsx exists) | ⬜ pending |
| 11-06-03 | 06 | 5 | VERIFY-06 | T-11-18, T-11-21 | AdminPage 6th tab "Providers" with status badges + capability chips + manual refresh | render test | `cd frontend && npm run test:run -- --run src/pages/AdminPage.providerHealth.test.tsx` ≥ 6 GREEN | ❌ W0 → Plan 06 Task 3 | ⬜ pending |
| 11-06-04 | 06 | 5 | VERIFY-01..06 | All | End-to-end human smoke: DeepSeek V4 live + Settings walkthrough + Admin Providers tab + model_not_found generator flow + full-suite green | manual | 5 manual smoke procedures listed in Plan 06 Task 4 | ❌ Plan 06 Task 4 [CHECKPOINT] | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (covered by Plan 01 Tasks 2-4 and Plan 02 Task 1)

- [x] `backend/shared/model-ids.json` — shared manifest of valid IDs (Plan 01 Task 2)
- [x] `backend/src/lib/models.ts` — single source of truth MODELS constant (Plan 01 Task 3)
- [x] `frontend/src/lib/models.ts` — parallel constant (Plan 02 Task 1)
- [x] `backend/src/test/lib/models.test.ts` — MODELS integrity + parity test (Plan 01 Task 4, GREEN from day 1)
- [x] `frontend/src/lib/models.test.ts` — frontend MODELS parity test (Plan 02 Task 1, GREEN from day 1)
- [x] `backend/tests/routes/settings.validate-key.test.ts` — RED stub (Plan 01 Task 4) → GREEN (Plan 03 Task 3)
- [x] `backend/src/test/db/admin-provider-health.test.ts` — RED stub (Plan 01 Task 4) → GREEN (Plan 04 Task 3)
- [x] `backend/src/test/lib/provider-health-check.test.ts` — RED stub (Plan 01 Task 4) → GREEN (Plan 05 Task 2)
- [x] `frontend/src/lib/ai.parseProviderError.test.ts` — GREEN (Plan 02 Task 3)
- [x] `frontend/src/pages/AdminPage.providerHealth.test.tsx` — GREEN (Plan 06 Task 3)
- [x] `backend/drizzle/migrations/NNNN_admin_provider_health.sql` — Drizzle generate output (Plan 04 Task 2)

All Wave 0 stub files are scheduled in Plan 01 Task 4 (RED with it.todo) and Plan 02 Task 1 (GREEN parity), satisfying the Nyquist sampling continuity rule: no task in the phase lacks an automated verify hook.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DeepSeek V4 endpoint actually responds with new model ID | VERIFY-01, VERIFY-02 | External live API call; needs real DeepSeek service key in `.env` and network access | Set `HEALTHCHECK_DEEPSEEK_KEY` in `.env`; trigger `provider-health-check` job; confirm row in `admin_provider_health` with `status='ok'`. Must complete BEFORE 2026-07-24 retirement. See Plan 06 Task 4 Smoke #1. |
| Settings page model_not_found UX | VERIFY-03, VERIFY-04 | Visual check that error message reads correctly and doesn't show Retry button | See Plan 06 Task 4 Smoke #2 (force fake model_id; confirm distinct red banner) |
| Admin Provider Health tab visual layout | VERIFY-06 | Layout fits 8 rows on standard viewport without horizontal scroll | See Plan 06 Task 4 Smoke #3 |
| Generator flow model_not_found surfacing | VERIFY-04 | End-to-end check that GeneratorPage (Phase 10) error banner picks up the new discriminant from parseProviderError | See Plan 06 Task 4 Smoke #4 |
| Full-suite regression check | VERIFY-01..06 | Confirm no other phase broken by MODELS migration / Google SDK swap / validate-key shape change | See Plan 06 Task 4 Smoke #5 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (4 manual checkpoints justified in table)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has either tsc/grep/test command)
- [x] Wave 0 covers all MISSING references (model_ids.json manifest + 5 test stubs scheduled in Plans 01 & 02)
- [x] No watch-mode flags (all commands use `--run`)
- [x] Feedback latency < 30s (targeted unit) / < 60s (full suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-16 (planner-filled per-task map for 6 plans, 21 tasks total)
