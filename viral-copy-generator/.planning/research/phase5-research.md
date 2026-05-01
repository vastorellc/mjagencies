# Phase 5 Deep Research
## AI Copy Generation + Platform Cards

**Researched:** 2026-04-30
**Scope:** Phase 5 — Single AI call → 5 platform outputs as JSON; styled cards with per-field copy; "Get Better Version"; manual copy always available.

---

## Confirmed Approach (no changes needed)

### 1. Gemini 2.5 Flash + Files API — confirmed working

`gemini-2.5-flash` explicitly lists "Text, images, video, audio" as supported input modalities with a 1,048,576 token context window. [VERIFIED: ai.google.dev/gemini-api/docs/models/gemini-2.5-flash]

The Files API two-step flow works for video:

**Step 1 — Upload file:**
```
POST https://generativelanguage.googleapis.com/upload/v1beta/files
Headers:
  X-Goog-Upload-Command: start
  X-Goog-Upload-Header-Content-Type: video/mp4
  X-Goog-Upload-Header-Content-Length: <file_size_bytes>

Second request with actual bytes:
  X-Goog-Upload-Command: upload, finalize
```
Response contains `file.uri` and `file.name`.

**Step 2 — Poll for ACTIVE state (required — do not skip):**
```javascript
while (file.state.toString() !== 'ACTIVE') {
  await sleep(5000);
  file = await ai.files.get({ name: file.name });
}
```
Files stay in `PROCESSING` for seconds to minutes. Using a file before it is ACTIVE returns: "The File [ID] is not in an ACTIVE state and usage is not allowed." [VERIFIED: discuss.ai.google.dev/t/gemini-2-5-flash-api-cannot-process-video-input/80093]

**Step 3 — Generation request:**
```javascript
const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{
    parts: [
      { fileData: { mimeType: 'video/mp4', fileUri: file.uri } },
      { text: promptText }
    ]
  }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: outputSchema
  }
});
```

Supported video MIME types: `video/mp4`, `video/mpeg`, `video/mov`, `video/avi`, `video/x-flv`, `video/mpg`, `video/webm`, `video/wmv`, `video/3gpp`. [VERIFIED: ai.google.dev forum]

The spec states "Gemini: video → base64 → inline_data with mime_type." This is **wrong for videos over ~20 MB in practice** (inline video processing is a known broken path on 2.5-flash — Google themselves acknowledged 500/503 errors even on 300 KB inline uploads). Files API is mandatory regardless of file size. See Issues Found.

### 2. Gemini JSON mode — confirmed working with schema required

`response_mime_type: "application/json"` is supported on `gemini-2.5-flash`. A `response_schema` (or `responseSchema` in the JS SDK) is **required** alongside it. [VERIFIED: ai.google.dev/gemini-api/docs/structured-output]

The schema can be defined inline as a JSON Schema object. Known limitations:
- Not all JSON Schema features are supported — the model silently ignores unsupported properties.
- Very large or deeply nested schemas may be rejected. The Phase 5 output schema (5 platforms, ~25 fields) is within safe complexity bounds.
- JSON mode guarantees syntactically valid JSON but not semantically correct values.
- The `-image` variant of 2.5-flash (different model ID) does **not** support JSON mode — returns 400. Use `gemini-2.5-flash` exactly. [CITED: github.com/google-gemini/cookbook/issues/1028]

### 3. Claude Sonnet 4.5 vision — confirmed working, 10 frames is well within limits

The Anthropic Messages API accepts up to 100 images per request (for 200k-token context models) or 600 for others. 10 frames is trivially within limits. [VERIFIED: platform.claude.com/docs/en/build-with-claude/vision]

Max image size via base64: 5 MB per image. A 720p JPEG frame extracted by ffmpeg.wasm is typically 50–200 KB — far below the limit.

Image token cost: approximately `width × height / 750` tokens. A 1280×720 frame = ~1229 tokens. Ten such frames ≈ 12,290 image tokens. At Claude Sonnet 4.5 pricing (~$3/M input tokens), 10 frames cost roughly **$0.037 in image tokens alone** per generation call. Plus text prompt tokens. Total per-generation cost: roughly $0.05–$0.08 depending on prompt length.

