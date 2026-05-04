---
phase: 5
slug: ai-copy-platform-cards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (frontend) / Vitest 3.2.4 (backend) |
| **Config file** | `frontend/vitest.config.ts` (dual-project: node + browser) |
| **Quick run command** | `cd frontend && npm run test:run -- --reporter=verbose src/lib/` |
| **Full suite command** | `cd frontend && npm run test:run && cd ../backend && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run test:run -- src/lib/`
- **After every plan wave:** Run `cd frontend && npm run test:run && cd ../backend && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-xx-01 | SDK install | 0 | AI-03..05 | — | N/A | manual | `npm ls @google/genai @anthropic-ai/sdk openai` | ❌ W0 | ⬜ pending |
| 5-xx-02 | ai.test.ts stub | 0 | AI-06, AI-09, AI-11 | — | N/A | unit | `vitest run src/lib/ai.test.ts` | ❌ W0 | ⬜ pending |
| 5-xx-03 | checklist.test.ts extend | 0 | AI-10 | — | N/A | unit | `vitest run src/lib/checklist.test.ts` | ✅ extend | ⬜ pending |
| 5-xx-04 | PlatformCopyCard.test.tsx | 0 | PLATFORM-03, 06, 09 | — | N/A | unit (happy-dom) | `vitest run --project=browser src/components/` | ❌ W0 | ⬜ pending |
| 5-xx-05 | backend/routes/ai.test.ts | 0 | AI-05 | T-5-01 | Key never in response | integration | `cd backend && npm test routes/ai.test.ts` | ❌ W0 | ⬜ pending |
| 5-ai-01 | prompt.ts + ai.ts | 1 | AI-06 | — | Both responseMimeType + responseSchema | unit | `vitest run src/lib/ai.test.ts` | ❌ W0 | ⬜ pending |
| 5-ai-02 | JSON robustness | 1 | AI-09 | T-5-02 | No eval(); parse-only | unit | `vitest run src/lib/ai.test.ts` | ❌ W0 | ⬜ pending |
| 5-ai-03 | Get Better Version | 1 | AI-11 | — | No images re-sent | unit | `vitest run src/lib/ai.test.ts` | ❌ W0 | ⬜ pending |
| 5-ai-04 | MQ re-evaluation | 1 | AI-10 | — | pending → pass/fail | unit | `vitest run src/lib/checklist.test.ts` | ✅ extend | ⬜ pending |
| 5-pl-01 | PlatformCopyCard copy btn | 2 | PLATFORM-03 | — | navigator.clipboard.writeText | unit | `vitest run --project=browser src/components/` | ❌ W0 | ⬜ pending |
| 5-pl-02 | TikTok upload disabled | 2 | PLATFORM-06 | — | Upload btn disabled | unit | `vitest run --project=browser src/components/` | ❌ W0 | ⬜ pending |
| 5-pl-03 | Upload status states | 2 | PLATFORM-09 | — | idle→uploading→posted | unit | `vitest run src/components/PlatformCopyCard.test.tsx` | ❌ W0 | ⬜ pending |
| 5-be-01 | OpenAI proxy route | 1 | AI-05 | T-5-01 | API key never in response | integration | `cd backend && npm test routes/ai.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/ai.test.ts` — stubs for AI-06, AI-09, AI-11 (MSW mock or vitest mock for SDK calls)
- [ ] `frontend/src/lib/checklist.test.ts` — EXTEND existing; add MQ re-evaluation test cases for D-09..12
- [ ] `frontend/src/components/PlatformCopyCard.test.tsx` — stubs for PLATFORM-03, PLATFORM-06, PLATFORM-09
- [ ] `backend/src/routes/ai.test.ts` — integration test for OpenAI proxy; mock `openai` SDK + verify key never leaks
- [ ] SDK installs: `cd frontend && npm install @google/genai@1.51.0 @anthropic-ai/sdk@0.92.0` and `cd backend && npm install openai@6.35.0`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase Realtime enabled on `platform_posts` table | PLATFORM-09 | Dashboard setting — cannot be done via code | Supabase Dashboard → Database → Replication → enable `platform_posts` |
| Gemini Files API end-to-end (real video file upload) | AI-03 | Requires real Gemini API key and network | Pick video → Generate Copy → verify cards populate (no blank cards) |
| Claude browser SDK direct call | AI-04 | Requires real Anthropic API key in settings | Settings → select Claude → Generate → verify cards populate |
| OpenAI proxy round-trip | AI-05 | Requires real OpenAI API key in settings | Settings → select OpenAI → Generate → verify cards populate; check Network tab — no direct openai.com calls |
| Realtime upload state push | PLATFORM-09 | Requires Phase 6 upload job running | After Phase 6: trigger upload → verify status transitions without page refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
