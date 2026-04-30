# Viral Copy Generator

## What This Is

A personal tool for short-form video content creators. Upload a video once — a
free in-browser engine analyses it, AI generates platform-optimised captions,
hashtags, descriptions, and tags, and the results are ready to copy-paste or
auto-upload to YouTube, Instagram, and Facebook. Built for a single user creating
travel, car/bike, hotel, coding, and lifestyle content for Pakistani audiences.

## Core Value

Upload one video and have platform-specific copy ready to paste in under 30 seconds
— eliminating the 20-30 minute per-post metadata grind.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can upload a video and get a virality score with checklist and gap analysis
- [ ] User can generate platform-specific copy (captions, hashtags, tags, descriptions) for YouTube, Instagram, Facebook, TikTok, and X via their own AI API key
- [ ] User can copy generated content to clipboard with one click per platform
- [ ] User can auto-upload to YouTube via Google OAuth
- [ ] User can auto-upload to Instagram and Facebook via Meta OAuth
- [ ] TikTok upload is built but gated behind an approval flag (manual copy always available)
- [ ] X/Twitter is manual copy only (no upload API)
- [ ] User can configure AI provider (Claude / Gemini / OpenAI) and save API key
- [ ] User can connect/disconnect YouTube and Meta accounts
- [ ] User can browse post history with virality scores and predicted view ranges
- [ ] User can log actual views per platform per post
- [ ] User can view learning insights: top hooks, top hashtags, score accuracy over time
- [ ] System learns from logged views to improve future hashtag and hook suggestions
- [ ] Virality score self-calibrates toward user's actual audience over time

### Out of Scope

- Multi-user / auth — single-user personal tool, no login needed
- Paid platform costs — AI key is user's own, hosting is ~$4/mo VPS
- X/Twitter auto-upload — API cost not justified for manual-only workflow

## Context

- Personal tool — not a SaaS product. No auth, no multi-tenancy.
- Pakistan-primary audience. Content niches: travel, hotels, car drives, bike rides,
  coding, lifestyle (no face on camera — scenery and places).
- Video analysis runs entirely in-browser (ffmpeg.wasm + TensorFlow.js + Web Audio API)
  — zero API cost for analysis.
- AI copy generation uses user's own API key (Claude / Gemini / OpenAI).
- Auto-upload is valuable but secondary — copy speed is the core.
- Current pain: 20-30 minutes per post just writing metadata, zero feedback on what
  hashtags or hooks actually perform.
- Stack is locked per spec: React 19 + Vite + TS frontend, Node.js 22 + Express 5 +
  TS backend, PostgreSQL 17 + Drizzle ORM, hosted on Hetzner VPS ~$4/mo.

## Constraints

- **Tech stack**: React 19 + Vite + TS, Node.js 22 + Express 5, PostgreSQL 17 + Drizzle, ffmpeg.wasm, TF.js — locked per spec
- **Hosting**: Hetzner VPS 1GB ~$4/mo — no cloud services that add recurring cost
- **AI cost**: Zero platform-side AI spend — user provides own key
- **Video analysis**: Must run in-browser — no server-side video processing
- **No auth**: Single-user tool — no login, no sessions, no multi-tenancy
- **TikTok**: API not yet approved — upload code written but hidden behind feature flag
- **X/Twitter**: Manual copy only — no upload integration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| In-browser video analysis (ffmpeg.wasm + TF.js) | Zero API cost — all signals free | — Pending |
| User-supplied AI API key | Platform has no AI running cost | — Pending |
| Single-user, no auth | Personal tool — no need for session management | — Pending |
| Copy-first, auto-upload secondary | Core value is speed to paste-ready content | — Pending |
| TikTok gated behind feature flag | API not yet approved — build now, activate later | — Pending |
| No routing library — useState screen switching | Simple 4-screen tool, no deep linking needed | — Pending |
| No UI component library — Tailwind only | Reduces bundle size, full control over mobile layout | — Pending |

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
*Last updated: 2026-04-30 after initialization*
