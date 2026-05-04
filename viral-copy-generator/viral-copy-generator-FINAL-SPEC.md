# Viral Copy Generator — Final Locked Spec

## What This Is
Upload your short-form video. A free in-browser engine analyses it. AI generates
platform-optimised captions, tags, descriptions, and hashtags. Auto-uploads to
YouTube, Instagram, and Facebook. TikTok is built and gated — activates once API
approval comes through. Manual copy-paste always available for all platforms.

Target audience: Pakistan (primary) + global (secondary)
Content niches: Travel · Hotels · Car drives · Bike rides · Coding · Lifestyle (no face)

---

## Stack

| Layer        | Choice                                      |
|---|---|
| Frontend     | React 19 + Vite + TypeScript                |
| Styling      | Tailwind CSS only                           |
| Video engine | ffmpeg.wasm + TensorFlow.js + Web Audio API |
| Backend      | Node.js 22 + Express 5 + TypeScript         |
| Database     | PostgreSQL 17 + Drizzle ORM                 |
| AI           | Claude / Gemini / OpenAI (user key)         |
| Auto-upload  | YouTube Data API v3 + Meta Graph API        |
| Hosting      | VPS (Hetzner 1GB ~$4/mo)                   |

Video analysis runs in the browser (free, zero API cost).
Backend handles DB, OAuth tokens, post history, and learning loops.

---

## Screens (4 total)

### Screen 1 — Generator

- Video upload (drag & drop or click) — MP4, MOV, max 500MB
- Optional description textarea (2 lines)
- Button: Analyse & Generate
- Output Section A: Virality Score + Checklist + Gap Analysis + Suggestions
- Output Section B: 5 platform cards — auto-upload buttons + manual copy fallback

### Screen 2 — Post History

- List of all past generated posts (newest first)
- Per post: platform icons, niche tag, virality score, predicted range, date posted
- Log Actual Views button per post per platform (input field → save)
- Accuracy indicator: predicted vs actual (overperformed / matched / underperformed)
- Filter by: platform / niche / date range
- Delete post

### Screen 3 — Learning Insights

- Top 5 performing hooks (by actual views logged)
- Top 10 performing hashtags per niche
- Score accuracy over time (predicted vs actual chart — simple bar)
- Best posting times per platform (learned from your actual data)
- Niche performance breakdown (which content type gets most views)
- All driven from your own logged data — zero AI cost

### Screen 4 — Settings

- AI Provider: Claude / Gemini / OpenAI (radio)
- AI API Key (saved to DB, encrypted)
- Default niche (pre-fills context for every generation)
- Timezone: PKT (UTC+5, fixed)
- Platform toggles: YouTube / Instagram / Facebook / TikTok / X (on/off)
- OAuth connect: Google (YouTube) + Meta (Instagram + Facebook)
- TikTok credentials: input field — greyed out, label "Pending API approval"

---

## Video Analysis Engine (Free, In-Browser)

Zero API cost. Runs before AI is called. All signals extracted here become context
for AI copy generation and checklist validation.

### Tools

| Tool            | Detects                                       |
|---|---|
| ffmpeg.wasm     | Duration, resolution, fps, bitrate, audio presence, scene count |
| TensorFlow.js   | Face detection, motion score, scene labels, object detection |
| Web Audio API   | Audio energy, beat presence, silence gaps, audio consistency |
| Canvas API      | Average luma (brightness score)               |

### Signals Extracted

- Duration (seconds)
- Aspect ratio (width:height)
- Resolution (width x height)
- Scene change count + timestamps
- First 3s: scene change detected (yes/no)
- First 3s: motion score (0–100)
- Face detected (yes/no) + frame timestamps
- Detected objects / scene labels (e.g. road, mountain, city, laptop, motorbike)
- Audio present (yes/no)
- Audio energy score (0–100)
- Beat detected (yes/no)
- Silence gap max duration (seconds)
- Brightness (luma) score (0–100)

---

## Virality Score (0–100)

Computed entirely from engine signals. No AI involved.

### Formula

