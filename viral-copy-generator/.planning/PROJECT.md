# Viral Copy Generator

## What This Is

A multi-user platform for short-form video content creators. Upload a video once — a
free in-browser engine analyses it, AI generates platform-optimised captions, hashtags,
descriptions, and tags, and the results are ready to copy-paste or auto-upload to YouTube,
Instagram, and Facebook. Includes a separate Content Research Engine that combines external
trend data with each user's own performance history to generate content ideas, full video
briefs, and a posting calendar. An admin panel gives the platform owner full visibility into
system health, upload queues, and user management. Built for Pakistani audiences with global
reach; content niches: travel, hotels, car/bike drives, coding, lifestyle (no face).

## Core Value

Upload one video and have platform-specific copy ready to paste in under 30 seconds —
eliminating the 20-30 minute per-post metadata grind — while a learning system that
improves with every logged view and a research engine that surfaces trending content ideas
compound the creator's growth over time.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-user with per-user data isolation via Supabase Auth + Row Level Security
- [ ] Admin panel for platform owner (queue management, system health, user management, logs)
- [ ] Video upload, in-browser analysis, virality scoring, checklist, gap analysis
- [ ] AI copy generation (Claude / Gemini / OpenAI — user's own key) for 5 platforms
- [ ] Auto-upload to YouTube (resumable), Instagram Reels, Facebook Reels
- [ ] TikTok upload built and gated behind approval flag
- [ ] X/Twitter manual copy only
- [ ] Post history with view logging and predicted vs actual accuracy tracking
- [ ] Learning loops: hashtag ranking, hook ranking, score self-calibration per user
- [ ] Content Research Engine: external trend data + learning data → AI-generated content ideas, briefs, hashtag intelligence, 7-day calendar
- [ ] Peak PKT posting schedule with pg-boss job queue

### Out of Scope

- Central AI API — users supply their own keys, platform has zero AI running cost
- Supabase Storage — video files stored on VPS at `/var/uploads/{user_id}/`
- Redis / BullMQ — replaced by pg-boss (PostgreSQL-backed queue, no extra service)
- X/Twitter auto-upload — API cost not justified; manual copy is sufficient
- Video editing — use CapCut; this tool is for metadata and content strategy

## Context

- Multi-user platform. Each user has isolated data (Supabase RLS enforces this at DB level).
- Admin = platform owner with special role claim. Admin can see system state but not user content/keys.
- Pakistan-primary audience. Content niches: travel, hotels, car drives, bike rides, coding,
  lifestyle (no face on camera — scenery and places).
- Video analysis runs entirely in-browser (ffmpeg.wasm + TensorFlow.js + Web Audio API) — zero
  API cost for analysis regardless of number of users.
- AI copy generation uses each user's own API key (Claude / Gemini / OpenAI). Platform never
  holds or pays for AI calls.
- File storage: VPS local disk at `/var/uploads/{user_id}/{uuid}.ext`, served via Nginx with
  public HTTPS URL. Files cleaned up after social upload + 1-hour safety window.
- Job queue: pg-boss (PostgreSQL-backed). Jobs stored in Supabase DB — no Redis required.
  Scheduled uploads survive server restarts.
- Content Research Engine is a separate screen — not connected to the video upload flow.
  Uses external APIs (YouTube Data, Google Trends, Reddit, ExplodingTopics) + user's own
  learning data as context for AI-generated content briefs.

## Constraints

- **Stack:** React 19 + Vite 6 + TS + Tailwind 4 frontend; Node.js 22 + Express 5 backend; Supabase PostgreSQL + Drizzle ORM; Supabase Auth; pg-boss — locked
- **File storage:** VPS local disk only — no Supabase Storage, no S3
- **AI cost:** Zero platform-side AI spend — user provides own key, stored encrypted per-user
- **Video analysis:** Must run in-browser — no server-side video processing
- **TikTok:** API not yet approved — upload code written but hidden behind feature flag
- **X/Twitter:** Manual copy only — no upload integration
- **Hosting:** Hetzner CX22 VPS (~€3.79/mo) + Supabase free tier (or Pro $25/mo if scale requires)
- **Instagram:** Account must be Creator/Business type (personal accounts excluded from Graph API)
- **Facebook Reels:** Requires a Facebook Page (not personal profile)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase (Auth + DB + Realtime) | Auth solved out of box; RLS enforces per-user isolation; Realtime replaces status polling | — Pending |
| VPS file storage (not Supabase Storage) | Cheaper, user controls data, no storage egress fees, files are temporary anyway | — Pending |
| pg-boss over BullMQ + Redis | No Redis service needed, queue lives in Supabase DB, adequate for this volume | — Pending |
| Copy-first, auto-upload secondary | Core value is speed to paste-ready content | — Pending |
| TikTok gated behind feature flag | API not yet approved — build now, activate later | — Pending |
| Content Research Engine as separate screen | Distinct workflow from upload — research is pre-production, upload is post-production | — Pending |
| No central AI spend | Every user supplies own key — platform is zero-cost for AI | — Pending |
| In-browser video analysis | Zero per-video cost regardless of user count | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-01 after scope expansion — multi-user, Supabase, Admin Panel, Content Research Engine*
