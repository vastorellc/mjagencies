---
phase: 10
slug: polish-resilience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npm run test:run -- --reporter=verbose src/lib/ai.test.ts src/components` |
| **Full suite command** | `cd frontend && npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** `cd frontend && npm run test:run -- --reporter=verbose src/lib/ai.test.ts`
- **After every plan wave:** `cd frontend && npm run test:run`
- **Before `/gsd-verify-work`:** Full suite must be green + structural grep checks below
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC-01 | 01 | 1 | API error mapping | — | `parseProviderError('claude', {error:{type:'overloaded_error'}})` → `{kind:'model_busy', retryable:true}` | unit | `cd frontend && npm run test:run -- src/lib/ai.test.ts` | ❌ Wave 0 | ⬜ pending |
| SC-02 | 01 | 1 | API error mapping | — | `parseProviderError('claude', {error:{type:'authentication_error'}})` → `{kind:'invalid_key', retryable:false}` | unit | same | ❌ Wave 0 | ⬜ pending |
| SC-03 | 01 | 1 | API error mapping | — | `parseProviderError('gemini', {error:{status:'UNAVAILABLE'}})` → `{kind:'model_busy', retryable:true}` | unit | same | ❌ Wave 0 | ⬜ pending |
| SC-04 | 01 | 1 | API error mapping | — | `parseProviderError('openai', {error:{code:'insufficient_quota'}})` → `{kind:'quota_exhausted', retryable:false}` | unit | same | ❌ Wave 0 | ⬜ pending |
| SC-05 | 02 | 1 | Error boundaries | — | `ErrorBoundary` renders fallback when child throws | unit (happy-dom) | `cd frontend && npm run test:run -- src/components/ErrorBoundary.test.tsx` | ❌ Wave 0 | ⬜ pending |
| SC-06 | 02 | 1 | Error boundaries | — | `ErrorBoundary` renders children normally when no error | unit (happy-dom) | same | ❌ Wave 0 | ⬜ pending |
| SC-07 | 01 | 1 | API error mapping | — | `parseProviderError` with `navigator.onLine=false` → `{kind:'network_error', retryable:true}` | unit | `cd frontend && npm run test:run -- src/lib/ai.test.ts` | ❌ Wave 0 | ⬜ pending |
| SC-08 | 03 | 2 | iOS layout | — | `h-[100dvh]` on all 6 screen pages | structural | `grep -r "h-\[100dvh\]" frontend/src/pages/ \| wc -l` → 6 | manual | ⬜ pending |
| SC-09 | 03 | 2 | iOS safe area | — | `pb-[env(safe-area-inset-bottom)]` on fixed nav div in App.tsx | structural | `grep "pb-\[env(safe-area" frontend/src/App.tsx` | manual | ⬜ pending |
| SC-10 | 04 | 2 | Bundle | — | `optimizeDeps.exclude` contains ffmpeg entries in vite.config.ts | structural | `grep "optimizeDeps" frontend/vite.config.ts` | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/ai.test.ts` — extend with `parseProviderError` test suite (SC-01 through SC-04, SC-07) — RED stubs only
- [ ] `frontend/src/components/ErrorBoundary.test.tsx` — new file, RED stubs for SC-05 and SC-06
- [ ] No framework install needed — Vitest already configured in `frontend/vitest.config.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retry button appears on rate_limited/model_busy/network_error, absent on invalid_key/quota_exhausted | SC-01–07 | Requires browser interaction | Trigger each error type with a bad API key or offline network; check button presence |
| iOS safe-area insets on fixed elements | SC-09 | Requires physical iOS device or Safari simulation | Open on iPhone in Safari; check that bottom nav / modal bottom clear the home indicator |
| TF.js tensor count stable across 5 analyses | Phase 3 scope | Phase 3 engine.ts not yet implemented | After Phase 3: open DevTools console, run 5 analyses, check `tf.memory().numTensors` does not grow |
| ffmpeg indeterminate spinner | Phase 3 scope | Phase 3 engine.ts not yet implemented | After Phase 3: start analysis, observe spinner style is indeterminate (no percentage) |
