---
phase: 05-ai-copy-platform-cards
plan: 04
status: complete
completed: 2026-05-02
wave: 2
---

# 05-04 Summary — checklist.ts MQ Extension + api.ts Typed Wrappers

## What Was Built

### Task 1: checklist.ts — MQ re-evaluation

- `AIOutput` added to import block
- `buildChecklist(signals, options, aiOutput?: AIOutput)` — optional third param
- When `aiOutput` is undefined: all 8 MQ items remain `pending` (Phase 4 backward-compatible)
- When `aiOutput` is defined, evaluates 8 MQ items per D-09..D-12:
  - D-09 `caption_length_youtube`: pass if `title.length ≤ 60`; fail with char count
  - D-09 `caption_length_instagram`: pass if `caption.length` in [150, 200]; fail with char count
  - D-09 `caption_length_tiktok`: pass if `caption.length ≤ 150`
  - D-11 `hashtag_count_in_band`: checks only enabled platforms (IG 25-30, TikTok 4-6, YT 10-15); skips disabled platforms
  - D-10 `hook_in_first_line`: pass if YouTube hook or TikTok hook is non-empty (on enabled platforms)
  - D-10 `cta_present`: pass if Facebook not enabled OR facebook.cta non-empty
  - D-12 `language_match_niche`: pass if Instagram not enabled OR instagram.caption non-empty
  - D-12 `description_keyword_density`: pass if YouTube not enabled OR youtube.description non-empty

### Task 2: api.ts — Typed Wrappers

- Import extended to `SettingsResponse, CreatePostBody, PostSaveResponse` from `./types`
- `fetchSettings(): Promise<SettingsResponse>` — GET /api/settings
- `createPost(body: CreatePostBody): Promise<PostSaveResponse>` — POST /api/posts
- `fetchApiKey(): Promise<{ api_key: string | null }>` — GET /api/settings/key; called only immediately before callAI() (CLAUDE.md compliance)
- All three use `apiFetch` (Authorization header auto-injected)
- `proxyAIGenerate` from Plan 02 unchanged

## Test Results

- checklist.test.ts: 50/50 GREEN (42 Phase 4 + 8 new Phase 5 MQ tests)
- Frontend full suite: 196/196 pass (1 file fails at import: PlatformCopyCard.test.tsx — expected RED Wave 0 stub)
- tsc: clean (only Wave 0 test stub errors remain)

## Commits

- `c8d5e7a` — feat(05-04): checklist MQ re-evaluation + api.ts typed wrappers