| Signal                            | Weight |
|---|---|
| Hook strength (scene change / motion in first 3s) | 25% |
| Pacing (scene cuts per minute)    | 20%  |
| Face presence                     | 15%  |
| Audio energy + consistency        | 15%  |
| Duration fit (platform optimal)   | 10%  |
| Aspect ratio 9:16                 | 10%  |
| Brightness score >60              | 5%   |

Score shown as 0–100 with colour coding:
- 0–39: red
- 40–59: amber
- 60–79: green
- 80–100: bright green

Score shown once overall AND per platform (weighted differently per algorithm).

### Expected Views Range (per platform, per score tier)

| Score  | YouTube Shorts | Instagram Reels | TikTok    | Facebook Reels |
|---|---|---|---|---|
| 80–100 | 10K–100K       | 15K–200K        | 50K–500K  | 5K–50K         |
| 60–79  | 2K–10K         | 3K–15K          | 5K–50K    | 1K–5K          |
| 40–59  | 500–2K         | 500–3K          | 1K–5K     | 200–1K         |
| 0–39   | <500           | <500            | <1K       | <200           |

Shown as estimate only — labelled "estimated based on video signals."

---

## Checklist (Pass/Fail — Engine + Metadata)

Shown after analysis. Every fail shows exact fix tied to this specific video.

### Section 1 — Video Technical

| Check                              | How Validated          | View Impact  |
|---|---|---|
| Vertical 9:16                      | ffmpeg metadata        | +40% reach   |
| Duration optimal per platform      | ffmpeg duration        | +25% completion |
| Scene change in first 3s           | ffmpeg scene detect    | +30% retention |
| Face in frame                      | TF.js face detection   | +20% CTR     |
| Motion in first 3s                 | TF.js motion score     | +25% scroll stop |
| Audio present and energetic        | Web Audio API          | +20% engagement |
| No silence gap >1.5s               | Web Audio API          | +15% watch time |
| Brightness score >60               | Canvas luma            | +10% appeal  |

### Section 2 — Metadata Quality (validated after AI generation)

| Check                                             | How Validated                        |
|---|---|
| Title contains detected topic keyword             | Engine labels vs AI title            |
| Description mentions detected scene or setting   | Engine scene labels vs description   |
| Tags match detected objects, actions, locations  | TF.js labels vs generated tags       |
| Hashtags mix niche + broad                        | Tag diversity check (count + category) |
| Caption opens with hook (question or bold statement) | First word / punctuation pattern  |
| CTA present in caption or description            | Keyword scan: save, follow, share, comment |
| Hashtag count within platform limit               | Count check per platform rules       |
| No duplicate tags across title + description     | Dedup check                          |

### Section 3 — Virality Boosters

| Check                              | How Validated             | View Impact  |
|---|---|---|
| Multiple scene cuts detected       | ffmpeg scene count        | +20% pacing  |
| Energetic audio beat detected      | Web Audio API             | +15% engagement |
| Caption length optimal per platform | Character count check    | +10% read rate |
| Trending hashtag structure         | Niche + broad mix ratio   | +20% discovery |
| Text overlay detected in video     | TF.js OCR pattern         | +15% retention |

### Pakistan-Specific Checks (niche-aware)

| Niche Detected  | Extra Check                              |
|---|---|
| Travel / outdoor | Scene variety detected (multiple locations) |
| Car / bike       | Motion score high (expected >70)          |
| No face detected | Cover frame quality check (best scenic shot suggested) |
| Coding           | Screen capture detected — readable text?  |

---

## Gap Analysis (Engine-Generated, Zero AI Cost)

Rule-based. Triggered by what failed in checklist. Specific to this video.

```
❌ No scene change in first 3s  → "Cut to your strongest moment within first 2 seconds"
❌ Duration over 60s            → "Trim to under 60s — completion rate drops sharply after"
❌ No face detected             → "Add face-to-camera moment — boosts trust and CTR"
❌ Low audio energy             → "Increase background music or speak louder in first 5s"
❌ Aspect ratio not 9:16        → "Re-export as vertical — horizontal gets suppressed"
❌ Brightness score low         → "Shoot near a window or add brightness in editing"
❌ Long silence gap detected    → "Remove silence gaps over 1.5s — kills watch time"
❌ No beat detected             → "Add background music with a clear beat — improves pacing feel"
❌ Single location detected     → "Mix in b-roll from different angles or locations"
```

