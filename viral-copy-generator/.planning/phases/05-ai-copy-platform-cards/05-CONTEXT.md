# Phase 5: AI Copy + Platform Cards - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

One AI call returns all five platform outputs in a single JSON response; five styled
vertically-stacked copy cards with per-field copy buttons appear above the Phase 4 score
panel; Supabase Realtime powers upload state without polling; a "Get Better Version"
second pass re-calls the AI with `improved_script_outline` appended; Metadata Quality
checklist items flip from `pending` to `pass/fail` using output-field rules.

Provider routing is fully locked:
- **Gemini** — Files API always; `uploadFile` → poll until `ACTIVE` → `generateContent`
- **Claude** — direct browser call; `dangerouslyAllowBrowser: true`; 10 base64 frames
- **OpenAI** — `POST /api/ai/generate` backend proxy; never called from browser

**In scope:** AI-01..11, PLATFORM-01..10, UI-03..05
**Out of scope:** Auto-upload execution (Phase 6), learning data injection (Phase 7), Phase 3
video analysis engine (still paused — Phase 5 ships alongside via fallback path)

</domain>

<decisions>
## Implementation Decisions

### Card layout (D-01..02)

- **D-01:** Five platform copy cards use **vertical stack layout** — one card per platform,
  all scrollable. Each card shows all its fields at once. Familiar, grab-and-go mobile
  pattern. Easiest to copy individual fields without swiping or tab-switching.

- **D-02:** Page layout order after generation completes:
  1. Generate Copy button (or loading state)
  2. YouTube card
  3. Instagram card
  4. TikTok card
  5. Facebook card
  6. X card
  7. ScorePanel (Phase 4)
  8. PlatformCardGrid (Phase 4)
  9. ChecklistAccordion (Phase 4, with MQ items now pass/fail)
  10. GapAnalysisPanel (Phase 4)

  Rationale: copy cards first — the primary product value is the copyable text. Score and
  analysis context is secondary. User reaches it by scrolling down.

### AI output schema (D-03..05)

- **D-03:** AI returns a **nested-by-platform JSON object**:

  ```json
  {
    "youtube": {
      "title": "string (≤60 chars)",
      "description": "string (≤150 chars)",
      "tags": ["string", "..."],
      "hook": "string"
    },
    "instagram": {
      "caption": "string (150–200 chars, Urdu/English mix)",
      "hashtags": ["#string", "..."],
      "cover_text": "string"
    },
    "tiktok": {
      "hook": "string (first 3 words/phrase)",
      "caption": "string (≤150 chars)",
      "hashtags": ["#string", "..."]
    },
    "facebook": {
      "caption": "string (2–3 sentences, Urdu/English mix)",
      "cta": "string",
      "hashtags": ["#string", "..."]
    },
    "x": {
      "tweet": "string (≤280 chars)",
      "hashtags": ["#string", "..."]
    },
    "script_outline": "string"
  }
  ```

  `script_outline` is a top-level field (not per-platform). It is included in every first
  response and appended as `improved_script_outline` in the "Get Better Version" second call.

- **D-04:** X card — **single tweet + hashtags only**. No thread breakdown in Phase 5.
  X thread multi-tweet option deferred to Phase 10 polish.

- **D-05:** "Get Better Version" second call sends the same prompt plus
  `improved_script_outline: <script_outline from first response>` as additional context.
  Images (for Claude/OpenAI) are NOT re-sent (~50% cheaper as locked by ROADMAP).

### Generate trigger + Phase 3 dependency (D-06..08)

- **D-06:** Generate Copy button supports **both paths simultaneously**:
  - `signals === null` (Phase 3 not run yet, or WebAssembly-absent fallback): prompt uses
    description text only. Button always active as long as there is a description or a file.
  - `signals !== null` (Phase 3 wired up): prompt uses full EngineSignals + description +
    framesBase64. Richer AI output, same button.
  Phase 3's wiring to `setSignals()` will automatically upgrade the output quality without
  any Phase 5 code changes.

