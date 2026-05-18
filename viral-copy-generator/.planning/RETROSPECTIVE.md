# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — Viral Copy Generator MVP

**Shipped:** 2026-05-18
**Phases:** 12 | **Plans:** 81 | **Commits:** 721

### What Was Built
- Auth-gated multi-user platform with Supabase RLS, double-gated Express middleware, admin-only account creation
- In-browser video analysis engine (FFmpeg.wasm + TF.js + Web Audio + Canvas) — zero server-side cost
- Multi-provider AI copy generation (Gemini Files API, Claude browser, OpenAI backend proxy, DeepSeek) → 5 platform cards
- Auto-upload to YouTube (resumable), Instagram (container-in-job), Facebook (page token) with PKT scheduling
- Learning loops with EMA score calibration, hashtag unnest aggregation, hook ranking — injected into every AI call
- Content Research Engine with 4 external trend sources, AI-generated briefs, hashtag intelligence, 7-day calendar
- Admin panel with 5 tabs (queue, users, health, logs, stats) + provider health monitoring
- Cover-frame scoring with 6 visual predictors, top-3 carousel, PNG overlay downloads for 4 platform sizes

### What Worked
- **GSD phase structure kept complexity manageable** — 12 phases × ~6-8 plans each gave atomic commits and clear progress tracking
- **Comprehensive upfront research** — Phase-by-phase research surfaced critical bugs (ffprobe -1 return code, tf.tidy async incompatibility, pg-boss v12 API changes) before a single line of code was written
- **Autonomous execution** — Most phases executed cleanly via `/gsd-execute-phase N` with minimal human intervention
- **Nyquist verification caught regressions** — Mandatory test coverage per plan prevented breakage during later phases
- **Vitest dual-project config** — Separate frontend (happy-dom) and backend (pg-mem) test environments kept test suites isolated and fast

### What Was Inefficient
- **Phase 3 (Video Analysis) was paused for 13 days** — ffmpeg.wasm proved unreliable; Engine v3 rewrite (HTMLVideoElement + rVFC) was the right call but should have been the initial approach
- **Requirements checkboxes not kept current** — REQUIREMENTS.md fell behind as code shipped; 5 boxes still unchecked at close despite all functionality being complete
- **OAuth E2E blocked on credentials** — Phases 2, 6, 7 all have deferred smoke tests because .env credentials were never provisioned; this should have been flagged as a blocking prerequisite
- **No Playwright E2E suite** — Zero browser-level tests; all testing is Vitest unit/integration; critical user flows have no automated regression protection

### Patterns Established
- **Planning before execution always** — Never skip `/gsd-plan-phase` before `/gsd-execute-phase`
- **Research first** — Each phase's RESEARCH.md prevented days of debugging by surfacing edge cases early
- **Atomic commits per task** — Each completed task produces its own commit; easy to bisect and revert
- **Pitfalls in STATE.md** — Accumulated 180+ architecture decisions and pitfalls as living documentation
- **Wave-based parallelization** — Frontend + backend plans in the same wave execute concurrently

### Key Lessons
1. **Validate engine architecture against real browsers before committing to a multi-plan phase** — Engine v1 (ffmpeg.wasm) was built across 4 plans before discovering fundamental reliability issues; v3 rewrite cost 2 extra plans
2. **Credential-dependent tests are not completed work** — Deferred smoke tests become invisible tech debt; provision test credentials at phase start, not phase end
3. **REQUIREMENTS.md should be updated at each phase transition** — The checkbox list fell out of sync because it was treated as a milestone-close activity rather than an ongoing one
4. **AI provider model IDs rot silently** — Hardcoded model strings across 6 locations would have broken users on 2026-07-24 (deepseek-chat retirement); centralized MODELS constant + health-check job closes this class of bug permanently

### Cost Observations
- Model mix: ~40% opus, ~50% sonnet, ~10% haiku (implementation-heavy; plan/research phases used opus for architecture)
- Sessions: ~25 (multi-session; phase autonomy reduced context churn)
- Notable: Phase detail research consumed disproportionate tokens relative to implementation — pre-researched pitfalls saved far more than they cost

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~25 | 12 | Initial build — established plan→execute→verify cycle |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 416/419 pass | tsc clean | 12 (cover-frame scoring) |

### Top Lessons (Verified Across Milestones)

1. Engine architecture must be validated against real browsers before committing to multi-plan phases
2. Credential-dependent tests need credentials provisioned at phase start, not end
3. Requirements documentation must be updated continuously, not at milestone close
4. Centralized constants + runtime verification prevents silent model ID breakage