---

## AI Copy Generation

Called once after engine analysis. Receives all engine signals as context.
User provides their own API key — no cost to the platform.

### Providers

| Provider | Model           | Video Method                  |
|---|---|---|
| Gemini   | gemini-2.5-flash | Native video upload (best)   |
| Claude   | claude-sonnet-4-5 | Base64 frame extraction      |
| OpenAI   | gpt-4.1          | Base64 frame extraction      |

### How Video Is Sent

Gemini: video → base64 → inline_data with mime_type. One call handles full video.

Claude / OpenAI: video → extract 10 frames via ffmpeg.wasm → base64 image array.
Use `@ffmpeg/ffmpeg` npm package — runs fully in browser.

### Prompt Template — Analysis + Copy (Single Call)

```
You are a viral short-form video strategist. Target audience: Pakistan (primary),
global (secondary). Content niche: travel, hotels, car/bike drives, coding,
lifestyle (no face — scenery focused).

Video engine detected the following signals:
- Duration: {DURATION}s
- Aspect ratio: {RATIO}
- Scene changes: {SCENE_COUNT} (first 3s: {HOOK_SCENE})
- Motion score first 3s: {MOTION_SCORE}/100
- Face detected: {FACE}
- Scene labels / objects: {LABELS}
- Audio energy: {AUDIO_ENERGY}/100
- Beat detected: {BEAT}
- Max silence gap: {SILENCE}s
- Brightness: {BRIGHTNESS}/100
- Virality score: {VIRALITY_SCORE}/100
- Gaps detected: {GAPS}

Optional creator note: {DESCRIPTION}

Generate captions, hashtags, and tags informed by the actual video content above.
Write captions in English with natural Urdu phrases where appropriate (code-switching
performs better with Pakistani audiences). Tone: aspirational, relatable, real.

Return ONLY a JSON object — no markdown, no explanation:

{
  "topic": "",
  "hook_rewrite": "",
  "cover_frame_suggestion": "",
  "improved_script_outline": "",
  "youtube": {
    "title": "",
    "description": "",
    "tags": [],
    "hook": ""
  },
  "instagram": {
    "caption": "",
    "hashtags": [],
    "cover_text": ""
  },
  "tiktok": {
    "hook": "",
    "caption": "",
    "hashtags": []
  },
  "facebook": {
    "caption": "",
    "cta": "",
    "hashtags": []
  },
  "x": {
    "tweet": "",
    "hashtags": [],
    "thread": []
  }
}

Rules:
- YouTube title: 60 chars max, lead with keyword, include location if detected
- Instagram: 25–30 hashtags, mix niche + broad + Pakistan-specific
- TikTok hook: first 3 words must stop the scroll
- Facebook: conversational Urdu/English mix, ends with CTA
- X: 280 chars max, hook in first line, max 2–3 hashtags, thread array only if needed
- No face in video → lead with the strongest scene, not a person
- Use gap data to write copy that compensates for what video lacks
- All copy must feel human — never AI-generated
```

### Hashtag Banks (Injected Into Prompt by Niche)

| Niche Detected | Pakistan Tags | Global Tags |
|---|---|---|
| Travel | #PakistanTravel #VisitPakistan #HiddenPakistan #PKTourism | #Travel #Wanderlust #ExploreMore |
| Hotels | #PakistanHotels #LuxuryPakistan #StayPakistan | #HotelLife #TravelStay |
| Car drives | #PakistanDrives #RoadTripPakistan #CarLifePK | #RoadTrip #DrivingVibes |
| Bike rides | #BikeLifePK #PakistanBikers #MotoVlogPK | #BikeLife #MotoVlog |
| Coding | #CodingPakistan #TechPK #DevLifePK | #Coding #Programming #TechLife |
| Lifestyle | #PakistanLifestyle #PKVibes #DesiLife | #Lifestyle #Aesthetic |

X/Twitter note: max 2–3 hashtags injected — X algorithm penalises hashtag stuffing.

---

## Database Schema

