# Phase 5: AI Copy + Platform Cards - Research

**Researched:** 2026-05-02
**Domain:** AI SDK integration (Gemini Files API, Anthropic browser SDK, OpenAI proxy) + Supabase Realtime + React copy-to-clipboard + platform card UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Five platform copy cards use vertical stack layout — one card per platform, all scrollable. Each card shows all its fields at once.

**D-02:** Page layout order after generation completes:
1. Generate Copy button (or loading state)
2. YouTube card
3. Instagram card
4. TikTok card
5. Facebook card
6. X card
7. ScorePanel (Phase 4)
8. PlatformCardGrid (Phase 4)
9. ChecklistAccordion (Phase 4, MQ items now pass/fail)
10. GapAnalysisPanel (Phase 4)

**D-03:** AI returns nested-by-platform JSON — exact schema locked (see CONTEXT.md D-03 for full structure including `script_outline` as top-level field).

**D-04:** X card — single tweet + hashtags only. No thread breakdown.

**D-05:** "Get Better Version" second call sends same prompt + `improved_script_outline` appended. Images NOT re-sent.

**D-06:** Generate Copy button supports both paths simultaneously: `signals === null` (description-only) and `signals !== null` (full EngineSignals + frames).

**D-07:** GeneratorPage holds `selectedFile: File | null` and `description: string` as new state vars.

**D-08:** Phase 5 adds minimal upload area: `<input type="file" accept="video/*">` + description textarea + Generate Copy button.

**D-09..12:** Metadata Quality re-evaluation rules locked (character counts, presence checks, hashtag bands, language/keyword density — see CONTEXT.md D-09..12).

**D-13:** Phase 5 fetches user settings from `GET /api/settings` on GeneratorPage mount.

**D-14:** On first successful AI generation: `POST /api/posts` creates `posts` + `platform_posts` rows.

**D-15:** Supabase Realtime subscription on `platform_posts` table, filtered by `user_id`. Unsubscribe on unmount or new file.

**Provider routing (fully locked):**
- Gemini: Files API always — `uploadFile` → poll until ACTIVE → `generateContent` with file URI
- Claude: direct browser call; `dangerouslyAllowBrowser: true`; 10 base64 frames
- OpenAI: `POST /api/ai/generate` backend proxy; never called from browser

### Claude's Discretion

- AI prompt wording, token budget, niche hashtag bank content
- Gemini `responseSchema` object structure (mirror D-03 JSON schema exactly)
- Loading state text: "Generating copy…" spinner
- Error display for invalid API key, rate limit, quota exhausted
- Platform card colour accents: YouTube `border-red-500 bg-red-950` · Instagram `border-pink-500 bg-pink-950` · TikTok `border-cyan-400 bg-zinc-900` · Facebook `border-blue-500 bg-blue-950` · X `border-zinc-400 bg-zinc-900`
- `api.ts` lib extension for `/api/posts` POST and `/api/ai/generate` proxy

### Deferred Ideas (OUT OF SCOPE)

- X thread breakdown (Phase 10)
- Language/keyword NLP scanning (Phase 10)
- Per-provider prompt tuning (single unified prompt sufficient)
- Streaming AI response (Phase 10)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | User can select AI provider in settings (Claude/Gemini/OpenAI) — per user | Settings already returns `ai_provider`; GeneratorPage reads it on mount (D-13) |
| AI-02 | System generates a single AI call returning JSON with all 5 platform outputs | `lib/ai.ts` routes to provider, returns `AIOutput` typed object |
| AI-03 | Gemini sends video via Files API for ALL sizes | `@google/genai` `ai.files.upload()` → poll → `generateContent` with URI |
| AI-04 | Claude browser call with `dangerouslyAllowBrowser: true`; 10 base64 frames as image content blocks | `@anthropic-ai/sdk` 0.92.0 supports this; image block format verified |
| AI-05 | OpenAI calls proxied through backend `/api/ai/generate` | New `backend/src/routes/ai.ts`; decrypt key → call OpenAI → return result |
| AI-06 | Gemini JSON mode uses both `responseMimeType` AND `responseSchema` | Verified: mime type alone is insufficient |
| AI-07 | AI prompt injects engine signals, gap data, niche hashtag bank, learning data | `lib/prompt.ts` builds prompt string |
| AI-08 | AI copy uses English with natural Urdu code-switching | Prompt instruction; no code enforcement needed |
| AI-09 | Strip markdown fences; handle malformed JSON gracefully | JSON robustness pattern documented below |
| AI-10 | Metadata Quality checklist items re-evaluated from pending to pass/fail | `buildChecklist` extended with optional `aiOutput` param |
| AI-11 | "Get Better Version" second pass with `improved_script_outline` | Same `lib/ai.ts` call path; second-pass flag skips image re-send |
| PLATFORM-01 | Generator screen shows 5 platform cards | `PlatformCopyCard.tsx` component, 5 instances |
| PLATFORM-02 | Each card shows platform-specific copy fields with character counts | Per-card field mapping from `AIOutput` type |
| PLATFORM-03 | Each field has one-click copy button | `navigator.clipboard.writeText` + 1.5s "Copied!" flash |
| PLATFORM-04 | YouTube card: title, description, tags, hook, upload button, copy fallback | Card fields from `aiOutput.youtube` |
| PLATFORM-05 | Instagram card: caption, hashtags, cover_text, upload button, copy fallback | Card fields from `aiOutput.instagram` |
| PLATFORM-06 | TikTok card: hook, caption, hashtags; upload button greyed out | `isTikTokApproved = false` gate |
| PLATFORM-07 | Facebook card: caption, CTA, hashtags, upload button, copy fallback | Card fields from `aiOutput.facebook` |
| PLATFORM-08 | X card: tweet, hashtags, copy only — no upload button | Card fields from `aiOutput.x` |
| PLATFORM-09 | Upload button: 4 states (Idle/Uploading/Posted/Failed) via Supabase Realtime | `platform_posts.upload_status` subscription |
| PLATFORM-10 | Manual copy always available regardless of upload state | Copy buttons independent from upload state |
| UI-03 | Platform card colour accents per platform | Tailwind class strings locked in CONTEXT.md |
| UI-04 | Score colour coding (already shipped in Phase 4) | No new work |
| UI-05 | App usable on mobile — `h-[100dvh]`, viewport-fit, safe-area-inset | Pattern already established in GeneratorPage.tsx |
</phase_requirements>

