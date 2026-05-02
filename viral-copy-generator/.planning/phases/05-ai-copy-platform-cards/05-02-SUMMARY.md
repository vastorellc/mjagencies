---
phase: 05-ai-copy-platform-cards
plan: 02
status: complete
completed: 2026-05-02
wave: 1
---

# 05-02 Summary — AI Types + Backend Proxy + CSP + proxyAIGenerate

## What Was Built

### Task 1: Phase 5 AI Types (frontend/src/lib/types.ts)

Appended Phase 5 type block after `ScoreResult`:
- `YouTubeOutput`, `InstagramOutput`, `TikTokOutput`, `FacebookOutput`, `XOutput` — platform-specific field shapes
- `AIOutput` — top-level interface with all 5 platforms + `script_outline: string`
- `UploadStatus = 'idle' | 'uploading' | 'posted' | 'failed'`
- `PostSaveResponse { postId: string }`
- `CreatePostBody` — body shape for POST /api/posts
- `AIProxyBody { prompt: string; frames?: string[] }` — body shape for POST /api/ai/generate

All 25 existing types preserved unchanged.

### Task 2a: backend/src/routes/ai.ts (NEW)

POST /api/ai/generate OpenAI proxy:
- `userId` from `res.locals.userId` (T-5-03: never from req.body)
- Fetches `api_key_encrypted` from settings table, returns 400 `no_api_key` if absent
- Decrypts in try/catch → 500 `key_decrypt_failed` on corrupt ciphertext
- Builds message content: optional image_url blocks (first pass) + text prompt
- Returns `{ text: rawText }` — T-5-01: apiKey variable never referenced after OpenAI call

### Task 2b: backend/src/routes/posts.ts (EXTENDED)

Added POST /api/posts (D-14):
- Validates `enabled_platforms` against VALID_PLATFORMS allowlist (T-5-03)
- Validates `niche` against VALID_NICHES allowlist
- Inserts into `posts` table, returns new post id
- Inserts one `platform_posts` row per enabled platform with `upload_status='idle'`
- Returns 201 `{ postId: post.id }`

### Task 2c: backend/src/app.ts (UPDATED)

- CSP `connect-src` extended: added `https://generativelanguage.googleapis.com https://api.anthropic.com` (T-5-04; OpenAI via proxy so no browser CSP needed for OpenAI)
- `aiRouter` imported and registered at `/api/ai` after `authMiddleware`

### Task 2d: frontend/src/lib/api.ts (EXTENDED)

Added `proxyAIGenerate(body: AIProxyBody): Promise<{ text: string }>`:
- Calls `apiFetch('/ai/generate', { method: 'POST', ... })` — auth token injected automatically
- Throws `'ai_proxy_failed'` on non-ok response
- Placed in Plan 02 (not Plan 04) to prevent intra-wave circular dependency (05-03 imports it)

## Key Decisions

- `ai.test.ts` moved from `src/routes/` to `tests/` — matches all existing backend test convention (vitest.config.ts `include: tests/**/*.test.ts`)
- `proxyAIGenerate` in Plan 02 not Plan 04 — 05-03 imports it as a Wave 2 peer; creating it in Wave 1 avoids circular dependency
- OpenAI `gpt-4.1` model — multimodal, supports image_url data URIs confirmed in openai@6.35.0 types

## Test Results

- Backend: 49/49 tests pass (includes new T-5-01 GREEN)
- Frontend: 180/188 pass (8 RED = expected Wave 0 stubs: ai.ts missing, PlatformCopyCard.tsx missing, buildChecklist 3-arg extension pending 05-04)
- Backend `tsc --noEmit`: clean

## Commits

- `55975e6` — feat(05-02): AI types + OpenAI proxy route + POST /api/posts + CSP update