PostgreSQL 17. Drizzle ORM. Single user system — no auth needed.

### Table: posts

```sql
posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche           TEXT,                        -- detected by engine
  duration        INTEGER,                     -- seconds
  aspect_ratio    TEXT,                        -- e.g. "9:16"
  virality_score  INTEGER,                     -- 0-100
  engine_signals  JSONB,                       -- full engine output
  generated_copy  JSONB,                       -- all 5 platform outputs
  hook_text       TEXT,                        -- hook used
  created_at      TIMESTAMPTZ DEFAULT now()
)
```

### Table: platform_posts

```sql
platform_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID REFERENCES posts(id) ON DELETE CASCADE,
  platform        TEXT,                        -- youtube | instagram | facebook | tiktok | x
  caption         TEXT,
  hashtags        TEXT[],
  predicted_min   INTEGER,                     -- expected views lower bound
  predicted_max   INTEGER,                     -- expected views upper bound
  actual_views    INTEGER,                     -- logged by user after posting
  upload_status   TEXT DEFAULT 'pending',      -- pending | posted | failed | manual
  posted_at       TIMESTAMPTZ,
  views_logged_at TIMESTAMPTZ
)
```

### Table: learning_signals

```sql
learning_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche           TEXT,
  platform        TEXT,
  hook_text       TEXT,
  hashtags        TEXT[],
  virality_score  INTEGER,
  actual_views    INTEGER,
  score_accuracy  TEXT,                        -- overperformed | matched | underperformed
  created_at      TIMESTAMPTZ DEFAULT now()
)
```

Populated automatically when user logs actual views. Powers all 3 learning loops.

### Table: settings

```sql
settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_provider     TEXT DEFAULT 'gemini',
  ai_api_key      TEXT,                        -- encrypted at rest
  default_niche   TEXT,
  platform_config JSONB,                       -- toggles + OAuth tokens per platform
  updated_at      TIMESTAMPTZ DEFAULT now()
)
```

---

## Live Learning System (3 Loops)

All learning is triggered when you log actual views on a post.
Zero extra AI cost — purely data-driven.

---

### Loop 1 — Hashtag Learning

```
You log actual views on a post →
system records which hashtags were used + actual views →
per niche, hashtags ranked by average actual views →
top performing hashtags injected into next prompt for same niche →
underperforming hashtags deprioritised
```

Query that runs at prompt build time:
```sql
SELECT hashtag, AVG(actual_views) as avg_views
FROM learning_signals
WHERE niche = $niche AND platform = $platform
GROUP BY hashtag
ORDER BY avg_views DESC
LIMIT 10
```

Top 10 results replace generic hashtag bank for that niche.
Falls back to hardcoded bank if fewer than 5 data points exist.

---

### Loop 2 — Hook Learning

```
You log actual views →
hook_text + actual_views saved to learning_signals →
top 5 hooks per niche ranked by actual views →
injected into prompt as "your past top hooks" →
AI uses these patterns to write future hooks
```

Prompt injection (added to AI prompt automatically):
```
Your past top-performing hooks in this niche (ranked by actual views):
1. "{hook}" → {views} views
2. "{hook}" → {views} views
3. "{hook}" → {views} views

Match the energy, structure, and language of these hooks.
```

---

### Loop 3 — Score Calibration

```
Predicted score: 65 (range 2K–10K) →
actual views logged: 45K (overperformed) →
system checks which signals were present in that post →
those signals get +5% weight boost in score formula →
formula self-corrects over time toward your actual audience
```

Weight adjustment capped at ±15% per signal (prevents overcorrection).
Stored as learned_weights JSONB in settings table.
Resets to baseline if fewer than 10 data points.

Accuracy label shown per post:
- Overperformed: actual > predicted max
- Matched: actual within predicted range
- Underperformed: actual < predicted min

---

### YouTube Shorts
- Title (60 chars max, SEO keyword first)
- Description (150 chars, keyword-rich)
- Tags (10–15 comma-separated)
- Hook suggestion (first line of video)
- Upload button → auto-posts via YouTube Data API v3
- Manual fallback: copy all fields individually