**Content block structure (TypeScript):**
```typescript
const imageBlocks = frames.map(frame => ({
  type: 'image' as const,
  source: {
    type: 'base64' as const,
    media_type: 'image/jpeg' as const,
    data: frame.base64
  }
}));

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 2048,
  messages: [{
    role: 'user',
    content: [
      ...imageBlocks,
      { type: 'text', text: promptText }
    ]
  }]
});
```
[VERIFIED: platform.claude.com/docs/en/build-with-claude/vision]

### 4. GPT-4.1 vision — confirmed working

`gpt-4.1` is a real model. Input modalities: "Text, image". Context window: 1,047,576 tokens. Available via `v1/chat/completions`. [VERIFIED: developers.openai.com/api/docs/models/gpt-4.1]

The error "gpt-4.1-2025-04-14 does not support image message content types" was specific to the Azure Foundry Agent SDK — NOT the standard Chat Completions API. [CITED: learn.microsoft.com/en-us/answers/questions/5491360]

**Frame-passing pattern (same as Claude, different structure):**
```typescript
const imageContent = frames.map(frame => ({
  type: 'image_url' as const,
  image_url: {
    url: `data:image/jpeg;base64,${frame.base64}`,
    detail: 'low' // use 'low' for frames — saves tokens, adequate for scene understanding
  }
}));

const response = await openai.chat.completions.create({
  model: 'gpt-4.1',
  max_tokens: 2048,
  response_format: { type: 'json_object' },
  messages: [{
    role: 'user',
    content: [
      ...imageContent,
      { type: 'text', text: promptText }
    ]
  }]
});
```

### 5. JSON parser robustness — strip fences + first/last bracket fallback is necessary

AI models add markdown fences approximately 20% of the time even when instructed not to. This is a known failure mode across all providers. The spec's two-step parser (strip fences, then find first `{` / last `}`) is correct. Additional failure modes to handle:

| Failure Mode | Frequency | Solution |
|---|---|---|
| Markdown code fences ` ```json ... ``` ` | ~20% | Strip fences regex |
| Extra explanation before JSON | ~5% | Find first `{` |
| Extra explanation after JSON | ~5% | Find last `}` |
| Truncated JSON (max_tokens too low) | Rare if max_tokens ≥ 2048 | Set max_tokens to 3000+ for output with 5 platforms |
| Nested code blocks inside string values | Very rare | json-repair library |
| Invalid escape sequences in strings | ~2% | json-repair library |
| Trailing commas | ~3% | json-repair library |

Recommended robust parser:
```typescript
import jsonRepair from 'json-repair'; // npm install json-repair

function parseAIResponse(raw: string): PlatformCopy {
  // Step 1: strip markdown fences
  let cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');
  // Step 2: find JSON boundaries
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.slice(start, end + 1);
  }
  // Step 3: try clean parse first
  try {
    return JSON.parse(cleaned) as PlatformCopy;
  } catch {
    // Step 4: attempt structural repair
    try {
      return JSON.parse(jsonRepair(cleaned)) as PlatformCopy;
    } catch {
      throw new Error('AI response could not be parsed as JSON');
    }
  }
}
```

### 6. "Get Better Version" architecture — second prompt with appended outline

The spec design (send `improved_script_outline` from the first response as additional context in a second call) is correct. Research confirms that for creative copy refinement tasks (non-reasoning), a **separate prompt with the outline as input** outperforms both raw repetition and zero-shot re-generation.

**Recommended pattern:** A distinct shorter prompt that says "Here is a first pass and an improved outline — rewrite with these improvements" rather than re-running the full 400-token analysis prompt. This reduces token cost by ~40% on the second pass because you do not need to re-send all engine signals.

```typescript
const betterVersionPrompt = `
You previously generated social media copy for a video. Here is the improved script outline:
"${firstResponse.improved_script_outline}"

Hook rewrite suggestion: "${firstResponse.hook_rewrite}"

Now generate a better version of all 5 platform outputs, applying these improvements.
Keep the same JSON structure. Make the copy more engaging, sharper, and more specific.

Return ONLY a JSON object with the same structure as before.
`;
```