---

## Summary

Phase 5 wires together three AI provider paths, five styled platform copy cards, Supabase Realtime upload state, and Metadata Quality checklist re-evaluation. The codebase from Phases 1-4 already provides the skeleton: `GeneratorPage.tsx` manages state via `useMemo`, `checklist.ts` has the 8 pending MQ items ready to flip, `posts.ts` is a stub ready for its POST implementation, `settings.ts` already returns `ai_provider`/`api_key_encrypted`, and `encryption.ts` provides the decrypt pattern the OpenAI proxy needs.

The three SDK integrations each have distinct constraints confirmed by official documentation. Gemini requires the **new `@google/genai` SDK** (not `@google/generative-ai`, which is deprecated) and the Files API three-step flow (upload → poll ACTIVE → generate). The Anthropic SDK supports browser calls via `dangerouslyAllowBrowser: true` with image content blocks using `{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "<base64>" } }`. OpenAI has a permanent browser CORS block so all calls go through `POST /api/ai/generate` which decrypts the user's API key from DB and proxies the request.

Supabase Realtime subscriptions on `platform_posts` use `filter: 'user_id=eq.<userId>'` with the `.on('postgres_changes', ...)` pattern. RLS applies at the subscription level — users only receive changes they own. The subscription lives for the component lifecycle and is cleaned up with `supabase.removeChannel(channel)` on unmount.

**Primary recommendation:** Install `@google/genai@1.51.0` (frontend), `@anthropic-ai/sdk@0.92.0` (frontend), `openai@6.35.0` (backend). All other work is extension of existing patterns.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gemini Files API upload + poll | Browser/Client | — | `selectedFile` is a `File` object in the browser; Files API accepts Blob/File directly |
| Claude image call | Browser/Client | — | `dangerouslyAllowBrowser: true` is the whole point; direct call from React |
| OpenAI API call | API/Backend | — | Permanent browser CORS block; `api_key_encrypted` must be decrypted server-side |
| AI prompt construction | Browser/Client | — | `lib/prompt.ts` pure function; signals, description, and niche are browser-side |
| JSON parsing + robustness | Browser/Client | — | Applied immediately after AI response before rendering |
| Metadata Quality re-evaluation | Browser/Client | — | Pure function in `checklist.ts`; no DB needed |
| Post save (posts + platform_posts) | API/Backend | — | DB write, RLS enforcement, `res.locals.userId` from authMiddleware |
| Supabase Realtime subscription | Browser/Client | Database/Storage | Frontend subscribes; DB emits change events via Realtime |
| Platform card rendering | Browser/Client | — | React components, no server involvement |
| Settings fetch on mount | Browser/Client → API/Backend | — | Frontend calls `GET /api/settings`; backend reads DB |

---

## Standard Stack

### Core — Frontend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 1.51.0 | Gemini Files API + generateContent | New unified GA SDK; `@google/generative-ai` is deprecated [VERIFIED: npm registry] |
| `@anthropic-ai/sdk` | 0.92.0 | Claude browser call with image blocks | Official SDK; `dangerouslyAllowBrowser` added Aug 2024 [VERIFIED: official docs] |
| `@supabase/supabase-js` | 2.105.1 | Realtime subscription | Already installed; `.channel().on('postgres_changes')` [VERIFIED: codebase] |

### Core — Backend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | 6.35.0 | OpenAI API call in proxy route | Official Node SDK; needed backend-only [VERIFIED: npm registry] |

### Already Installed (no new install)

| Library | Version | Notes |
|---------|---------|-------|
| `@supabase/supabase-js` | 2.105.1 | Already in both frontend + backend |
| All Express/Drizzle/pg-boss deps | — | Backend unchanged |
| React 19, Tailwind 4, Vite 6 | — | Frontend unchanged |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google/genai` | `@google/generative-ai` | `@google/generative-ai` is deprecated (migration deadline was Aug 2025 for Python; JS SDK is in maintenance-only mode); migration path is straightforward |
| Direct `fetch` to AI APIs | SDK wrappers | SDKs handle auth headers, retries, TypeScript types; no benefit to raw fetch here |
| Supabase Realtime for upload state | Polling | Realtime is already in the architecture and the `platform_posts.upload_status` column is ready |

**Installation:**
```bash
# Frontend
cd frontend && npm install @google/genai@1.51.0 @anthropic-ai/sdk@0.92.0

