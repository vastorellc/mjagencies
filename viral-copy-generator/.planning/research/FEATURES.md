# Features Research
# Viral Copy Generator — Feature Landscape

**Domain:** Personal short-form video copy generator + multi-platform auto-upload
**Researched:** 2026-04-30
**Confidence:** HIGH (spec-grounded + competitive landscape verified)

---

## Table Stakes (must have — absent means users abandon immediately)

These are features that competing tools (OpusClip, VidIQ, Metricool, Buffer, CapCut) all have,
or that users expect by default from any tool in this category.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Platform-specific copy output | Every tool generates separate copy per platform; same caption everywhere is amateur | Low | Spec covers all 5: YouTube, Instagram, TikTok, Facebook, X |
| One-click copy button | Users won't tolerate selecting text manually; all caption tools have this | Low | Per-field copy (title, description, hashtags separately) |
| Platform-aware hashtag counts | IG wants 25–30, X wants 2–3, TikTok 5–7 — wrong counts hurt reach | Low | Baked into AI prompt rules in spec |
| Character limit enforcement | YouTube title 60 chars, X 280 — exceeding limits breaks uploads or looks unprofessional | Low | Spec has this per platform |
| Upload status feedback | Users need to know if auto-upload succeeded or failed; silent failures destroy trust | Low | Spec has: Idle / Uploading / Posted / Failed states |
| Manual copy fallback | Auto-upload APIs break regularly; users need an escape hatch always | Low | Spec has this as always-active fallback |
| Loading state during analysis | ffmpeg.wasm + TF.js takes time; blank screen = user thinks it crashed | Low | Spec has two-phase indicator |
| Mobile-first layout | Short-form creators work from phones; desktop-only is unusable for this audience | Medium | Spec explicitly mobile-first |
| Settings persistence | Users don't want to re-enter API key and OAuth tokens on every session | Low | Spec stores in DB + encrypted |
| Platform OAuth connect | Users expect "Connect YouTube" not manual token entry | Medium | Spec covers Google + Meta OAuth |
| Error messaging that explains what went wrong | Generic "upload failed" = rage quit; tools that explain errors retain users | Low | Not explicitly in spec — needs real error messages, not codes |
| Post history | Every scheduling tool has history; without it users have no record of what they posted | Low | Spec has Screen 2 |

---

## Differentiators (competitive advantage — what makes this better than existing tools)

These are features that competing tools do poorly, do generically, or do not do at all.
Each one directly addresses a documented gap in the competitive landscape.

### D1 — In-Browser Video Analysis (Zero API Cost)
**What:** ffmpeg.wasm + TF.js runs video analysis entirely client-side. No video uploaded to third-party
servers. No per-video API cost.
**Gap it fills:** OpusClip, VidIQ, and every SaaS tool in this space bill per video or per minute of
processing. CapCut moved auto-captions behind paywall in 2025. This tool's analysis costs nothing.
**Complexity:** High (ffmpeg.wasm + TF.js integration is non-trivial in browser)
**Competitive evidence:** OpusClip users consistently complain about billing surprises and quota overages.
CapCut users report burning through free caption quota in days.

### D2 — Virality Score Grounded in Actual Video Signals
**What:** Score computed from real frame-level signals (motion, scene cuts, audio energy, brightness) —
not from engagement history or generic "AI analysis."
**Gap it fills:** OpusClip's Virality Score uses a 0–99 scale but relies on opaque "thousands of data
points" with no technical validation. Users report low-scoring clips outperforming high-scoring ones.
The spec's formula is transparent, auditable, and specific to what was detected in this video.
**Complexity:** Medium (formula is defined; signals come from engine)
**Competitive evidence:** OpusClip's own documentation warns "treat it as a heuristic, not a guarantee."
The spec's formula is deterministic and explainable — each score component maps to a specific fix.

### D3 — Gap Analysis with Specific, Actionable Fixes Per Video
**What:** Every failed checklist item generates a fix message tied to what was detected in this specific
video, not generic advice.
**Gap it fills:** VidIQ and TubeBuddy give generic SEO tips ("use keywords in title") that apply to every
video. The spec generates "Cut to your strongest moment within first 2 seconds" based on detecting no
scene change in the first 3s of this particular video.
**Complexity:** Low (rule-based, driven by engine output)
**Competitive evidence:** VidIQ users report the tool gives the same suggestions regardless of video content.
TubeBuddy users report feature overload with unclear prioritisation.

