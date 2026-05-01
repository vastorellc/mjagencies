---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 1 complete — UAT passed — ready for Phase 2
status: phase_complete
stopped_at: "Phase 1 UAT complete — 11/11 tests passed — ready to run /gsd-plan-phase 2"
last_updated: "2026-05-01T12:00:00.000Z"
last_activity: 2026-05-01
progress:
  total_phases: 10
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 10
---

# Project State — Viral Copy Generator

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Upload one video and have platform-specific copy ready to paste in under 30 seconds — eliminating the 20-30 minute per-post metadata grind.
**Current phase:** Phase 1 complete — UAT passed (11/11), code review fixes applied

## Current Position

Phase: 1 of 10 (Backend + Auth Foundation) — COMPLETE
Plan: 5 of 5 in current phase (all tasks complete, UAT passed, code review fixes committed)
Status: Phase 1 verified — ready to run /gsd-plan-phase 2
Last activity: 2026-05-01

Progress: [██████████] 100% (automated)

## Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Backend + Auth Foundation | ✅ Complete (5/5 plans, UAT 11/11 passed, code review fixes applied) |
| 2 | Settings + Social OAuth | ⬜ Not started |
| 3 | Video Upload + Analysis Engine | ⬜ Not started |
| 4 | Virality Score + Checklist | ⬜ Not started |
| 5 | AI Copy + Platform Cards | ⬜ Not started |
| 6 | Auto-Upload + Scheduling | ⬜ Not started |
| 7 | History + Learning Loops | ⬜ Not started |
| 8 | Admin Panel | ⬜ Not started |
| 9 | Content Research Engine | ⬜ Not started |
| 10 | Polish + Resilience | ⬜ Not started |

## Completed Phases

- **Phase 1: Backend + Auth Foundation** — Completed 2026-05-01
  - Supabase project + all 4 tables with RLS, pg-boss running, auth-gated Express backend, login screen with COOP/COEP, admin account configured

## Accumulated Context

### Architecture Decisions

- **@vitejs/plugin-react pinned at 4.7.0** — v6.0.1 requires vite@^8, incompatible with locked vite@^6; 4.7.0 supports vite ^4/5/6/7
- **Supabase** (Auth + PostgreSQL + Realtime) — multi-user platform, RLS enforces per-user isolation
- **pg-boss** (PostgreSQL-backed queue) — replaces BullMQ + Redis; queue lives in Supabase DB
- **VPS file storage** — `/var/uploads/{user_id}/{uuid}.ext`; Nginx served; NOT Supabase Storage
- **No public signup** — admin creates all accounts in Supabase dashboard only
- **Gemini Files API always** — inline base64 broken for all sizes (Google confirmed bug)
- **OpenAI backend proxy** — browser CORS permanently blocked
- **COOP/COEP via configureServer plugin** — NOT server.headers (breaks Vite HMR)
- **Meta container in pg-boss job** — created at fire time, not at schedule time (24h expiry)
- **Instagram 2025 scopes** — `instagram_business_basic` + `instagram_business_content_publish`
- **Facebook Reels requires Page** — `page_id` + `page_access_token` stored from OAuth
- **Weekly Meta token refresh job** — 60-day token, no refresh token fallback
- **EMA for score calibration** — `newEMA = 0.3 × newDelta + 0.7 × prevEMA`, activates at 10+ data points
- **COOP/COEP in Express middleware** — set on all backend responses before CORS/routes; required for Phase 3 SharedArrayBuffer support in @ffmpeg/core
- **pg-boss named import { PgBoss }** — v12 ESM breaking change from default import; startup order: migrations → storage → boss → listen
- **Hashtag aggregation uses unnest()** — spec SQL was wrong (scalar vs TEXT[])
- **entities.roles.provider='supabase' mandatory** — without it drizzle-kit generate produces no CREATE POLICY statements (Pitfall 6)
- **session pooler (port 5432) for DATABASE_URL** — direct connection is IPv6-only and unreachable; session pooler supports prepared statements for Drizzle and pg-boss
- **drizzle-kit generate + migrate only** — push silently drops RLS policies (confirmed Pitfall 4)
- **vite-env.d.ts triple-slash reference** — required for import.meta.env types and CSS module side-effect imports; must be in src/ and included in tsconfig
- **font-bold on LoginPage submit button** — UI-SPEC checker overrides RESEARCH.md Pattern 8 (font-semibold); 2-weight rule: 400 body + 700 bold only
- **error !== null conditional in LoginPage** — does not reserve space when no error; `{error && ...}` coerces empty string to no-render but `{error !== null && ...}` is explicit
- **pg-boss v12 createQueue() before schedule()** — `pgboss.schedule` has FK on `(name)` referencing `pgboss.queue`; must call `createQueue(name)` before `schedule(name, cron, {})`
- **nginx /uploads/ no internal directive** — Meta's Instagram/Facebook servers need public HTTPS access for Phase 6 video ingestion (STORE-02); CORP must be `cross-origin` not `same-origin`

### Critical Bugs to Avoid

- ffprobe returns -1 even on success (GitHub #817) — always read output file unconditionally
- tf.tidy() does NOT wrap async functions — use element-passing + explicit dispose
- MediaPipe solutionPath is MANDATORY — omit causes silent init failure
- YouTube multipart has 5 MB limit — use resumable always
- Drizzle JSONB update replaces whole column — use `|| patch::jsonb` merge operator
- Dynamic Tailwind width classes not generated at build — use inline style for bar charts

## Deferred Items

| Category | Item | Deferred At |
|----------|------|-------------|
| v2 | Social login (Google/Meta for signup) | Init |
| v2 | X/Twitter auto-upload | Init |
| v2 | Bulk video processing | Init |
| v2 | Export history CSV | Init |
| v2 | Competitor channel tracking | Init |

## Session Continuity

Last session: 2026-05-01T12:00:00.000Z
Stopped at: Phase 1 UAT complete — 11/11 passed — code review fixes committed (40ce7b6)
Resume: Run `/gsd-plan-phase 2` to start Phase 2 (Settings + Social OAuth)