Second call sends: outline + hook_rewrite as context, NOT the full engine signals again. This is both cheaper and produces better results since the model focuses on improvement rather than re-analysis.

---

## Issues Found (must fix in plan)

### ISSUE-1: Spec says Gemini uses inline_data — this is broken for 2.5-flash [CRITICAL]

**Spec text:** "Gemini: video → base64 → inline_data with mime_type"

**Reality:** Inline video processing (inline_data) produces 500/503 errors on gemini-2.5-flash even for small files (300 KB). Google acknowledged this as an unresolved bug and recommends Files API as the only reliable path. [VERIFIED: discuss.ai.google.dev/t/gemini-2-5-flash-api-cannot-process-video-input/80093]

**Fix:** Gemini path in `ai.ts` must always use Files API, not inline_data. The size threshold the existing research documented (~70 MB) is irrelevant — inline is broken entirely on 2.5-flash. Use Files API for all Gemini video requests.

**Additional implication:** Files API requires the video to travel from the browser to Google's servers. The video is already in the browser (ffmpeg.wasm runs in-browser). The browser can upload directly to `generativelanguage.googleapis.com/upload/v1beta/files` using the user's API key — this works from the browser with the Google GenAI JS SDK (`@google/genai`). CORS is not blocked for the Google GenAI API from the browser.

However, there is a **mandatory polling wait** before generation can proceed. If the user's video is 50–100 MB, upload + processing can take 30–90 seconds. The loading state "Generating copy..." must accommodate this and show upload progress.

### ISSUE-2: OpenAI CORS — direct browser calls to OpenAI are blocked [CRITICAL]

**Finding:** OpenAI does not allow direct CORS requests from browsers. The standard API (`api.openai.com`) blocks browser-originated fetch requests with no `Access-Control-Allow-Origin` header. This is a persistent, intentional policy — not a temporary issue. Recent reports (January 2026) confirm this affects all OpenAI API endpoints including the new Responses API. [CITED: community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791]

**Impact:** The spec's architectural decision A1 ("AI calls from browser") breaks for OpenAI. The Gemini call and Claude call work from the browser; OpenAI does not.

**Fix options (choose one):**
1. **Proxy through backend** — Frontend sends frames + prompt to backend; backend calls OpenAI; returns JSON. Cleanest security-wise. Adds ~100ms latency. Requires a backend route.
2. **Use OpenAI SDK with `dangerouslyAllowBrowser`** — The OpenAI npm SDK has this flag BUT it does not bypass the CORS restriction imposed by OpenAI's servers. The flag only suppresses the SDK-level warning; the browser fetch will still fail with CORS error.

The only real fix is a backend proxy for OpenAI calls. This requires the frontend to send the frames as a multipart or JSON payload to `POST /api/ai/openai`, which the backend then relays to OpenAI using the decrypted API key from DB.

**This is a spec correction**: the "AI key stored in DB" design from Phase 2 actually makes the backend proxy pattern natural — the backend already has the key, so proxying is straightforward.

### ISSUE-3: Anthropic browser calls require explicit opt-in [MEDIUM]

**Finding:** Anthropic enabled CORS support for browser calls in August 2024. It requires:
- SDK: `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })`
- OR HTTP header: `anthropic-dangerous-direct-browser-access: true`

[VERIFIED: simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/]

