---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 1 in progress — executing
status: executing
stopped_at: Completed 01-04-PLAN.md — Vite + COOP/COEP plugin, Tailwind v4, login screen, App.tsx auth gate
last_updated: "2026-05-01T12:00:00.000Z"
last_activity: 2026-05-01
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
  percent: 80
---

# Project State — Viral Copy Generator

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Upload one video and have platform-specific copy ready to paste in under 30 seconds — eliminating the 20-30 minute per-post metadata grind.
**Current phase:** Phase 1 in progress — executing

## Current Position

Phase: 1 of 10 (Backend + Auth Foundation)
Plan: 4 of 5 in current phase (complete — Plan 04 done)
Status: Executing — Plan 04 complete; ready for Plan 05
Last activity: 2026-05-01

Progress: [████████░░] 80%

## Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Backend + Auth Foundation | 🔄 Executing (4/5 complete — Plan 05 next) |
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

(none yet)

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
Stopped at: Completed 01-04-PLAN.md — Vite + COOP/COEP plugin, Tailwind v4, login screen, App.tsx auth gate
Resume: Run `/gsd-execute-phase 1` to execute Plan 05 (Integration verification: Vitest suite, API smoke, pg-boss confirm, make-admin, manual phase sign-off)
