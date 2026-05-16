---
phase: 11
slug: ai-provider-model-verification-mechanism-centralize-model-id
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled from `11-RESEARCH.md` §"Validation Architecture (Dimension 8 / Nyquist)".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (existing — frontend + backend both configured) |
| **Config file** | `frontend/vitest.config.ts` + `backend/vitest.config.ts` (existing) |
| **Quick run command** | `cd backend && npm test -- --run` (per-plan target file) |
| **Full suite command** | `cd backend && npm test -- --run && cd ../frontend && npm test -- --run && npm run build` |
| **Estimated runtime** | ~45-60 seconds (backend ~25s, frontend ~20s, build ~10s) |

---

## Sampling Rate

- **After every task commit:** Run targeted unit test for the file touched (`npm test -- --run src/lib/models.test.ts`, etc.)
- **After every plan wave:** Run full backend + frontend suite
- **Before `/gsd-verify-work`:** Full suite green + DeepSeek V4 manual smoke confirmed
- **Max feedback latency:** 30 seconds (targeted unit test)

---

## Per-Task Verification Map

> Tasks are placeholders until planner produces the 6 plans. Map will be filled by planner during step 8.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-XX | 01 | 1 | VERIFY-01 | T-11-01 | MODELS constant integrity — all 4 providers present with required fields | unit | `cd backend && npm test -- --run src/lib/models.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-XX | 02 | 1 | VERIFY-02 | — | Frontend ↔ backend MODELS parity (model IDs match) | unit | `cd frontend && npm test -- --run src/lib/models.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-XX | 03 | 2 | VERIFY-03 | T-11-02 | `validate-key` endpoint returns `model_not_found` distinct from `invalid_key` (mocked SDK 404) | integration | `cd backend && npm test -- --run tests/routes/settings.validate-key.test.ts` | ❌ W0 | ⬜ pending |
| 11-04-XX | 03 | 2 | VERIFY-04 | T-11-03 | `parseProviderError` maps SDK 404 → `model_not_found` AIErrorKind with `retryable: false` | unit | `cd frontend && npm test -- --run src/lib/ai.parseProviderError.test.ts` | ❌ W0 | ⬜ pending |
| 11-05-XX | 04 | 3 | VERIFY-05 | T-11-04 | `admin_provider_health` table schema with append-only writes, last-30 cleanup | integration | `cd backend && npm test -- --run src/test/db/admin-provider-health.test.ts` | ❌ W0 | ⬜ pending |
| 11-06-XX | 05 | 4 | VERIFY-05 | T-11-05 | `provider-health-check` pg-boss job: fail-partial, missing service-key produces "not configured" row, not job failure | integration | `cd backend && npm test -- --run src/test/lib/provider-health-check.test.ts` | ❌ W0 | ⬜ pending |
| 11-07-XX | 06 | 5 | VERIFY-06 | — | Admin panel Provider Health tab renders rows with status badges | render | `cd frontend && npm test -- --run src/pages/AdminPage.providerHealth.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/lib/models.ts` — single source of truth MODELS constant (stub for tsc, real impl Plan 01)
- [ ] `frontend/src/lib/models.ts` — parallel constant (stub for tsc, real impl Plan 02)
- [ ] `backend/shared/model-ids.json` — shared manifest of valid IDs for parity assertion
- [ ] `backend/src/test/lib/models.test.ts` — MODELS integrity test stubs (RED)
- [ ] `frontend/src/lib/models.test.ts` — frontend MODELS test stubs (RED)
- [ ] `backend/tests/routes/settings.validate-key.test.ts` — model-not-found test stubs (RED)
- [ ] `frontend/src/lib/ai.parseProviderError.test.ts` — model_not_found discriminant stubs (RED)
- [ ] `backend/src/test/db/admin-provider-health.test.ts` — schema integration test stubs (RED) using pg-mem PatchedPool
- [ ] `backend/src/test/lib/provider-health-check.test.ts` — pg-boss job test stubs (RED)
- [ ] `frontend/src/pages/AdminPage.providerHealth.test.tsx` — render test stubs (RED)
- [ ] `backend/drizzle/migrations/NNNN_admin_provider_health.sql` — Drizzle generate output (Plan 04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DeepSeek V4 endpoint actually responds with new model ID | VERIFY-01 | External live API call; needs real DeepSeek service key in `.env` and network access; cannot mock the final production verification | 1. Set `HEALTHCHECK_DEEPSEEK_KEY` in `.env`. 2. Run `cd backend && npm test -- --run src/test/lib/provider-health-check.smoke.test.ts` (skip-when-no-key gated). 3. Confirm row in `admin_provider_health` with `status='ok'`. Must complete BEFORE 2026-07-24 retirement. |
| Settings page model_not_found UX | VERIFY-03 | Visual check that error message reads correctly and doesn't show "Retry" button (non-retryable) | 1. Start dev server. 2. In Settings, save provider with an intentionally bumped-up model ID (e.g., `gemini-99.9-fake`). 3. Confirm error reads "Configured model not found — contact admin to update model ID" (or equivalent) without a Retry button. |
| Admin Provider Health tab visual layout | VERIFY-06 | Layout fits 4 providers × 1-2 models = 8 rows on standard viewport without horizontal scroll | 1. Log in as admin. 2. Navigate to Admin → Provider Health tab. 3. Confirm 8 rows visible without scroll, status badges (green ok / red failed / amber not-configured) render correctly, last-checked timestamps formatted in user locale. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (model_ids.json manifest + 8 test stubs)
- [ ] No watch-mode flags (all commands use `--run`)
- [ ] Feedback latency < 30s (targeted unit) / < 60s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills the per-task map exactly

**Approval:** pending (set to `approved YYYY-MM-DD` after planner expands per-task map)