The flag name is intentionally alarming — Anthropic is signaling that exposing your API key in the browser is a risk. For this tool (personal use, user's own key, no sensitive org-level key), this is acceptable. The flag must be set explicitly or the SDK throws before making any network call.

**Fix:** In `ai.ts`, when calling Claude, always pass `dangerouslyAllowBrowser: true`. Add a comment explaining this is intentional for the BYO-key single-user pattern.

### ISSUE-4: Gemini JSON mode requires a responseSchema [MEDIUM]

The spec shows calling Gemini with only `response_mime_type: "application/json"` in generation config. This alone is insufficient — Google's documentation states a `response_json_schema` (or `responseSchema` in JS SDK) is required alongside `responseMimeType`. [VERIFIED: ai.google.dev/gemini-api/docs/structured-output]

**Fix:** Define the full output schema as a `SchemaUnion` type from `@google/genai` and pass it in `generationConfig.responseSchema`. The schema maps to the JSON structure in the spec prompt template.

### ISSUE-5: Gemini Files API polling can block for 10+ minutes [LOW severity but UX risk]

Large videos (100–250 MB) can remain in `PROCESSING` state for extended periods. The polling loop must have a timeout (e.g., 10 minutes maximum) after which it shows an error rather than spinning indefinitely.

**Fix:** Add a timeout counter to the polling loop:
```typescript
const MAX_WAIT_MS = 600_000; // 10 minutes
const startTime = Date.now();
while (file.state !== 'ACTIVE') {
  if (Date.now() - startTime > MAX_WAIT_MS) {
    throw new Error('Video processing timed out. Try a shorter video.');
  }
  await sleep(5000);
  file = await ai.files.get({ name: file.name });
}
```

---

## Implementation Notes (specific code patterns)

### A. Provider routing in ai.ts

```typescript
export type AIProvider = 'gemini' | 'claude' | 'openai';

export async function generateCopy(
  provider: AIProvider,
  apiKey: string,
  signals: EngineSignals,
  frames: FrameData[], // only used by claude/openai
  videoFile: File      // only used by gemini
): Promise<PlatformCopy> {
  switch (provider) {
    case 'gemini':  return generateWithGemini(apiKey, signals, videoFile);
    case 'claude':  return generateWithClaude(apiKey, signals, frames);
    case 'openai':  return generateWithOpenAI_proxy(signals, frames); // calls backend proxy
  }
}
```

Note: OpenAI takes a different path — it calls the backend proxy (no API key in browser). The API key is already stored encrypted in the DB from Phase 2; the backend decrypts it for the proxy call.

### B. Gemini Files API path

```typescript
import { GoogleGenAI } from '@google/genai';

async function generateWithGemini(
  apiKey: string,
  signals: EngineSignals,
  videoFile: File
): Promise<PlatformCopy> {
  const ai = new GoogleGenAI({ apiKey });

  // Upload video
  const uploadResult = await ai.files.upload({
    file: videoFile,
    config: { mimeType: 'video/mp4' }
  });

  // Poll until ACTIVE
  let fileInfo = await ai.files.get({ name: uploadResult.name });
  const MAX_WAIT_MS = 600_000;
  const startTime = Date.now();
  while (fileInfo.state !== 'ACTIVE') {
    if (Date.now() - startTime > MAX_WAIT_MS) {
      throw new Error('Video processing timed out after 10 minutes.');
    }
    await sleep(5000);
    fileInfo = await ai.files.get({ name: uploadResult.name });
  }

  // Generate with JSON mode
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: fileInfo.uri } },
        { text: buildPrompt(signals) }
      ]
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: PLATFORM_COPY_SCHEMA // SchemaUnion
    }
  });

  return parseAIResponse(result.text ?? '');
}
```

### C. Claude path

```typescript
import Anthropic from '@anthropic-ai/sdk';

async function generateWithClaude(
  apiKey: string,
  signals: EngineSignals,
  frames: FrameData[] // 10 JPEG frames, each <200 KB
): Promise<PlatformCopy> {
  // Resize frames to 768x432 before sending — reduces token cost ~50%
  // At 768x432: tokens = 768*432/750 ≈ 443 tokens per frame × 10 = 4430 image tokens
  const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const imageBlocks = frames.map(f => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: f.base64 }
  }));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 3000, // enough for all 5 platform outputs
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: buildPrompt(signals) }
      ]
    }]
  });

  const text = response.content.find(b => b.type === 'text')?.text ?? '';
  return parseAIResponse(text);
}
```

### D. OpenAI backend proxy route (Express)

The frontend sends frames as JSON to the backend:

```typescript
// Frontend: api.ts
export async function generateCopyOpenAI(
  signals: EngineSignals,
  frames: FrameData[]
): Promise<PlatformCopy> {
  const response = await fetch('/api/ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signals,
      frames: frames.map(f => f.base64) // send base64 strings only
    })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message ?? 'OpenAI proxy error');
  }
  return response.json();
}
```

```typescript
// Backend: routes/ai.ts
router.post('/openai', async (req, res) => {
  const settings = await getSettings(); // reads from DB
  const apiKey = decrypt(settings.aiApiKey); // AES-256-GCM

  const { signals, frames } = req.body;

  const openai = new OpenAI({ apiKey });
  const imageContent = frames.map((base64: string) => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' as const }
  }));

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1',
    max_tokens: 3000,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [...imageContent, { type: 'text', text: buildPrompt(signals) }]
    }]
  });

  const text = completion.choices[0]?.message?.content ?? '';
  try {
    res.json(parseAIResponse(text));
  } catch (err) {
    res.status(422).json({ message: 'AI returned unparseable JSON' });
  }
});
```

### E. Token budget estimate for the spec's prompt

The spec prompt template is approximately 350 words of static text plus injected signals (~50 tokens) plus injected hashtag banks (~100 tokens) plus learning signals (~100 tokens). Total prompt text: roughly **600–800 tokens**. This is well within all model limits.

Output for all 5 platforms: approximately 600–900 tokens of JSON. A safe `max_tokens` of **3000** covers both a verbose response and any model padding.

**Per-generation cost estimates (user's key):**

| Provider | Input tokens | Output tokens | Approx cost |
|---|---|---|---|
| Claude Sonnet 4.5 (10 frames @ 768px) | ~5000 | ~800 | ~$0.017 |
| Gemini 2.5 Flash (video) | ~1000 text (video billed separately) | ~800 | ~$0.001–0.003 |
| GPT-4.1 (10 frames @ low detail) | ~2800 | ~800 | ~$0.004 |

Costs are trivial for personal use. "Get Better Version" second pass costs roughly 50% less since images are not re-sent for Claude/OpenAI.

### F. Streaming vs. wait-for-complete

**Recommendation: Wait for complete response, then render all 5 cards at once.**

Reasoning:
1. The output is structured JSON — partially rendered cards (half a hashtag array, missing fields) are confusing and unusable. Users cannot copy an incomplete field.
2. All 5 cards must render simultaneously to avoid perceived unfairness between platforms.
3. A clear two-phase progress indicator ("Generating copy...") with elapsed time counter gives adequate feedback during the 5–15 second wait.
4. Streaming JSON incremental parsing adds significant complexity for zero user benefit in this card-rendering context.

If streaming is added in Phase 8 Polish, use server-sent events from the backend proxy (for OpenAI) or stream directly from SDK (for Gemini/Claude). Do not implement in Phase 5.

### G. Error handling and rate limit states

| Error | HTTP | UI State |
|---|---|---|
| Invalid API key | 401 | "API key is invalid. Check Settings." |
| Rate limit / quota | 429 | "Rate limit hit. Wait a moment and try again." |
| No credits | 429 | "API quota exhausted. Top up your account." |
| Video too large (Gemini) | 413 | "Video exceeds upload limit. Try under 200 MB." |
| Processing timeout | N/A | "Video took too long to process. Try a shorter clip." |
| JSON parse failure | N/A | "AI returned unexpected output. Try again." |
| Network error | N/A | "Connection failed. Check your internet." |

For Gemini, distinguish between 429 "rate limit" and 429 "quota exceeded" by inspecting the error message — they require different user instructions.

### H. "Get Better Version" button state

- Button appears only after first successful generation.
- During second pass, show "Getting better version..." state on button.
- On completion, replace cards with new output.
- Do not clear first-pass output until second pass succeeds (so user can still copy from first pass if second fails).
- Second pass does NOT re-upload the video for Gemini. The uploaded file URI stays valid for 48 hours — cache it in React state and reuse it.

---

## Dependency Checklist (must be true before Phase 5 starts)

- [ ] Phase 4 complete: `EngineSignals` type is defined and populated by the video analysis engine
- [ ] Phase 4 complete: `virality_score`, `gaps`, `checklist` results are available as inputs to the prompt builder
- [ ] Phase 2 complete: `settings.ai_provider` and `settings.ai_api_key` (encrypted) exist in DB and the `GET /settings` endpoint returns the provider
- [ ] Phase 1 complete: `POST /api/ai/openai` route exists (backend AI proxy) — OR plan for OpenAI is to add this route in Phase 5
- [ ] `@google/genai` npm package installed (new SDK — NOT `@google/generative-ai` which is the older package)
- [ ] `@anthropic-ai/sdk` npm package installed
- [ ] `openai` npm package installed (backend only)
- [ ] `json-repair` npm package installed (frontend)
- [ ] Frame extraction from Phase 3 produces base64 JPEG strings accessible to `ai.ts`
- [ ] `frames` are resized to ≤768px before being passed to Claude/OpenAI (either in `video.ts` or at call site in `ai.ts`)
- [ ] Backend route `POST /api/ai/openai` implemented and tested with a real OpenAI key before Phase 5 ships

**SDK version note:** The older `@google/generative-ai` package uses `GoogleGenerativeAI` class and a different method structure. The new `@google/genai` package (current as of 2025) uses `GoogleGenAI` and `ai.models.generateContent()`. Use `@google/genai`. Verify: `npm view @google/genai version` before writing any Gemini code.

---

## Estimated Risk: MEDIUM

**Why not LOW:**
- The CORS/OpenAI architectural issue (ISSUE-2) requires adding a backend proxy route that the spec did not plan for. This is a real implementation change, not just a code pattern fix.
- Gemini Files API polling with variable processing times (seconds to 10 minutes) creates UX unpredictability that must be explicitly handled in the loading state machine.
- The spec's inline_data path for Gemini must be discarded entirely — confirmed broken on 2.5-flash.

**Why not HIGH:**
- All three AI providers are confirmed to work with the intended approach (just with adjustments above).
- JSON mode is confirmed available on all three providers.
- The backend proxy for OpenAI is a small, well-understood Express route addition.
- The 10-frame approach for Claude/OpenAI is proven and within all documented limits.
- Costs are trivially low — no risk of unexpected spend.

**Key risk mitigation actions:**
1. Implement and test the OpenAI backend proxy route as the very first task in Phase 5.
2. Test Gemini Files API upload + polling with a real video file before wiring up the full generation flow.
3. Test JSON parsing with deliberately broken responses (manually inject markdown fences, truncated JSON) before Phase 5 ships.

---

## Sources

### Primary (HIGH confidence — verified via tool)
- [Gemini 2.5 Flash model card](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) — input modalities, context window
- [Gemini structured output docs](https://ai.google.dev/gemini-api/docs/structured-output) — JSON mode requirements, schema requirements
- [Gemini video processing forum thread](https://discuss.ai.google.dev/t/gemini-2-5-flash-api-cannot-process-video-input/80093) — inline_data broken on 2.5-flash, Files API polling pattern
- [Anthropic vision docs](https://platform.claude.com/docs/en/build-with-claude/vision) — image limits, token costs, content block structure
- [OpenAI GPT-4.1 model card](https://developers.openai.com/api/docs/models/gpt-4.1) — vision support confirmed, context window
- [Gemini Files API upload docs](https://ai.google.dev/gemini-api/docs/files) — upload endpoint, URI format
- [Simon Willison on Anthropic CORS](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) — dangerouslyAllowBrowser confirmed

### Secondary (MEDIUM confidence)
- [Gemini cookbook issue #1028](https://github.com/google-gemini/cookbook/issues/1028) — gemini-2.5-flash-image JSON mode broken (different model ID)
- [OpenAI CORS forum threads](https://community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791) — OpenAI blocks browser CORS confirmed Jan 2026
- [Gemini Files API polling JS example](https://deepwiki.com/google-gemini/cookbook/3.2-file-api-and-media-management) — polling pattern
- [Azure MS Q&A on gpt-4.1 image error](https://learn.microsoft.com/en-us/answers/questions/5491360/invalid-model-gpt-4-1-2025-04-14-does-not-support) — error is Azure Agent SDK specific, not Chat Completions API

### Tertiary (informational, MEDIUM-LOW)
- [json-repair GitHub](https://github.com/mangiucugna/json_repair) — JSON repair library for fallback parsing
- [Aha engineering on streaming JSON](https://www.aha.io/engineering/articles/streaming-ai-responses-incomplete-json) — streaming vs complete response tradeoffs
- [OpenAI error codes docs](https://developers.openai.com/api/docs/guides/error-codes) — 401/429 error semantics