### D4 — Learning Loops Calibrated to Your Own Data
**What:** Three feedback loops (hashtag performance, hook performance, score calibration) that update
based on actual views you log. The tool gets smarter for your channel, your niche, your audience.
**Gap it fills:** Every hashtag tool (Sprout Social, Later, RiteTag) suggests hashtags based on
general popularity, not on which hashtags drove views for your specific content. Sprinkler and
Brand24 require team-tier pricing. No tool in this category learns from a creator's own view data.
**Complexity:** Medium (SQL aggregation + prompt injection at generation time)
**Competitive evidence:** Hashtag research tools "are best as a starting point, not a complete strategy
tool" (multiple sources). Creator-specific learning from actual view data is an unaddressed gap.

### D5 — Pakistan-Aware Copy (Code-Switching, Niche Hashtag Banks)
**What:** AI prompt explicitly targets Pakistani audience with Urdu/English code-switching, Pakistan-
specific hashtag banks (#PakistanTravel, #BikeLifePK, etc.), and niche-aware context for content
that performs in Pakistan.
**Gap it fills:** Every major tool is US/EU-centric. No existing tool has Pakistan-specific hashtag
banks, code-switching instructions, or PKT-optimised posting times.
**Complexity:** Low (prompt engineering + hardcoded hashtag banks)
**Competitive evidence:** 85M+ active Pakistani social media users, fast-growing creator economy, FBR
tax framework for influencers — significant and underserved market.

### D6 — Predicted vs Actual View Accuracy Tracking
**What:** Each post stores a predicted view range. User logs actual views. Tool shows overperformed /
matched / underperformed and tracks score accuracy over time.
**Gap it fills:** No tool in this space closes the feedback loop between prediction and reality for an
individual creator's content. This is unique — tools either show analytics (past) or predictions
(future) but not a comparison that improves future predictions.
**Complexity:** Low (DB comparison + label logic)
**Competitive evidence:** OpusClip, VidIQ, and TubeBuddy do not have this feature. Buffer and Metricool
show post-performance analytics but do not connect them back to pre-publish predictions.

### D7 — BYO API Key (Zero Platform Subscription Cost)
**What:** User supplies their own Claude/Gemini/OpenAI key. Platform costs $4/mo flat (VPS only).
**Gap it fills:** OpusClip Pro is $19–$29/mo. Metricool Starter is $22/mo. Buffer Essentials is
$6/channel/mo. VidIQ Boost is $49/mo. For a solo Pakistani creator, these prices are prohibitive.
**Complexity:** Low (key encryption + provider switcher)
**Competitive evidence:** Creator economy in Pakistan is cost-sensitive; USD pricing at SaaS rates is
a real adoption barrier.

### D8 — Scheduled Upload at Optimal PKT Times
**What:** BullMQ queues the upload at the PKT-optimal time slot (e.g. Fri/Sat/Sun 6pm–8pm for YouTube
Shorts) rather than posting immediately.
**Gap it fills:** Metricool and Buffer have scheduling but do not have Pakistan-timezone-aware peak
times. Hardcoded PKT slots derived from platform algorithm research are an instant value-add.
**Complexity:** Medium (BullMQ scheduling + OAuth token refresh at trigger time)
**Competitive evidence:** Instagram Reels algorithm heavily weights shares and saves in first hour; posting
at peak PKT time significantly impacts initial distribution.

### D9 — "Get Better Version" Re-Generation
**What:** After first generation, user can request a second pass using the improved_script_outline
from the first response as additional context.
**Gap it fills:** Every AI copy tool generates once. If the output is mediocre, users start over from
scratch or manually edit. A structured re-generation using the tool's own analysis as input is not
offered by any competitor.
**Complexity:** Low (pass improved_script_outline back into prompt builder)

---

## Anti-Features (do NOT build — complexity traps that kill personal tools)

These are features that seem useful but introduce complexity disproportionate to the value for a
solo personal tool. All are documented failure modes from studying what makes SaaS tools in this
space bloated and unreliable.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-user / team accounts | Requires auth system, per-user data isolation, billing. This is a personal tool. Adding multi-user mid-build is a rewrite. | Single-user system with no auth, as spec defines |
| Content calendar / editorial planner | Buffer, Later, Metricool all have this. It's a 6-week build on its own. Adds zero value to a tool whose job is to generate copy for a video you just filmed. | Post history + scheduled upload covers the need |
| Competitor tracking / benchmarking | VidIQ's most complex feature. Requires third-party data, platform rate limits, significant API costs. Not relevant to solo creator. | The learning loops use your own data — more actionable than competitor data |
| Social inbox / comment management | Hootsuite's core feature. Requires persistent platform webhooks, message storage, notification system. Entirely out of scope. | Out of scope — not a CRM |
| Analytics dashboards with engagement rate, reach, impressions | Requires platform API read permissions, not just write. Meta's read permissions require Business Verification. Adds 2–3 weeks of integration work. | Log actual views manually — simpler, more honest, no permission overhead |
| AI thumbnail generator | Separate model, separate API cost, separate UI. CapCut and Canva do this. The spec has cover_frame_suggestion (text) which is sufficient. | Text suggestion for best cover frame is the right scope |
| Auto-caption / subtitle burn-in | CapCut does this. Requires video re-encoding in browser (heavy) or server-side (cost). Not part of copy generation flow. | Out of scope — this tool generates copy, not edited video |
| Built-in video editor | CapCut, DaVinci territory. Requires a 12+ month build. | User edits in their preferred tool; this tool handles the metadata/copy layer |
| Trend discovery / trending sounds | Requires TikTok/Instagram read API access, real-time data pipelines, significant ongoing maintenance. TikTok sound trends change hourly. | Hardcoded hashtag banks updated manually when niche shifts |
| Push notifications / mobile app | React web app is sufficient. Native app adds App Store review process, push notification infrastructure, platform-specific builds. | Mobile-first web layout is adequate |
| A/B testing titles/thumbnails | TubeBuddy's signature feature. Requires posting multiple variants, traffic split, statistical significance tracking. 8-week build minimum. | Learning loops with actual view logging covers the intent more simply |
| Affiliate / referral system | SaaS billing feature. This is a $4/mo personal tool. | Not applicable |
| Webhook integrations / Zapier | Generic automation layer. Adds API surface area without clear personal-tool benefit. | Direct auto-upload is simpler and more reliable |

---

## Complexity Notes

| Feature | Estimated Complexity | Risk |
|---------|---------------------|------|
| In-browser ffmpeg.wasm + TF.js analysis | HIGH | SharedArrayBuffer requires COOP/COEP headers; large WASM bundle (50–60MB); mobile browser memory limits; TF.js model download latency |
| YouTube Data API v3 upload | MEDIUM | Daily quota (10,000 units/day default) resets unpredictably; OAuth token refresh required; video processing delay after upload means "posted" confirmation is async |
| Meta Graph API Reels upload | HIGH | Requires Facebook Business Verification for full API access; two-step upload (container + publish); Instagram only works with Business/Creator accounts, not personal; 100 API posts per 24h limit |
| TikTok Content Posting API | HIGH (gated) | Requires TikTok for Developers approval; spec correctly gates this behind a flag |
| BullMQ scheduled upload | MEDIUM | OAuth tokens may expire between schedule and trigger time; token refresh logic must run at trigger, not at schedule time |
| Learning loop — score calibration | MEDIUM | Weight adjustment capped at ±15% prevents runaway calibration; needs minimum 10 data points before weights activate to avoid noise |
| Gemini native video upload | LOW-MEDIUM | base64 inline_data is the correct approach; file size limits apply (spec handles this) |
| Claude/OpenAI frame extraction | MEDIUM | 10 frames via ffmpeg.wasm adds ~2–5s to analysis time; frame quality and selection matters for AI accuracy |
| Encrypted API key storage | LOW | AES-256 or similar; must use server-side encryption, never store plaintext |
| PKT timezone handling | LOW | Fixed UTC+5, no DST; simple offset arithmetic |

---

## Dependencies Between Features

```
Video upload
  → ffmpeg.wasm metadata extract           (requires COOP/COEP headers, SharedArrayBuffer)
  → TF.js scene / face / motion analysis   (requires ffmpeg frames as input)
  → Web Audio analysis                     (runs in parallel with TF.js)
  ↓
Engine output (all signals)
  → Virality score formula                 (requires all signals)
  → Checklist pass/fail                    (requires signals + later: generated copy for metadata checks)
  → Gap analysis messages                  (requires checklist results)
  → Prompt builder                         (requires signals + gap list + learned hashtags + learned hooks)
  ↓
AI generation (single call)
  → Platform copy output (all 5 cards)
  → Metadata checklist re-run              (requires AI output + engine signals)
  ↓
Post saved to DB                           (requires generation complete)
  → Auto-upload buttons activate           (requires post saved + OAuth connected)
  → Scheduled upload via BullMQ            (requires post saved + OAuth token valid at trigger time)
  ↓
User logs actual views
  → learning_signals record created        (requires actual_views logged)
  → Loop 1: hashtag ranking updated        (requires 5+ data points for niche)
  → Loop 2: hook ranking updated           (requires 5+ data points for niche)
  → Loop 3: score weight calibration       (requires 10+ data points)
  → Next generation: loops 1+2+3 inject    (all 3 loops feed prompt builder and score formula)

Settings (independent path):
  OAuth connect (Google / Meta)
    → enables auto-upload buttons on platform cards
    → enables scheduled upload
  AI provider + API key
    → enables AI generation call
  Platform toggles
    → shows/hides platform cards on generator
  Default niche
    → pre-fills niche context in prompt builder

TikTok dependency:
  → isTikTokApproved flag in settings
  → gates upload button (greyed) and activates OAuth input
  → all TikTok copy generation is always active (manual copy never gated)
```

---

## MVP Feature Priority (first working version)

**Phase 1 (core loop — must work before anything else):**
1. Video upload → engine analysis → virality score + checklist + gap analysis
2. AI copy generation for all 5 platforms
3. Copy buttons (manual fallback)
4. Post saved to DB

**Phase 2 (upload value):**
5. YouTube auto-upload (most reliable API, lowest approval barrier)
6. Meta auto-upload (Instagram + Facebook, same token)
7. Settings screen with OAuth connect + API key

**Phase 3 (retention loop):**
8. Post history with filter
9. Log actual views
10. Learning insights (hooks, hashtags, accuracy chart)
11. Learning loops injected into generation

**Defer to post-MVP:**
- Score calibration loop (needs 10+ data points before it's useful — won't activate on day 1)
- TikTok upload (blocked on API approval — code ready, flag off)
- Scheduled upload (good-to-have; manual immediate upload covers day-1 need)
- "Get Better Version" button (nice DX improvement, not blocking)

---

## Sources

- OpusClip Virality Score documentation: https://help.opus.pro/docs/article/virality-score
- OpusClip user reviews (Trustpilot/G2 aggregated): https://www.eesel.ai/blog/opusclip-reviews
- CapCut auto-captions paywall: https://www.descript.com/blog/article/capcut-captions-arent-free-anymore-heres-a-better-option
- Instagram Reels algorithm 2025 (watch time, saves, shares): https://buffer.com/resources/instagram-algorithms/
- Meta Graph API Reels publish docs: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Instagram Graph API business account requirement: https://www.getphyllo.com/post/a-complete-guide-to-the-instagram-reels-api
- YouTube Shorts API upload: https://www.ayrshare.com/post-youtube-shorts-with-an-api/
- Pakistan social media: 85M+ users, creator economy growth: https://www.euroshub.com/blogs/social-media-marketing-in-pakistan
- Hashtag analytics gaps (creator-specific needs unmet): https://insights.vaizle.com/hashtag-analytics/
- VidIQ vs TubeBuddy user experience (interface overload): https://linodash.com/vidiq-vs-tubebuddy/
- Metricool vs Buffer feature comparison: https://metricool.com/metricool-vs-buffer/
- Short-form video first-3-second retention data: https://www.creativeclick.in/the-science-behind-viral-reels-algorithms-hooks-watch-time-psychology/
