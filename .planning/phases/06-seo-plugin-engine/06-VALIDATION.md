---
phase: 6
slug: seo-plugin-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.8 |
| **Config file** | `packages/seo/vitest.config.ts` (Wave 0 creation required) |
| **Quick run command** | `pnpm --filter @mjagency/seo test` |
| **Full suite command** | `pnpm --filter @mjagency/seo test && pnpm --filter @mjagency/cms test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @mjagency/seo test`
- **After every plan wave:** Run `pnpm --filter @mjagency/seo test && pnpm --filter @mjagency/cms test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | REQ-071, REQ-072 | T-06-01 | Merge-patch reads agency override; missing keys fall back to defaults | unit | `pnpm --filter @mjagency/seo test` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | REQ-075 | T-06-02 | Server action verifies session + agencyId before scoring | unit | `pnpm --filter @mjagency/seo test` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | REQ-070 | — | seo-classic returns 0–100 from known Lexical JSON | unit (TDD) | `pnpm --filter @mjagency/seo test` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | REQ-070, REQ-076 | — | aio-citations returns 0 on unsourced stats; JSON-LD has correct schema | unit | `pnpm --filter @mjagency/seo test` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | REQ-075, REQ-076 | T-06-03 | validateAioTldr throws on blank/overlong TL;DR at publish; warns on draft | unit | `pnpm --filter @mjagency/cms test` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 2 | REQ-070 | — | geo-chunking returns 0 when no city entities; increases with city mentions | unit (TDD) | `pnpm --filter @mjagency/seo test` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 3 | REQ-073 | T-06-04 | Self-learning worker skips agencies without GSC credentials; no crash | unit (MSW) | `pnpm --filter @mjagency/seo test:integration` | ❌ W0 | ⬜ pending |
| 06-06-01 | 06 | 3 | REQ-074 | T-06-05 | Known GUID skipped; new GUID creates algo_alerts record | unit (Redis mock) | `pnpm --filter @mjagency/seo test` | ❌ W0 | ⬜ pending |
| 06-06-02 | 06 | 3 | REQ-074 | — | Keyword match: matching RSS item flagged; non-matching item skipped | unit | `pnpm --filter @mjagency/seo test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/seo/vitest.config.ts` — Vitest config (package.json has `test` script with `--passWithNoTests` but no config file)
- [ ] `packages/seo/src/__tests__/plugin-engine.test.ts` — merge-patch config (REQ-071, REQ-072)
- [ ] `packages/seo/src/__tests__/seo-classic.test.ts` — seo-classic scoring (REQ-070) — plan 06-02 creates this
- [ ] `packages/seo/src/__tests__/aio-citations.test.ts` — citation detection + FAQ JSON-LD (REQ-070, REQ-076) — plan 06-03 creates this
- [ ] `packages/seo/src/__tests__/geo-chunking.test.ts` — geo scoring (REQ-070) — plan 06-04 creates this
- [ ] `packages/seo/src/__tests__/algo-watcher.test.ts` — GUID dedup + keyword match (REQ-074) — plan 06-06 creates this
- [ ] `packages/cms/src/__tests__/content-validators.test.ts` — EXTEND with `validateAioTldr` cases (REQ-075) — plan 06-03 extends this

*Plans 06-02, 06-03, 06-04, and 06-06 create their own TDD test stubs as Wave 0 in their first task.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SeoPanel live score display in Payload admin (real-time update on keypress) | REQ-055, REQ-070 | Requires running Payload admin + browser | Open page in Payload admin, type in Lexical editor, verify SeoPanel score updates within ~600ms |
| TL;DR "Regenerate" button triggers LiteLLM call and returns ≤120 char result | REQ-075 | Requires live LiteLLM endpoint | Set LITELLM_API_URL in dev, click Regenerate, verify result ≤120 chars |
| algo_alerts panel visible only to super_admin (not agency admin) | REQ-074 | Requires Payload admin RBAC verification | Login as agency admin, confirm algo_alerts collection absent from sidebar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