- **D-07:** `GeneratorPage` holds two new state vars alongside the Phase 4 `signals` state:
  - `selectedFile: File | null` — the raw video File object; Phase 5 uses it for Gemini
    Files API upload. Phase 3's dropzone sets this via a `setFile()` callback.
  - `description: string` — the optional textarea value from the Phase 3 (or Phase 5)
    upload area.

- **D-08:** Phase 5 adds a **minimal upload area** to GeneratorPage:
  - A simple `<input type="file" accept="video/*">` file picker
  - The optional description textarea (reuses Phase 3 spec: 2-row, 280-char soft limit,
    placeholder "Optional: brief description — helps AI when video is ambiguous")
  - A "Generate Copy" button (disabled if both `selectedFile === null` AND
    `description.trim() === ''`)
  
  Phase 3, when it completes, replaces this minimal picker with the full `UploadDropzone`
  + analysis pipeline. Phase 5's `setFile` / `setDescription` callbacks remain as the
  handoff point.

### Metadata Quality re-evaluation rules (D-09..12)

After AI output arrives, `checklist.ts` re-evaluates the 8 Metadata Quality items.

- **D-09: Character count checks** — evaluated against AI output field lengths:
  - `caption_length_youtube` → pass if `youtube.title.length ≤ 60`
  - `caption_length_instagram` → pass if `instagram.caption.length` is between 150–200 chars
  - `caption_length_tiktok` → pass if `tiktok.caption.length ≤ 150`
  - Fix messages: use actual char count interpolated ("Title is 72 chars; keep ≤60.")

- **D-10: Presence checks on dedicated fields**:
  - `hook_in_first_line` → pass if `youtube.hook` is non-empty OR `tiktok.hook` is non-empty
    (whichever platforms are enabled). Fix: "Add a hook suggestion — first line should grab
    attention in 3 seconds."
  - `cta_present` → pass if `facebook.cta` is non-empty (Facebook is the only platform with
    a dedicated CTA field in the schema). Fix: "Add a call-to-action to the Facebook caption."

- **D-11: Hashtag count in band** — array length check:
  - Instagram: pass if `instagram.hashtags.length` is 25–30. Fix: "Use 25–30 IG hashtags;
    got {count}."
  - TikTok: pass if `tiktok.hashtags.length` is 4–6. Fix: "Use 4–6 TikTok hashtags; got
    {count}."
  - YouTube: pass if `youtube.tags.length` is 10–15. Fix: "Use 10–15 YouTube tags; got
    {count}."
  - `hashtag_count_in_band` evaluates the user's **enabled platforms** only; skips disabled
    platforms rather than failing them.

- **D-12: Language and keyword density** — presence-only checks (trust the prompt):
  - `language_match_niche` → pass if `instagram.caption` is non-empty. AI was prompted for
    Urdu/English mix; no NLP scan needed in Phase 5.
  - `description_keyword_density` → pass if `youtube.description` is non-empty. YouTube SEO
    keywords assumed present when description is generated.
  - Phase 10 can add regex heuristics if real-world output quality requires it.

### Settings sourcing in GeneratorPage (D-13)

- **D-13:** Phase 5 fetches user settings from `GET /api/settings` on GeneratorPage mount
  (or when session loads) to source `ai_provider`, `default_niche`, `enabled_platforms`,
  and connection status. Replaces the Phase 4 hardcoded `DEFAULT_NICHE='travel'` and
  `DEFAULT_ENABLED=[all]` constants.
  - Settings are passed as props to `buildChecklist`, `computeScore`, and the AI prompt
    builder.
  - If settings fetch fails, fall back to the Phase 4 defaults (non-blocking).

### Post save on first generation (D-14)

- **D-14:** On first successful AI generation: `POST /api/posts` creates one `posts` row
  (title = `youtube.title ?? 'Untitled'`, niche = `default_niche`, virality_score =
  `scoreResult.overall`, engine_signals = signals or {}, ai_output = the full AI JSON)
  and N `platform_posts` rows (one per enabled platform, upload_status = 'idle').
  The post ID is stored in GeneratorPage state; Realtime subscription filters on `user_id`
  to receive upload status updates for this user's platform posts.

