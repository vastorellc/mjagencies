# Requirements — Viral Copy Generator

**v1 scope:** Full tool — upload, analysis, AI copy generation, auto-upload, scheduling, history, learning loops.
**Single user, no auth. Personal tool.**

---

## v1 Requirements

### UPLOAD — Video Upload

- [ ] **UPLOAD-01**: User can upload a video via drag-and-drop or file picker (MP4, MOV, max 250 MB hard cap with warning at 200 MB)
- [ ] **UPLOAD-02**: User sees a thumbnail preview and video metadata (duration, resolution, aspect ratio) after selecting a file
- [ ] **UPLOAD-03**: User can provide an optional description (2-line textarea) before analysis

### ANALYSIS — In-Browser Video Analysis Engine

- [ ] **ANALYSIS-01**: System extracts video metadata (duration, resolution, fps, bitrate, audio presence, scene count) via ffmpeg.wasm running entirely in-browser
- [ ] **ANALYSIS-02**: System extracts 10 representative frames for AI providers that require frame-based input (Claude, OpenAI)
- [ ] **ANALYSIS-03**: System detects scene changes and timestamps via ffmpeg scene detection
- [ ] **ANALYSIS-04**: System detects face presence, motion score, and scene labels/objects via TensorFlow.js (COCO-SSD for objects, @tensorflow-models/face-detection for faces)
- [ ] **ANALYSIS-05**: System measures audio energy, beat presence, and silence gaps via Web Audio API
- [ ] **ANALYSIS-06**: System measures brightness (luma score) via Canvas API
- [ ] **ANALYSIS-07**: All analysis runs in-browser — no video file sent to any server during analysis phase
- [ ] **ANALYSIS-08**: User sees a two-phase loading indicator: "Analysing video..." then "Generating copy..."
- [ ] **ANALYSIS-09**: System gracefully degrades on iOS Safari (detects missing SharedArrayBuffer, shows clear message, falls back to manual description input)

### SCORE — Virality Scoring, Checklist, Gap Analysis

- [ ] **SCORE-01**: System computes a virality score (0–100) from engine signals using the weighted formula (hook 25%, pacing 20%, face 15%, audio 15%, duration fit 10%, aspect ratio 10%, brightness 5%)
- [ ] **SCORE-02**: Score is shown with colour coding: red (0–39), amber (40–59), green (60–79), bright green (80–100)
- [ ] **SCORE-03**: Score is computed overall AND per platform (platform-weighted variants)
- [ ] **SCORE-04**: System shows expected view range per platform per score tier (e.g. 60–79 score → YouTube 2K–10K)
- [ ] **SCORE-05**: System shows a pass/fail checklist (Video Technical + Metadata Quality + Virality Boosters + Pakistan-specific niche checks)
- [ ] **SCORE-06**: Every failed checklist item shows a specific actionable fix for this video (not generic advice)
- [ ] **SCORE-07**: System generates a gap analysis list (rule-based, zero AI cost) triggered by checklist failures

### AI — AI Copy Generation

- [ ] **AI-01**: User can select AI provider in settings (Claude claude-sonnet-4-5 / Gemini gemini-2.5-flash / OpenAI gpt-4.1)
- [ ] **AI-02**: System generates a single AI call per analysis that returns JSON with all 5 platform outputs (YouTube, Instagram, TikTok, Facebook, X)
- [ ] **AI-03**: Gemini sends video natively via Files API for videos over 70 MB; inline base64 for smaller videos
- [ ] **AI-04**: Claude and OpenAI receive 10 extracted frames as base64 image array
- [ ] **AI-05**: AI prompt injects all engine signals, gap data, niche hashtag bank, and learning data (top hooks + top hashtags from post history) as context
- [ ] **AI-06**: AI copy uses English with natural Urdu code-switching for Pakistani audience resonance
- [ ] **AI-07**: System strips markdown code fences and handles malformed JSON responses gracefully (never blank platform cards)
- [ ] **AI-08**: User can request a "Get Better Version" second pass using the improved_script_outline from the first response as additional context

### PLATFORM — Platform Cards and Output

- [ ] **PLATFORM-01**: Generator screen shows 5 platform cards: YouTube Shorts, Instagram Reels, TikTok, Facebook Reels, X/Twitter
- [ ] **PLATFORM-02**: Each card shows platform-specific copy fields with character counts and platform limits enforced
- [ ] **PLATFORM-03**: Each field has a one-click copy button — title, description, tags/hashtags copyable individually
- [ ] **PLATFORM-04**: YouTube card: title (60 chars), description (150 chars), tags (10–15), hook suggestion, upload button, manual copy fallback
- [ ] **PLATFORM-05**: Instagram card: caption (150–200 chars, Urdu/English mix), hashtags (25–30), cover text suggestion, upload button, manual copy fallback
- [ ] **PLATFORM-06**: TikTok card: hook (first 3 words), caption (under 150 chars), hashtags (5–7), upload button greyed out with label "Available once API approved", manual copy always active
- [ ] **PLATFORM-07**: Facebook card: caption (Urdu/English, 2–3 sentences), CTA, 2–3 hashtags, upload button, manual copy fallback
- [ ] **PLATFORM-08**: X card: tweet (280 chars max), 2–3 hashtags, thread option, copy only — no upload button (card accent: black + white)
- [ ] **PLATFORM-09**: Upload button has 4 states per platform: Idle / Uploading / Posted / Failed — with clear error messages
- [ ] **PLATFORM-10**: Manual copy is always available regardless of upload state or OAuth connection status

### SETTINGS — Configuration and Integrations