### Instagram Reels
- Caption (storytelling, 150–200 chars, Urdu/English mix)
- Hashtags (25–30, niche + broad + Pakistan)
- Cover text suggestion (3–5 words for thumbnail)
- Upload button → auto-posts via Meta Graph API
- Manual fallback: copy all fields individually

### TikTok
- Hook (first 3 words — scroll stopper)
- Caption (under 150 chars, punchy)
- Hashtags (5–7, trending + niche)
- Upload button → GREYED OUT with label "Available once API approved"
- Manual fallback: copy all fields (always active)

### Facebook Reels
- Conversational caption (Urdu/English, 2–3 sentences)
- CTA (save, share, follow)
- 2–3 broad hashtags
- Upload button → auto-posts via Meta Graph API (same token as Instagram)
- Manual fallback: copy all fields individually

### X / Twitter
- Tweet (280 chars max, punchy, hook in first line)
- 2–3 hashtags only (X penalises hashtag stuffing)
- Thread option (if content needs more than 280 chars)
- Manual only — copy button, no upload API
- Card accent: black + white

---

## Auto-Upload Integrations

### YouTube (Google OAuth 2.0)

Auth flow: Settings → Connect YouTube → Google OAuth popup → token saved to localStorage

Upload call:
1. POST to `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart`
2. Metadata: title, description, tags, categoryId (22 = People & Blogs)
3. Video detected as Short if: vertical + ≤60s + `#Shorts` in title

Scopes needed: `youtube.upload`

### Instagram Reels (Meta Graph API)

Auth flow: Settings → Connect Meta → Facebook Login popup → token saved to localStorage
One Meta login covers both Instagram + Facebook.

Upload flow (two steps):
1. POST video to container: `/me/media` with `media_type=REELS`, `video_url`, `caption`
2. Publish container: `/me/media_publish` with `creation_id`

### Facebook Reels (Meta Graph API)

Same Meta token as Instagram.

Upload flow:
1. POST to `/{page-id}/video_reels` with `upload_phase=start`
2. Upload video bytes
3. Publish: `upload_phase=finish` with `description`, `title`

### TikTok (Built — Gated)

Auth: TikTok OAuth 2.0 — input available in settings, greyed out.
Upload: Content Posting API — code written, hidden behind `isTikTokApproved` flag.
Activation: flip flag in settings once API approval received. No other changes needed.

---

## Peak Posting Times (PKT, UTC+5)

Hardcoded in scheduler. BullMQ queues the upload at optimal time after user confirms.

```
YouTube Shorts:  Fri/Sat/Sun — 6pm, 8pm PKT
Instagram Reels: Mon/Wed/Fri — 7pm, 9pm PKT
TikTok:          Tue/Thu/Fri — 8pm, 10pm PKT
Facebook Reels:  Wed/Thu     — 8pm, 10pm PKT
```

User can override time manually per post.

---

## File Structure

```
/frontend
  /src
    /components
      VideoUpload.tsx
      ViralityScore.tsx        (score card + expected views)
      Checklist.tsx            (pass/fail per item + fix)
      GapList.tsx              (gap analysis list)
      SuggestionPanel.tsx      (hook rewrite + improved script)
      PlatformCard.tsx         (copy + upload button)
      CopyButton.tsx
      PostHistoryItem.tsx      (single post row)
      ActualViewsInput.tsx     (log views input per platform)
      LearningInsightCard.tsx  (top hooks / hashtags / accuracy)
    /pages
      Generator.tsx
      PostHistory.tsx
      LearningInsights.tsx
      Settings.tsx
    /lib
      engine.ts                (orchestrates ffmpeg + TF.js + Web Audio)
      video.ts                 (ffmpeg.wasm — frame extract + metadata)
      motion.ts                (TF.js — face, motion, scene labels)
      audio.ts                 (Web Audio API — energy, beat, silence)
      score.ts                 (virality score formula + learned weights)
      checklist.ts             (all pass/fail rules)
      gaps.ts                  (rule-based gap messages)
      prompt.ts                (prompt builder + learning injection + JSON parser)
      ai.ts                    (Claude / Gemini / OpenAI call handler)
      api.ts                   (all calls to backend API)
      hashtags.ts              (niche hashtag banks + learned overrides)
      schedule.ts              (peak time calculator per platform)
    App.tsx
    main.tsx

/backend
  /src
    /routes
      posts.ts                 (create, list, delete posts)
      platformPosts.ts         (log actual views, update status)
      learning.ts              (top hooks, hashtags, score weights)
      settings.ts              (get/update settings, OAuth tokens)
      upload.ts                (YouTube + Meta upload proxy)
    /db
      schema.ts                (Drizzle schema — all 4 tables)
      index.ts                 (DB connection + pool)
      migrations/              (Drizzle migration files)
    /lib
      learning.ts              (all 3 loop calculations)
      encryption.ts            (API key encrypt/decrypt)
      oauth.ts                 (Google + Meta token refresh)
    index.ts                   (Express app entry)
```