# Backend
cd backend && npm install openai@6.35.0
```

---

## Architecture Patterns

### System Architecture Diagram

```
User interaction
    │
    ▼
GeneratorPage (React)
    │
    ├─── [file picked] ──────────────────────────────────────┐
    │                                                         │
    ├─── [Generate Copy clicked]                             │
    │         │                                              │
    │    lib/prompt.ts                                       │
    │    buildPrompt(signals, description, niche, hashtags)  │
    │         │                                              │
    │         ▼                                              │
    │    lib/ai.ts ─── ai_provider = 'gemini' ──▶ Gemini Files API
    │         │              upload(selectedFile) ──▶ poll ACTIVE
    │         │              generateContent(fileUri, prompt, responseSchema)
    │         │
    │         ├─── ai_provider = 'claude' ──▶ @anthropic-ai/sdk (browser)
    │         │              messages.create(prompt + 10 image blocks)
    │         │
    │         └─── ai_provider = 'openai' ──▶ POST /api/ai/generate (proxy)
    │                        │                      │
    │                        │              decrypt api_key_encrypted
    │                        │              call OpenAI API (server-side)
    │                        │              return JSON result
    │         │
    │    parseAIOutput(raw) ─── strip fences ─── JSON.parse ─── fallback
    │         │
    │    setAiOutput(output)
    │         │
    │    checklistItems ─── buildChecklist(signals, options, aiOutput)
    │         │             (re-evaluates 8 MQ items from pending)
    │         │
    │    POST /api/posts ─── creates posts + platform_posts rows
    │         │              returns { postId }
    │         │
    │    Supabase Realtime channel ─── subscribe(platform_posts, user_id=eq.X)
    │                                         │
    │                              upload_status changes pushed to frontend
    │                              UPDATE event → setUploadStatus(platform, status)
    │
    ▼
PlatformCopyCard × 5  ←── aiOutput fields + uploadStatus per platform
    │
    └─── [copy button] ──▶ navigator.clipboard.writeText → 1.5s "Copied!" flash
    └─── [Get Better Version] ──▶ lib/ai.ts (second pass, improved_script_outline)
```

### Recommended Project Structure

New files in Phase 5:

```
frontend/src/
├── lib/
│   ├── ai.ts            NEW — provider routing, call, parse
│   ├── prompt.ts        NEW — prompt builder
│   └── types.ts         EXTEND — AIOutput, PlatformCopyCard types
├── components/
│   └── PlatformCopyCard.tsx  NEW — single card component (5 instances)
└── pages/
    └── GeneratorPage.tsx     EXTEND — file picker, AI state, Realtime

backend/src/
├── routes/
│   ├── ai.ts            NEW — POST /api/ai/generate (OpenAI proxy)
│   └── posts.ts         EXTEND — implement POST handler
└── app.ts               EXTEND — register ai route
```

---

### Pattern 1: Gemini Files API Three-Step Flow

**What:** Upload video file to Gemini Files API, poll until state = ACTIVE, then call generateContent with file URI.
**When to use:** Always for Gemini provider (inline base64 is broken for all sizes — confirmed CLAUDE.md).

```typescript
// Source: https://ai.google.dev/gemini-api/docs/file-prompting-strategies
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: userApiKey })

// Step 1: Upload — accepts browser File object directly
const uploaded = await ai.files.upload({
  file: selectedFile,           // File object from <input type="file">
  config: { mimeType: selectedFile.type },
})

// Step 2: Poll until ACTIVE (states: PROCESSING → ACTIVE or FAILED)
let fileInfo = uploaded
while (fileInfo.state !== 'ACTIVE') {
  if (fileInfo.state === 'FAILED') {
    throw new Error('Gemini file processing failed')
  }
  await new Promise(r => setTimeout(r, 2000))
  fileInfo = await ai.files.get({ name: uploaded.name })
}

// Step 3: generateContent with file URI
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [
    {
      role: 'user',
      parts: [
        { text: promptText },
        { fileData: { mimeType: fileInfo.mimeType, fileUri: fileInfo.uri } },
      ],
    },
  ],
  config: {
    responseMimeType: 'application/json',
    responseSchema: AI_OUTPUT_SCHEMA,   // see Pattern 2 below
  },
})