### Supabase Realtime subscription (D-15)

- **D-15:** After post is created, subscribe to `platform_posts` table changes filtered by
  `user_id = <current user>`. On INSERT or UPDATE, find the matching platform card by
  `post_id + platform` and update upload button state (Idle → Uploading → Posted / Failed).
  Subscription is set up once and persists across "Get Better Version" calls (same post).
  Unsubscribe on component unmount or when user picks a new file.

### Claude's Discretion

- AI prompt wording, token budget, niche hashtag bank content (locked by CLAUDE.md rule 5
  for real content)
- Gemini `responseSchema` object structure (mirror the JSON schema in D-03 exactly)
- Loading state text: "Generating copy…" spinner while AI call is in flight (two-phase
  indicator Phase 2 from Phase 3 D-05)
- Error display for invalid API key, rate limit, quota exhausted (surfaces inline below
  the Generate button; retry button for rate_limited/model_busy only)
- Platform card colour accents (UI-03): YouTube red · Instagram pink/purple · TikTok
  black+cyan · Facebook blue · X black+white — planner picks exact Tailwind classes
- `api.ts` lib extension for the `/api/posts` POST call and `/api/ai/generate` proxy

### Folded Todos

None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and contracts
- `.planning/ROADMAP.md` §"Phase 5: AI Copy + Platform Cards" — goal, key implementation
  notes, success criteria
- `.planning/REQUIREMENTS.md` AI-01..11, PLATFORM-01..10, UI-03..05

### Project rules
- `viral-copy-generator/CLAUDE.md` §"AI Providers (Phase 5+)" — Gemini Files API always;
  Claude dangerouslyAllowBrowser; OpenAI proxy; Gemini JSON mode requires BOTH
  responseMimeType AND responseSchema
- `viral-copy-generator/CLAUDE.md` §"Frontend" — h-[100dvh], Tailwind only, no UI library
- `viral-copy-generator/CLAUDE.md` §"Security" — no secrets in NEXT_PUBLIC_ (same applies:
  no API keys exposed to browser except via backend proxy for OpenAI)

### Upstream phase contracts (Phase 5 reads / extends these)
- `.planning/phases/04-virality-score-checklist/04-CONTEXT.md` — D-15..18: Metadata
  Quality 8 pending items; D-22: GeneratorPage layout; D-23: Tailwind band palette
- `.planning/phases/03-video-upload-analysis/03-CONTEXT.md` — D-11: WebAssembly-absent
  fallback path ("Phase 5 will wire that button"); D-14: engine.ts interface

### Existing code Phase 5 extends
- `viral-copy-generator/frontend/src/pages/GeneratorPage.tsx` — primary integration;
  Phase 5 adds file picker, description textarea, Generate button, copy cards, Realtime
- `viral-copy-generator/frontend/src/lib/types.ts` — add AIOutput type, PlatformCard
  types, post-save response type
- `viral-copy-generator/frontend/src/lib/checklist.ts` — extend `buildChecklist` to accept
  optional `aiOutput` param; re-evaluate MQ items when provided (D-09..12)
- `viral-copy-generator/frontend/src/lib/api.ts` — add `POST /api/posts`, settings fetch
- `viral-copy-generator/backend/src/routes/posts.ts` — implement `POST /api/posts`
  (currently stub returning `{ posts: [] }`)
- `viral-copy-generator/backend/src/db/schema.ts` — `posts.ai_output` JSONB ready;
  `platform_posts.upload_status` ready; no schema migration needed for Phase 5
- `viral-copy-generator/backend/src/app.ts` — add `POST /api/ai/generate` OpenAI proxy route

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **GeneratorPage.tsx** — already manages Phase 4 signals state via useMemo; Phase 5 adds
  selectedFile, description, aiOutput state alongside signals