- [ ] **SETTINGS-01**: User can select AI provider (Claude / Gemini / OpenAI) and save their API key (stored encrypted AES-256-GCM in DB)
- [ ] **SETTINGS-02**: User can set a default niche (pre-fills generation context for every analysis)
- [ ] **SETTINGS-03**: User can toggle platforms on/off (YouTube / Instagram / Facebook / TikTok / X)
- [ ] **SETTINGS-04**: User can connect YouTube via Google OAuth 2.0 — full server-side OAuth flow, tokens stored backend-only (never localStorage)
- [ ] **SETTINGS-05**: User can connect Instagram + Facebook via Meta OAuth — single login covers both platforms
- [ ] **SETTINGS-06**: TikTok credentials input exists but is greyed out with label "Pending API approval"
- [ ] **SETTINGS-07**: User can disconnect any connected platform (revoke token, clear from DB)
- [ ] **SETTINGS-08**: Timezone is fixed to PKT (UTC+5) — no user configuration needed

### UPLOAD-AUTO — Auto-Upload and Scheduling

- [ ] **AUTOUP-01**: YouTube upload uses resumable protocol (googleapis videos.insert with readable stream) — never multipart (5 MB limit)
- [ ] **AUTOUP-02**: Instagram Reels upload follows two-step Meta flow: create container → poll status until FINISHED → publish (poll every 5s, max 5 min, never publish on IN_PROGRESS)
- [ ] **AUTOUP-03**: Facebook Reels upload uses same Meta token as Instagram
- [ ] **AUTOUP-04**: TikTok upload code is built but hidden behind `isTikTokApproved` flag — activatable without re-deploy
- [ ] **AUTOUP-05**: Backend serves video file from `/tmp` with a public URL for Meta's video fetch requirement, then cleans up after `media_publish`
- [ ] **AUTOUP-06**: User can schedule upload at PKT peak times (hardcoded optimal windows per platform) or override with a manual time
- [ ] **AUTOUP-07**: Peak times: YouTube Fri/Sat/Sun 6pm+8pm PKT · Instagram Mon/Wed/Fri 7pm+9pm PKT · TikTok Tue/Thu/Fri 8pm+10pm PKT · Facebook Wed/Thu 8pm+10pm PKT
- [ ] **AUTOUP-08**: Backend queues scheduled uploads via BullMQ — returns 200 immediately, upload fires at scheduled time

### HISTORY — Post History

- [ ] **HISTORY-01**: Post History screen lists all past generated posts, newest first
- [ ] **HISTORY-02**: Each post row shows: platform icons, niche tag, virality score, predicted view range, date posted
- [ ] **HISTORY-03**: User can filter post history by platform, niche, and date range
- [ ] **HISTORY-04**: User can log actual views per platform per post via an inline input field
- [ ] **HISTORY-05**: Each post shows accuracy indicator once views are logged: Overperformed / Matched / Underperformed vs. predicted range
- [ ] **HISTORY-06**: User can delete a post (cascades to platform_posts and removes from learning_signals)

### LEARNING — Learning Insights and Feedback Loops

- [ ] **LEARNING-01**: Learning Insights screen shows top 5 performing hooks by actual views per niche
- [ ] **LEARNING-02**: Learning Insights screen shows top 10 performing hashtags per niche per platform
- [ ] **LEARNING-03**: Learning Insights screen shows score accuracy over time as a simple bar chart (predicted vs actual)
- [ ] **LEARNING-04**: Learning Insights screen shows best posting times per platform (learned from user's actual logged data)
- [ ] **LEARNING-05**: Learning Insights screen shows niche performance breakdown (which content type gets most views)
- [ ] **LEARNING-06**: System injects top-performing hooks and hashtags from user's own data into the AI prompt for same niche (falls back to hardcoded bank if fewer than 5 data points)
- [ ] **LEARNING-07**: Virality score formula self-calibrates based on logged views — signals that overperformed get weight boost (±5% per signal, capped at ±15%), resets to baseline if fewer than 10 data points
- [ ] **LEARNING-08**: All learning calculations run on logging actual views — no extra AI calls, purely SQL aggregation

### UI — Interface and UX

- [ ] **UI-01**: No routing library — useState screen switching between 4 screens
- [ ] **UI-02**: No UI component library — Tailwind CSS only, mobile-first layout
- [ ] **UI-03**: Platform card colour accents: YouTube red · Instagram pink/purple · TikTok black+cyan · Facebook blue · X black+white
- [ ] **UI-04**: Score colour coding: red (0–39) · amber (40–59) · green (60–79) · bright green (80–100)
- [ ] **UI-05**: App is usable on mobile phone (primary use case)

---

## v2 Requirements (deferred)

- Multi-provider failover (auto-switch if one AI provider fails or rate-limits)
- Bulk video processing (queue multiple videos)
- X/Twitter auto-upload (if API becomes accessible without high cost)
- Export post history as CSV
- Custom hashtag bank editing UI (currently hardcoded per niche)
- A/B testing copy variants
- Trend discovery / external hashtag research integration

---

## Out of Scope

- Multi-user / authentication — personal tool, single user
- Content calendar / scheduling UI — upload scheduling is sufficient
- Video editing features — use CapCut; this tool is for metadata
- Competitor analytics — out of scope, dedicated tools exist
- Social inbox (read messages/comments) — requires additional platform permissions + Business Verification complexity
- AI thumbnail generation — separate scope
- Auto-caption burn-in — separate video editing scope
- X/Twitter auto-upload v1 — API cost and complexity not justified; manual copy is enough

---

## Traceability

*Filled by roadmapper agent.*

| Phase | Requirements Covered |
|-------|----------------------|
| TBD | TBD |
