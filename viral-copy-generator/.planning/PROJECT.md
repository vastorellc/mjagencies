# Viral Copy Generator

## What This Is

A shipped multi-user platform for short-form video content creators. Upload a video once — a
free in-browser engine analyses it, AI generates platform-optimised captions, hashtags,
descriptions, and tags, and the results are ready to copy-paste or auto-upload to YouTube,
Instagram, and Facebook. Includes a Content Research Engine that combines external
trend data with each user's own performance history to generate content ideas, full video
briefs, and a posting calendar. An admin panel gives the platform owner full visibility into
system health, upload queues, user management, and provider health. A cover-frame scoring
system recommends the best thumbnail frame per video. Built for Pakistani audiences with
global reach; content niches: travel, hotels, car/bike drives, coding, lifestyle.

## Core Value

Upload one video and have platform-specific copy ready to paste in under 30 seconds —
eliminating the 20-30 minute per-post metadata grind — while a learning system that
improves with every logged view and a research engine that surfaces trending content ideas
compound the creator's growth over time.

## Requirements

### Validated

- ✓ Multi-user with per-user data isolation via Supabase Auth + Row Level Security — v1.0
- ✓ Admin panel for platform owner (queue management, system health, user management, logs) — v1.0
- ✓ Video upload, in-browser analysis, virality scoring, checklist, gap analysis — v1.0
- ✓ AI copy generation (Claude / Gemini / OpenAI / DeepSeek — user's own key) for 5 platforms — v1.0
- ✓ Auto-upload to YouTube (resumable), Instagram Reels, Facebook Reels — v1.0
- ✓ TikTok upload built and gated behind approval flag — v1.0
- ✓ X/Twitter manual copy only — v1.0
- ✓ Post history with view logging and predicted vs actual accuracy tracking — v1.0
- ✓ Learning loops: hashtag ranking, hook ranking, score self-calibration per user — v1.0
- ✓ Content Research Engine: external trend data + learning data → AI-generated content ideas, briefs, hashtag intelligence, 7-day calendar — v1.0
- ✓ Peak PKT posting schedule with pg-boss job queue — v1.0
- ✓ Provider health monitoring: weekly model ping, capability matrix, admin dashboard — v1.0
- ✓ Cover-frame scoring: 6 visual predictors, top-3 recommendation, overlay PNG download — v1.0

### Active

*(Define with `/gsd-new-milestone`)*

### Out of Scope

- Central AI API — users supply their own keys, platform has zero AI running cost
- Supabase Storage — video files stored on VPS at `/var/uploads/{user_id}/`
- Redis / BullMQ — replaced by pg-boss (PostgreSQL-backed queue, no extra service)
- X/Twitter auto-upload — API cost not justified; manual copy is sufficient
- Video editing — use CapCut; this tool is for metadata and content strategy

## Current State

**v1.0 shipped 2026-05-18.** All 12 phases complete (81 plans, 721 commits, ~19,000 LOC TypeScript/TSX).

**Stack:** React 19 + Vite 6 + Tailwind 4 (frontend) · Node.js 22 + Express 5 (backend) · Supabase PostgreSQL + Drizzle ORM · Supabase Auth · pg-boss

**Test suite:** 416/419 Vitest pass · tsc clean · 0 Playwright E2E tests (gap)

**Known tech debt:**
- Real OAuth E2E round-trips require live Google/Meta credentials
- TikTok upload gated behind `TIKTOK_APPROVED=true` env flag (API not yet approved)
- DeepSeek vision unsupported (model limitation)
- No E2E test suite (0 Playwright tests)
- Phase 3 uses HTMLVideoElement + rVFC (Engine v3); ffmpeg.wasm available as fallback for scene detection

**Deferred to v2:** Social login, X/Twitter auto-upload, bulk processing, CSV export, competitor tracking

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
| Supabase (Auth + DB + Realtime) | Auth solved out of box; RLS enforces per-user isolation; Realtime replaces status polling | ✓ Good — RLS is the backbone of multi-user isolation |
| VPS file storage (not Supabase Storage) | Cheaper, user controls data, no storage egress fees, files are temporary | ✓ Good — working with Nginx public /uploads/ |
| pg-boss over BullMQ + Redis | No Redis service needed, queue lives in Supabase DB, adequate for this volume | ✓ Good — pg-boss v12 handles scheduling + cron |
| Copy-first, auto-upload secondary | Core value is speed to paste-ready content | ✓ Good — copy buttons always work regardless of OAuth |
| TikTok gated behind feature flag | API not yet approved — build now, activate later | ✓ Good — uploadTikTok stub ready |
| Content Research Engine as separate screen | Distinct workflow from upload — research is pre-production, upload is post-production | ✓ Good — Research nav button + 4 tabs |
| No central AI spend | Every user supplies own key — platform is zero-cost for AI | ✓ Good — encrypted per-user in DB |
| In-browser video analysis | Zero per-video cost regardless of user count | ✓ Good — Engine v3 with HTMLVideoElement/rVFC |
| Engine v3 (HTMLVideoElement + rVFC) | Eliminated ffmpeg.wasm dependency for core frame pipeline | ✓ Good — simpler, faster frame extraction |
| Centralized MODELS constants | Single source of truth per side for model IDs; health-check validation | ✓ Good — prevents silent model breakage |
| Cover-frame scoring (6 predictors) | Thumbnail/cover is #1 YouTube CTR lever | ✓ Good — zero new external deps, reuses TF.js + Canvas |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-18 after v1.0 milestone — 12 phases shipped, 81 plans, 721 commits*