---

## Build Order (follow exactly, one step at a time)

### Phase 1 — Backend + DB
1. Node.js + Express + TypeScript backend setup
2. PostgreSQL connection + Drizzle ORM setup
3. DB schema + first migration (all 4 tables)
4. Settings routes (get/update AI key, platform config)
5. Posts routes (create, list, delete)
6. Platform posts routes (log actual views, update status)
7. Learning routes (top hooks, hashtags, score weights)
8. Encryption util for API key storage
9. Google OAuth token refresh handler
10. Meta OAuth token refresh handler

### Phase 2 — Frontend Core
11. Vite + React + TypeScript + Tailwind setup
12. API client (api.ts — all backend calls)
13. Settings screen — provider, API key, OAuth connect, platform toggles
14. Google OAuth flow — YouTube connect
15. Meta OAuth flow — Instagram + Facebook connect

### Phase 3 — Video Engine
16. Video upload component — drag & drop, thumbnail preview
17. ffmpeg.wasm — metadata + frame extraction + scene detect
18. TensorFlow.js — face, motion, scene labels
19. Web Audio API — energy, beat, silence
20. Engine orchestrator — runs all 3 in parallel

### Phase 4 — Scoring + Checklist
21. Virality score formula + learned weights from DB
22. Checklist rules + gap messages
23. Hashtag bank + niche detection + learned overrides from DB

### Phase 5 — AI Generation
24. Prompt builder — injects engine data + learning signals
25. AI call handler — Gemini native + Claude/OpenAI frame path
26. Metadata checklist re-run after AI output

### Phase 6 — Upload + Scheduling
27. YouTube upload handler
28. Meta (Instagram + Facebook) upload handler
29. TikTok upload handler — gated behind isTikTokApproved flag
30. Peak time scheduler

### Phase 7 — History + Learning UI
31. Post history screen — list, filter, delete
32. Log actual views input per platform per post
33. Learning insights screen — hooks, hashtags, accuracy, niche breakdown

### Phase 8 — Polish
34. Generator screen — full UI wiring
35. Loading states, two-phase progress, error handling, mobile layout

---

## UI Notes

- No routing library — useState screen switching only
- No UI component library — Tailwind only
- Mobile-first layout — used on phone
- Two-phase loading indicator:
  "Analysing video..." (engine running)
  "Generating copy..." (AI running)
- Score card colours: red (0–39) / amber (40–59) / green (60–79) / bright green (80–100)
- Platform card colour accents:
  YouTube: red
  Instagram: pink/purple
  TikTok: black + cyan (greyed upload button until approved)
  Facebook: blue
  X: black + white (copy only, no upload button)
- Each platform card: copy button + upload button side by side
- Upload button states: Idle / Uploading / Posted / Failed
- Manual copy always available regardless of upload status
- "Get Better Version" button: appears after first analysis, re-runs AI with
  improved_script_outline as additional context

---

## Cost

| Item                    | Cost              |
|---|---|
| VPS (Hetzner 1GB)       | ~$4/mo            |
| PostgreSQL (on VPS)     | Free              |
| AI API                  | User's own key    |
| YouTube API             | Free              |
| Meta Graph API          | Free              |
| TikTok API              | Free (once approved) |
| X/Twitter API           | Not used (manual) |
| **Total**               | **~$4/mo**        |
