# Viral Copy Generator — CLAUDE.md

GSD workflow instructions and project context for Claude Code.

---

## GSD Workflow

This project uses the GSD (Get Shit Done) planning system.

**Planning docs location:** `.planning/`
**Before starting any phase:** Read `.planning/ROADMAP.md` and `.planning/STATE.md`
**Before planning a phase:** Run `/gsd-plan-phase N`
**Before executing a phase:** Run `/gsd-execute-phase N`

**Workflow order (never skip steps):**
1. `/gsd-plan-phase N` → creates PLAN.md for the phase
2. `/gsd-execute-phase N` → executes the plan with atomic commits
3. `/gsd-verify-work N` → verifies phase goal was achieved

**Between phases:** Run `/clear` to free context before starting the next phase.

---

## Project Identity

**Multi-user platform** for short-form video content creators.
Upload video → in-browser analysis → AI copy generation → auto-upload to YouTube/Instagram/Facebook.
Separate Content Research Engine for trend-based content ideation.
Admin panel for platform management.
Target: Pakistani creators. Niches: travel, hotels, car/bike drives, coding, lifestyle.

**10 phases total.** See `.planning/ROADMAP.md` for full details.

---

## Critical Rules

### Auth (ENFORCE ON EVERY ROUTE)
- **No public signup.** Accounts created by admin only in Supabase dashboard.
- **Every route is auth-gated.** `supabase.auth.getUser(token)` on every Express route except `/health`.
- **Admin routes** require `app_metadata.role === 'admin'` — enforce in middleware AND frontend guard.
- **Never store tokens in localStorage.** OAuth tokens go to DB (encrypted). Supabase session handled by SDK.

### Per-User Data Isolation
- All DB tables have `user_id UUID REFERENCES auth.users(id)`.
- RLS is enabled on all tables — `USING (user_id = auth.uid())`.
- Never add manual `WHERE user_id =` as the only protection — RLS is the enforcement layer.
- Admin can see system-level data only — never individual users' API keys, tokens, or content.

### Stack (LOCKED — do not change without instruction)
- Frontend: React 19 + Vite 6 + TypeScript + Tailwind CSS 4
- Backend: Node.js 22 + Express 5.2.1 + TypeScript
- Database: Supabase PostgreSQL + Drizzle ORM
- Auth: Supabase Auth (anon key on frontend, service role key on backend only)
- Queue: pg-boss (PostgreSQL-backed — NO Redis, NO BullMQ)
- File storage: VPS local disk `/var/uploads/{user_id}/{uuid}.ext` (NOT Supabase Storage)
- Realtime: Supabase Realtime for upload status push (no polling)

### Database
- Use `drizzle-kit generate + migrate` — NEVER `drizzle-kit push`.
- JSONB partial update: `sql\`${col} || ${JSON.stringify(patch)}::jsonb\`` — never replace whole column.
- View logging and learning signal writes: always in a single `db.transaction()`.

### Security
- API keys: AES-256-GCM, `randomBytes(12)` IV (12 bytes), `scryptSync` key derivation.
- Never expose decrypted API keys in API responses — return `{ masked: '****last4' }` only.
- COOP/COEP: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` on every response.
- Vite COOP/COEP: use `configureServer` plugin (NOT `server.headers` — breaks HMR).
- OAuth: server-side redirect flow only — no popups (COOP kills `window.opener`).

### Frontend
- No routing library — `useState` screen switching.
- No UI component library — Tailwind CSS only.
- `h-[100dvh]` not `h-screen` (iOS Safari viewport bug).
- `viewport-fit=cover` in meta viewport tag.

### Video Analysis (Phase 3+)
- `@ffmpeg/core` single-thread only — `@ffmpeg/core-mt` fails on Chromium.
- ffprobe always read output from virtual FS file — return code is -1 even on success (confirmed bug).
- Scene detection output is in the log stream — parse `ffmpeg.on('log', ...)`, not a file.
- `tf.tidy()` does NOT work with async — use `tensor.dispose()` in `try/finally`.
- MediaPipe face-detection: `solutionPath` is MANDATORY or init silently fails.

### AI Providers (Phase 5+)
- Gemini: Files API ALWAYS (inline base64 broken for all sizes — Google confirmed bug).
- Claude: `dangerouslyAllowBrowser: true` required in SDK constructor.
- OpenAI: proxy through backend `POST /api/ai/generate` — CORS blocked in browser.
- Gemini JSON mode: requires BOTH `responseMimeType` AND `responseSchema`.

### Auto-Upload (Phase 6+)
- YouTube: resumable protocol only — multipart has 5 MB hard limit.
- Instagram: container created INSIDE pg-boss job (not at schedule time — 24h expiry).
- Instagram: gate at 100 MB before queuing — hard platform limit.
- Instagram scopes (2025): `instagram_business_basic` + `instagram_business_content_publish`.
- Facebook Reels: use `page_access_token` + `page_id` — personal profiles cannot use the API.
- Meta tokens: 60-day lifetime — weekly pg-boss refresh job is mandatory.

### Content Rules
- NEVER generate placeholder text, "TODO", "Coming soon", or "Lorem ipsum".
- NEVER invent statistics, fake testimonials, or fabricated benchmark numbers.
- All copy must be real and complete.

---

## File Structure (target)

```
/frontend
  /src
    /components     — UI components
    /pages          — Screen components (Generator, History, Research, Settings, Admin)
    /lib
      types.ts      — EngineSignals + shared TypeScript types
      engine.ts     — ffmpeg + TF.js + Web Audio orchestrator
      score.ts      — Virality score formula
      checklist.ts  — Pass/fail/pending checklist rules
      gaps.ts       — Rule-based gap messages
      prompt.ts     — AI prompt builder
      ai.ts         — Claude/Gemini/OpenAI call handler
      api.ts        — Backend API client
      supabase.ts   — Supabase client (anon key)
    App.tsx
    main.tsx

/backend
  /src
    /routes
      posts.ts         — Create, list, delete posts
      platformPosts.ts — Log actual views, update status
      learning.ts      — Top hooks, hashtags, score weights
      settings.ts      — Get/update settings, OAuth tokens
      upload.ts        — YouTube + Meta upload proxy
      admin.ts         — Admin-only routes
      ai.ts            — OpenAI proxy route
      research.ts      — Content research + trend cache
    /db
      schema.ts        — Drizzle schema (all tables + RLS)
      index.ts         — Supabase PostgreSQL connection
      migrations/
    /lib
      learning.ts      — EMA calibration, loop calculations
      encryption.ts    — AES-256-GCM encrypt/decrypt
      oauth.ts         — Google + Meta token refresh
      boss.ts          — pg-boss instance + job definitions
      storage.ts       — VPS file write/delete/cleanup
    /middleware
      auth.ts          — Supabase JWT verification
      admin.ts         — Admin role check
    index.ts           — Express app entry
```

---

## Current State

See `.planning/STATE.md` for current phase and progress.
See `.planning/ROADMAP.md` for all phase details and success criteria.
See `.planning/REQUIREMENTS.md` for full requirements list with REQ-IDs.

**Next step:** `/gsd-plan-phase 1`