- **checklist.ts `buildChecklist(signals, options)`** — extend with optional third param
  `aiOutput?: AIOutput`; when provided, re-evaluate MQ items instead of returning pending
- **settings.ts GET route** — already returns `ai_provider`, `default_niche`,
  `enabled_platforms`, `connected` — Phase 5 reads this on GeneratorPage mount
- **posts.ts** — stub GET already exists; Phase 5 implements POST
- **encryption.ts** — Phase 5 backend reads the encrypted API key and decrypts it before
  forwarding to OpenAI (same pattern as oauth.ts which already does this)
- **Tailwind band palette** — `BAND_CLASSES` pattern from Phase 4 (full class strings
  per band); Phase 5 platform colour accents follow the same "full class strings" rule

### Established Patterns
- **Pure functions in `lib/`** — score.ts, checklist.ts, gaps.ts precedent; Phase 5 adds
  `lib/ai.ts` (provider call handler) and `lib/prompt.ts` (prompt builder)
- **useMemo for derived state** — Phase 4 D-24 pattern; Phase 5 adds `aiOutput` to the
  useMemo dependency chain
- **No routing library / no UI library** — Tailwind only; useState screen switching
- **httpOnly cookies / session via Supabase SDK** — auth already handled; Phase 5 backend
  routes use `res.locals.userId` from authMiddleware (same as settings routes)

### Integration Points
- `frontend/src/lib/ai.ts` (NEW) — provider call handler (Gemini/Claude/OpenAI routing)
- `frontend/src/lib/prompt.ts` (NEW) — prompt builder (signals + description + niche +
  hashtag bank + learning data placeholder)
- `frontend/src/components/PlatformCopyCard.tsx` (NEW) — one card component, all 5 instances
- `backend/src/routes/ai.ts` (NEW) — `POST /api/ai/generate` OpenAI proxy
- `backend/src/routes/posts.ts` — implement POST handler

### Phase 3 handoff points
- `GeneratorPage.tsx` `setFile(file: File | null)` callback — Phase 3's UploadDropzone
  calls this; Phase 5's minimal picker also calls this
- `GeneratorPage.tsx` `setSignals(signals: EngineSignals)` callback — Phase 3's engine.ts
  calls this after analysis; Phase 5 reads signals for the AI prompt when present

</code_context>

<specifics>
## Specific Ideas

- Platform card colour accents (UI-03): YouTube `border-red-500 bg-red-950` · Instagram
  `border-pink-500 bg-pink-950` · TikTok `border-cyan-400 bg-zinc-900` · Facebook
  `border-blue-500 bg-blue-950` · X `border-zinc-400 bg-zinc-900`
- Generate button copy: "Generate Copy" (pre-generation) → "Regenerate" (after first run)
- "Get Better Version" button copy: "Get Better Version" — appears after first generation
  below the copy cards; triggers second AI call
- Minimal file picker placeholder text: "Pick a video to analyse — or skip and use
  description below"
- Loading state: spinner + "Generating copy…" text below the Generate button; two-phase
  Phase 2 label from Phase 3 D-05
- Copy button feedback: button text flashes "Copied!" for 1.5s on click, then resets
- Post-creation Realtime subscription: shows `upload_status` on each card's upload button
  (`idle` → button enabled, `uploading` → spinner, `posted` → green check, `failed` → red)
</specifics>

<deferred>
## Deferred Ideas

- **X thread breakdown** — multi-tweet thread option for X card; deferred to Phase 10 polish
- **Language/keyword NLP** — heuristic Urdu detection and keyword density scan for MQ
  checklist; deferred to Phase 10
- **Per-provider prompt tuning** — different prompt styles per AI provider; single unified
  prompt is sufficient for Phase 5
- **Streaming AI response** — show copy cards field-by-field as AI streams; full response
  then render is simpler for Phase 5; streaming is a Phase 10 polish item

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-ai-copy-platform-cards*
*Context gathered: 2026-05-02*