const rawText = response.text ?? ''
```

**Critical notes:**
- `@google/genai` (not `@google/generative-ai`) — the new unified SDK [VERIFIED: official migration guide]
- `ai.files.upload()` accepts a browser `File` object directly — no conversion needed [VERIFIED: official docs]
- `ai.files.get()` uses `{ name: uploaded.name }` not the URI [VERIFIED: official docs]
- When `signals === null`, send only the text prompt (no file or description) — the button can still trigger if description is present

---

### Pattern 2: Gemini responseSchema for D-03 JSON Shape

**What:** Define the exact D-03 schema as a `responseSchema` object to enforce structured JSON output.
**When to use:** Every Gemini call — `responseMimeType` alone is insufficient (CLAUDE.md + AI-06).

```typescript
// Source: https://ai.google.dev/gemini-api/docs/structured-output
// Mirror D-03 schema exactly — nested objects, no optional fields to avoid null surprises
const AI_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    youtube: {
      type: 'object',
      properties: {
        title:       { type: 'string' },
        description: { type: 'string' },
        tags:        { type: 'array', items: { type: 'string' } },
        hook:        { type: 'string' },
      },
      required: ['title', 'description', 'tags', 'hook'],
    },
    instagram: {
      type: 'object',
      properties: {
        caption:    { type: 'string' },
        hashtags:   { type: 'array', items: { type: 'string' } },
        cover_text: { type: 'string' },
      },
      required: ['caption', 'hashtags', 'cover_text'],
    },
    tiktok: {
      type: 'object',
      properties: {
        hook:     { type: 'string' },
        caption:  { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['hook', 'caption', 'hashtags'],
    },
    facebook: {
      type: 'object',
      properties: {
        caption:  { type: 'string' },
        cta:      { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['caption', 'cta', 'hashtags'],
    },
    x: {
      type: 'object',
      properties: {
        tweet:    { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['tweet', 'hashtags'],
    },
    script_outline: { type: 'string' },
  },
  required: ['youtube', 'instagram', 'tiktok', 'facebook', 'x', 'script_outline'],
}
```

---

### Pattern 3: Claude Browser Call with Base64 Image Blocks

**What:** Call Anthropic messages.create directly from the browser with 10 base64 frames.
**When to use:** When `ai_provider === 'claude'`.

```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/vision
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: userApiKey,
  dangerouslyAllowBrowser: true,  // MANDATORY — SDK blocks browser calls without this
})

// Build image content blocks from base64 frames (framesBase64 from EngineSignals)
// Each frame stored as plain base64 JPEG from Phase 3 extractFrames()
const imageBlocks = frames.map(b64 => ({
  type: 'image' as const,
  source: {
    type: 'base64' as const,
    media_type: 'image/jpeg' as const,
    data: b64,              // plain base64 string (no "data:image/jpeg;base64," prefix)
  },
}))

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5',   // AI-01 spec
  max_tokens: 2048,
  messages: [
    {
      role: 'user',
      content: [
        ...imageBlocks,         // images first (Anthropic best practice)
        { type: 'text', text: promptText },
      ],
    },
  ],
})

const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
```

**Critical notes:**
- `dangerouslyAllowBrowser: true` is MANDATORY or the SDK throws a runtime error [VERIFIED: official docs]
- No `data:image/jpeg;base64,` prefix — `data` field is the raw base64 string [VERIFIED: official docs]
- `media_type` must be one of: `image/jpeg`, `image/png`, `image/gif`, `image/webp` [VERIFIED: official docs]
- 10 frames well within 100-image-per-request limit [VERIFIED: official docs]
- For "Get Better Version" (D-05): send text-only prompt, no images — `content: [{ type: 'text', text: promptWithOutline }]`

---

### Pattern 4: OpenAI Backend Proxy Route

**What:** Express handler that decrypts the user's API key from DB, calls OpenAI, returns result.
**When to use:** When `ai_provider === 'openai'`.

```typescript
// Source: Existing encryption.ts pattern (decrypt) + OpenAI SDK pattern
// backend/src/routes/ai.ts
import { Router, type Request, type Response } from 'express'
import OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { decrypt } from '../lib/encryption.js'

export const aiRouter = Router()

interface AIGenerateBody {
  prompt: string
  frames?: string[]        // base64 JPEGs; omit on second pass
}

aiRouter.post('/generate', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { prompt, frames } = req.body as AIGenerateBody

  // Fetch + decrypt user's API key
  const rows = await db.select().from(settings).where(eq(settings.user_id, userId)).limit(1)
  if (!rows[0]?.api_key_encrypted) {
    res.status(400).json({ error: 'no_api_key' })
    return
  }
  const apiKey = decrypt(rows[0].api_key_encrypted)

  const openai = new OpenAI({ apiKey })

  // Build message content — text prompt + optional image blocks
  type ContentPart = OpenAI.Chat.ChatCompletionContentPart
  const content: ContentPart[] = []
  if (frames?.length) {
    for (const b64 of frames) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${b64}` },
      })
    }
  }
  content.push({ type: 'text', text: prompt })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1',        // AI-01 spec
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
  })

  const rawText = completion.choices[0]?.message?.content ?? ''
  res.json({ text: rawText })
})
```

**Note:** OpenAI image format in `chat.completions` uses `image_url` with data URI (`data:image/jpeg;base64,...`) — different from Anthropic's base64 blocks [ASSUMED — based on training knowledge; verify against openai SDK 6.35 types].

---

### Pattern 5: JSON Robustness (AI-09)

**What:** Parse AI output defensively — strip markdown, extract object boundaries, fallback to empty strings.
**When to use:** Every AI response, all three providers.

```typescript
// Source: CONTEXT.md / ROADMAP.md specification
function parseAIOutput(raw: string): AIOutput {
  // Step 1: strip markdown code fences
  let text = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()

  // Step 2: find outermost object
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return emptyAIOutput()
  text = text.slice(start, end + 1)

  // Step 3: parse
  try {
    const parsed = JSON.parse(text) as Partial<AIOutput>
    return hydrateAIOutput(parsed)  // fills missing fields with empty strings/arrays
  } catch {
    return emptyAIOutput()
  }
}

function emptyAIOutput(): AIOutput {
  return {
    youtube:  { title: '', description: '', tags: [], hook: '' },
    instagram: { caption: '', hashtags: [], cover_text: '' },
    tiktok:   { hook: '', caption: '', hashtags: [] },
    facebook: { caption: '', cta: '', hashtags: [] },
    x:        { tweet: '', hashtags: [] },
    script_outline: '',
  }
}
```

---

### Pattern 6: Supabase Realtime Subscription

**What:** Subscribe to `platform_posts` changes for the current user; update upload button state on INSERT/UPDATE.
**When to use:** After `POST /api/posts` returns successfully (post has been created, postId is known).

```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
// Source: Supabase JS SDK 2.105.1 (already installed)
import { supabase } from '../lib/supabase'

// Set up subscription once after post is created
const channel = supabase
  .channel('platform-posts-realtime')
  .on(
    'postgres_changes',
    {
      event: '*',              // INSERT + UPDATE (both relevant)
      schema: 'public',
      table: 'platform_posts',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const row = payload.new as { post_id: string; platform: string; upload_status: string }
      // Update local state for matching platform card
      setUploadStatuses(prev => ({
        ...prev,
        [row.platform]: row.upload_status,
      }))
    }
  )
  .subscribe()

// Cleanup on unmount or when new file is selected
return () => {
  supabase.removeChannel(channel)
}
```

**Critical notes:**
- `filter: 'user_id=eq.<userId>'` — exact filter string syntax for Supabase Realtime [VERIFIED: official docs]
- RLS applies to Realtime subscriptions — users only receive their own rows [VERIFIED: official docs]
- `supabase.removeChannel(channel)` for cleanup (not `channel.unsubscribe()`) [VERIFIED: official docs]
- Realtime must be enabled for `platform_posts` table in Supabase dashboard — verify this in Wave 0

---

### Pattern 7: React Copy-to-Clipboard (No Library)

**What:** Copy a text field using `navigator.clipboard.writeText`; flash "Copied!" for 1.5s.
**When to use:** Every copy button in PlatformCopyCard.

```typescript
// Source: MDN Web API — [ASSUMED] standard browser API, widely supported
const [copied, setCopied] = useState<string | null>(null)

async function handleCopy(fieldId: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)
    setCopied(fieldId)
    setTimeout(() => setCopied(null), 1500)
  } catch {
    // Clipboard write failed (unusual on HTTPS) — silent fallback
  }
}

// In JSX:
<button onClick={() => handleCopy('youtube-title', aiOutput.youtube.title)}>
  {copied === 'youtube-title' ? 'Copied!' : 'Copy'}
</button>
```

**Notes:**
- `navigator.clipboard` requires HTTPS or localhost — both satisfied [ASSUMED]
- `fieldId` discriminator lets multiple buttons in the same card have independent flash state
- No library needed — this is a native browser API

---

### Pattern 8: buildChecklist Extension for AI-10

**What:** Extend `buildChecklist` signature to accept optional `aiOutput` param; when provided, replace the 8 pending MQ items with evaluated pass/fail.
**When to use:** Every time `checklistItems` is recomputed (new signals OR new aiOutput).

```typescript
// Extend existing signature in checklist.ts
export function buildChecklist(
  signals: EngineSignals,
  options: ChecklistOptions,
  aiOutput?: AIOutput,    // NEW optional third param
): ChecklistItem[]

// MQ item replacement logic (D-09..12):
if (aiOutput) {
  // Replace all pending MQ items with evaluated versions
  // caption_length_youtube: pass if aiOutput.youtube.title.length <= 60
  // caption_length_instagram: pass if aiOutput.instagram.caption.length >= 150 && <= 200
  // etc — see CONTEXT.md D-09..12 for full rules
}
```

**GeneratorPage integration:**
```typescript
const checklistItems = useMemo(() => {
  if (!signals) return null
  return buildChecklist(signals, options, aiOutput ?? undefined)
}, [signals, aiOutput, options])
```

---

### Pattern 9: POST /api/posts Implementation

**What:** Create one `posts` row + N `platform_posts` rows (one per enabled platform).
**When to use:** On first successful AI generation (before "Get Better Version").

```typescript
// Extend backend/src/routes/posts.ts
// Uses existing schema: posts.ai_output JSONB + platform_posts.upload_status ready
postsRouter.post('/', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { title, niche, virality_score, engine_signals, ai_output, enabled_platforms } = req.body

  const [post] = await db.insert(posts).values({
    user_id: userId,
    title: title ?? 'Untitled',
    niche: niche ?? 'travel',
    virality_score: virality_score ?? 0,
    engine_signals: engine_signals ?? {},
    ai_output: ai_output ?? {},
  }).returning()

  // Insert one platform_posts row per enabled platform
  if (enabled_platforms?.length > 0) {
    await db.insert(platform_posts).values(
      enabled_platforms.map((platform: string) => ({
        user_id: userId,
        post_id: post.id,
        platform,
        upload_status: 'idle',
      }))
    )
  }

  res.status(201).json({ postId: post.id })
})
```

---

### Anti-Patterns to Avoid

- **Using `@google/generative-ai`:** This package is deprecated. Use `@google/genai` instead. The `GoogleGenerativeAI` class and `GoogleAIFileManager` separate pattern is the old approach.
- **Gemini inline base64:** Never send video as inline base64 regardless of file size — Files API is mandatory (Google confirmed bug).
- **Calling OpenAI from browser:** Permanent CORS block. Any direct `openai.chat.completions.create()` call in browser code will fail.
- **`data:image/jpeg;base64,...` prefix in Anthropic image blocks:** The `data` field is plain base64 without the data URI prefix. Prefix causes `400 Bad Request`.
- **Single `copied` state for all buttons:** If one state variable tracks all copy buttons, only the last-clicked field ID is "Copied!" — the `fieldId` discriminator pattern is needed.
- **Not removing Realtime channel on unmount:** Supabase channels accumulate and can hit subscription limits. Always `removeChannel` in cleanup.
- **`ai.files.get({ uri })` instead of `{ name }`:** The polling call takes `name` (e.g., `files/abc123`), not the URI.
- **Hardcoded `DEFAULT_NICHE` + `DEFAULT_ENABLED` constants post-Phase 5:** These must be replaced by the settings fetch result. The fallback to Phase 4 defaults only applies when `GET /api/settings` fails.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI API auth + retries | Custom fetch with retry logic | `@google/genai` / `@anthropic-ai/sdk` / `openai` | SDKs handle auth headers, exponential backoff, type safety |
| Realtime websocket management | Manual WebSocket to Supabase | `supabase.channel().on()` | Already in `@supabase/supabase-js` 2.105.1; handles reconnect, auth |
| AES-256-GCM decryption in proxy | New crypto impl | `encryption.ts` `decrypt()` — already exists | Exact same pattern as `oauth.ts` |
| Base64 image encoding from File | Custom FileReader + ArrayBuffer dance | Canvas API frame extraction is Phase 3's job; Phase 5 receives `framesBase64: string[]` from `EngineSignals` | Already solved in Phase 3 spec |

**Key insight:** All encryption, auth middleware, DB query patterns, and Supabase client setup already exist in the codebase. Phase 5 is integration work — not infrastructure work.

---

## Common Pitfalls

### Pitfall 1: Wrong Gemini Package Name

**What goes wrong:** Importing from `@google/generative-ai` or using `GoogleAIFileManager` from that package — file uploads fail because the deprecated SDK wraps the Files API differently.
**Why it happens:** Training data and many tutorials still reference the old package.
**How to avoid:** Install and import only `@google/genai`; use `new GoogleGenAI({ apiKey })`.
**Warning signs:** TypeScript complains about `GoogleAIFileManager` not existing, or `ai.files` is undefined.

### Pitfall 2: Gemini responseMimeType Without responseSchema

**What goes wrong:** Setting only `responseMimeType: 'application/json'` — the model returns valid JSON but with an arbitrary structure, not the D-03 schema.
**Why it happens:** Documentation examples sometimes show just the mime type.
**How to avoid:** Always pass BOTH `responseMimeType` AND `responseSchema` — required per CLAUDE.md and AI-06.
**Warning signs:** Parsed output has wrong field names or missing platforms.

### Pitfall 3: Anthropic dangerouslyAllowBrowser Runtime Error

**What goes wrong:** Calling `new Anthropic({ apiKey })` from browser without the flag — SDK throws `"It looks like you're running in a browser-like environment"` at construction time.
**Why it happens:** The SDK guards against accidental browser key exposure.
**How to avoid:** Always construct with `dangerouslyAllowBrowser: true` in `lib/ai.ts` when `ai_provider === 'claude'`.
**Warning signs:** Console error at construction time before any API call is made.

### Pitfall 4: express.json() Size Limit for OpenAI Proxy

**What goes wrong:** The proxy route receives 10 base64 JPEG frames; each 512×512 JPEG is ~40-60 KB — total payload easily 500 KB+, which exceeds the 10 MB limit in `app.ts`… but wait: `express.json({ limit: '10mb' })` is already set. However, if frames are 1080p source images the payload could be larger.
**Why it happens:** Frame size depends on what Phase 3 extracts.
**How to avoid:** Phase 3 spec specifies `scale=512:512` for frame extraction — frames are bounded. The 10 MB limit in `app.ts` is sufficient.
**Warning signs:** `413 Payload Too Large` from Express on the proxy route.

### Pitfall 5: Supabase Realtime Not Enabled for Table

**What goes wrong:** Subscription is set up, no errors, but no events arrive — `platform_posts` table doesn't have Realtime enabled in the Supabase dashboard.
**Why it happens:** Realtime must be explicitly enabled per table in Supabase dashboard under Database → Replication.
**How to avoid:** Wave 0 task: verify `platform_posts` has Realtime enabled in dashboard.
**Warning signs:** `subscribe()` callback fires but no change events arrive even after DB writes.

### Pitfall 6: Realtime filter for user_id when userId is null

**What goes wrong:** Subscription set up before session is loaded — `userId` is `null` → filter becomes `user_id=eq.null` → no events match.
**Why it happens:** Race condition between session load and Realtime setup.
**How to avoid:** Only subscribe after `supabase.auth.getSession()` returns a non-null session; tie subscription setup to the `useEffect` that depends on `[postId, userId]`.
**Warning signs:** No Realtime events despite DB writes; `userId` in filter is the string `"null"`.

### Pitfall 7: JSON Parsing — Empty String Coercion

**What goes wrong:** When `parseAIOutput` returns `emptyAIOutput()`, React renders empty `<p>` tags inside cards which look blank — user may think generation failed.
**Why it happens:** Graceful fallback always renders the card structure.
**How to avoid:** Show a field-level error message ("Copy unavailable") when the field is empty after generation, not before. Distinguish pre-generation state (`aiOutput === null`) from post-generation empty field (`aiOutput !== null && field === ''`).

### Pitfall 8: `app.ts` CSP Blocks AI Provider Domains

**What goes wrong:** Claude and Gemini calls from the browser are blocked by the CSP header set in `app.ts`: `connect-src 'self' https://*.supabase.co`.
**Why it happens:** The existing CSP only allows Supabase connections — AI provider API domains are not listed.
**How to avoid:** Update CSP in `app.ts` to add provider domains:
- Gemini: `https://generativelanguage.googleapis.com`
- Anthropic: `https://api.anthropic.com`
- OpenAI calls go through backend proxy — no browser CSP change needed for OpenAI.
**Warning signs:** Browser console shows `Content Security Policy` violation blocking the API call.

---

## Code Examples

### Verified Pattern — TypeScript Image Content Block (Anthropic)

```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/vision (verified 2026-05-02)
// The `data` field is the raw base64 string — no "data:image/jpeg;base64," prefix
{
  type: 'image' as const,
  source: {
    type: 'base64' as const,
    media_type: 'image/jpeg' as const,  // or 'image/png', 'image/webp', 'image/gif'
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  },
}
```

### Verified Pattern — Supabase Realtime Filter Syntax

```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes (verified 2026-05-02)
filter: `user_id=eq.${userId}`   // column=operator.value — no spaces
```

### Verified Pattern — Gemini File State Values

```
PROCESSING   — file is being processed; poll, do not call generateContent
ACTIVE       — file is ready; proceed to generateContent
FAILED       — processing error; re-upload required
STATE_UNSPECIFIED — default/unknown; treat like PROCESSING
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` + `GoogleAIFileManager` | `@google/genai` unified SDK (`ai.files.upload`) | 2025 GA | Single client, cleaner API, Files API built-in |
| `google-generativeai` Python (similar) | Migration deadline Aug 2025 | 2025 | JS deprecation is softer but new projects must use `@google/genai` |
| Browser-blocked Anthropic calls | `dangerouslyAllowBrowser: true` | Aug 2024 | Claude now usable from browser (with explicit opt-in) |

**Deprecated/outdated:**
- `GoogleAIFileManager` from `@google/generative-ai`: replaced by `ai.files` namespace in `@google/genai`
- `genai.GenerativeModel` pattern: replaced by `ai.models.generateContent` in new SDK

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OpenAI chat.completions image format uses `image_url` with `data:image/jpeg;base64,...` data URI | Pattern 4 (OpenAI proxy) | OpenAI proxy sends malformed request; frames not received by model |
| A2 | `navigator.clipboard.writeText` works without additional permissions on HTTPS/localhost | Pattern 7 (copy-to-clipboard) | Copy button silently fails; user cannot copy text |
| A3 | Supabase Realtime is not yet enabled on `platform_posts` table in dashboard | Pitfall 5 | No upload state events arrive (fixable in Wave 0) |

---

## Open Questions

1. **OpenAI image_url format in chat.completions (A1)**
   - What we know: Anthropic uses `{ type: 'image', source: { type: 'base64', data: '...' } }`
   - What's unclear: Whether OpenAI SDK 6.35 `chat.completions` uses `image_url: { url: 'data:...' }` or a different structure for base64 inline
   - Recommendation: Verify against `openai` 6.35.0 TypeScript types after install (`ChatCompletionContentPartImage`); the data URI format is a safe assumption but confirm.

2. **Supabase Realtime enabled for platform_posts**
   - What we know: The `platform_posts` table exists with `upload_status` column
   - What's unclear: Whether the project's Supabase instance has Realtime enabled for this specific table
   - Recommendation: Make Wave 0 task to verify in Supabase Dashboard → Database → Replication → Supabase Realtime → `platform_posts` table toggle.

3. **Gemini file upload when signals === null (description-only path)**
   - What we know: D-06 says button is active when `selectedFile === null` AND description is present; Gemini Files API requires a file
   - What's unclear: Whether to skip the Files API step (send text-only prompt to Gemini) when no file is selected
   - Recommendation: When `selectedFile === null`, call `generateContent` with text-only prompt (no `fileData` part) — this is explicitly supported by Gemini. The ACTIVE poll loop is simply not needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@google/genai` | AI-03 Gemini Files API | ✗ (not installed) | — | Install in Wave 0 |
| `@anthropic-ai/sdk` | AI-04 Claude browser call | ✗ (not installed) | — | Install in Wave 0 |
| `openai` | AI-05 OpenAI proxy (backend) | ✗ (not installed) | — | Install in Wave 0 |
| Supabase project (live) | Realtime subscription | ✓ (assumed from Phase 2) | — | — |
| `platform_posts` Realtime enabled | PLATFORM-09 | ? (not verified) | — | Verify/enable in Supabase Dashboard |
| Node.js 22 | Backend OpenAI proxy | ✓ (Phase 1 established) | 22.x | — |

**Missing dependencies — install required in Wave 0:**
- `frontend`: `@google/genai@1.51.0`, `@anthropic-ai/sdk@0.92.0`
- `backend`: `openai@6.35.0`

**Missing dependencies — dashboard action required:**
- Enable Supabase Realtime for `platform_posts` table (cannot be done via code)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (frontend) / Vitest 3.2.4 (backend) |
| Config file | `frontend/vitest.config.ts` (dual-project: node + browser) |
| Quick run command | `cd frontend && npm run test:run -- --reporter=verbose src/lib/` |
| Full suite command | `cd frontend && npm run test:run && cd ../backend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-06 | Both `responseMimeType` AND `responseSchema` passed to Gemini | unit | `vitest run src/lib/ai.test.ts` | ❌ Wave 0 |
| AI-09 | JSON robustness: fenced JSON, truncated JSON, bare object | unit | `vitest run src/lib/ai.test.ts` | ❌ Wave 0 |
| AI-10 | MQ checklist items flip from pending → pass/fail after aiOutput | unit | `vitest run src/lib/checklist.test.ts` | ✅ extend existing |
| AI-11 | Second pass sends `improved_script_outline`, no images | unit | `vitest run src/lib/ai.test.ts` | ❌ Wave 0 |
| PLATFORM-03 | Copy button calls `navigator.clipboard.writeText` | unit (happy-dom) | `vitest run --project=browser src/components/` | ❌ Wave 0 |
| PLATFORM-06 | TikTok upload button is disabled/greyed | unit (happy-dom) | `vitest run --project=browser src/components/` | ❌ Wave 0 |
| PLATFORM-09 | Upload status state machine (idle→uploading→posted/failed) | unit | `vitest run src/components/PlatformCopyCard.test.tsx` | ❌ Wave 0 |
| AI-05 | OpenAI proxy: API key never in response; decrypts before call | integration | `cd backend && npm test routes/ai.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend && npm run test:run -- src/lib/`
- **Per wave merge:** `cd frontend && npm run test:run && cd ../backend && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work 5`

### Wave 0 Gaps

- [ ] `frontend/src/lib/ai.test.ts` — covers AI-06, AI-09, AI-11; needs MSW mock or jest-mock-fetch for SDK calls
- [ ] `frontend/src/lib/checklist.test.ts` — EXTEND existing; add MQ re-evaluation test cases for D-09..12
- [ ] `frontend/src/components/PlatformCopyCard.test.tsx` — covers PLATFORM-03, PLATFORM-06, PLATFORM-09
- [ ] `backend/src/routes/ai.test.ts` — integration test for OpenAI proxy; mock `openai` SDK + verify key never leaks
- [ ] SDK installs: `cd frontend && npm install @google/genai@1.51.0 @anthropic-ai/sdk@0.92.0` and `cd backend && npm install openai@6.35.0`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `res.locals.userId` from authMiddleware on every backend route |
| V3 Session Management | no | Session handled by Supabase SDK (Phase 1) |
| V4 Access Control | yes | RLS on `posts` + `platform_posts`; authMiddleware on proxy route |
| V5 Input Validation | yes | Validate `enabled_platforms`, `niche`, `ai_output` structure before DB insert |
| V6 Cryptography | yes | AES-256-GCM `decrypt()` from `encryption.ts` — never hand-roll |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in response | Information Disclosure | Never return decrypted API key; OpenAI proxy returns only AI text response |
| AI output injection (prompt injection in AI response) | Tampering | JSON parse only; never `eval()` or `dangerouslySetInnerHTML` AI output |
| Cross-user post access | Elevation of Privilege | RLS on `posts` + `platform_posts`; `user_id` set from `res.locals.userId` not from request body |
| CSP bypass via AI provider domains | Spoofing | Update `connect-src` in `app.ts` to explicitly list `https://api.anthropic.com` and `https://generativelanguage.googleapis.com` |
| Oversized AI proxy payload (frames) | Denial of Service | `express.json({ limit: '10mb' })` already set; 10× 512×512 JPEG ≈ 500 KB, well within limit |

---

## Sources

### Primary (HIGH confidence)
- `@google/genai` official docs — Files API upload/poll/generate flow, file states
- `@anthropic-ai/sdk` TypeScript SDK page — `dangerouslyAllowBrowser`, image content blocks, error types
- `@anthropic-ai/sdk` Vision guide — base64 image block format (`type: 'image'`, `source.type: 'base64'`, raw data string)
- Supabase Realtime Postgres Changes docs — filter syntax, RLS behaviour, channel cleanup
- Gemini structured output docs — `responseMimeType` + `responseSchema` requirement
- Codebase: `encryption.ts`, `settings.ts`, `checklist.ts`, `GeneratorPage.tsx`, `schema.ts` — all verified via Read tool

### Secondary (MEDIUM confidence)
- npm registry: `@google/genai@1.51.0` (published 2026-04-29), `@anthropic-ai/sdk@0.92.0`, `openai@6.35.0` — verified current versions
- Gemini migration guide — confirms `@google/generative-ai` is deprecated; `@google/genai` is the replacement

### Tertiary (LOW confidence)
- OpenAI `chat.completions` image_url format for base64 (A1) — assumed from training knowledge; verify against openai 6.35 TypeScript types after install

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified npm registry versions + official SDK docs
- Architecture: HIGH — locked decisions from CONTEXT.md + verified existing codebase patterns
- Gemini Files API: HIGH — verified official docs flow (upload → poll ACTIVE → generateContent)
- Anthropic browser SDK: HIGH — verified `dangerouslyAllowBrowser` and image block format from official docs
- OpenAI proxy pattern: MEDIUM — decryption pattern verified (encryption.ts); OpenAI image format is A1 (low confidence item)
- Supabase Realtime: HIGH — filter syntax and RLS behaviour verified from official docs
- Pitfalls: HIGH — CSP pitfall confirmed by reading `app.ts` CSP header; Realtime enable pitfall confirmed by Supabase docs

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (stable SDKs; Gemini model names may drift)
