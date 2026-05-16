# Phase 12: Cover-Frame Scoring & Recommendation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 12-cover-frame-scoring
**Areas discussed:** Canvas-reuse plumbing, FaceMesh lazy-load + failure handling, Predictor threshold calibration, CoverFramePanel layout + 4-size download UX

---

## Canvas-reuse plumbing through analyse()

### Q1: Where should cover-frame scoring run?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline inside analyse() — score before canvases leave scope | scoreCoverFrames called inside analyse() after detectFacesAcrossFrames; appends coverFrameScores to EngineSignals; no signature change | ✓ |
| Return canvases from analyse(); score in a separate call | EngineSignals gets `canvases` field; CoverFramePanel scores on mount; pins GPU memory, mobile risk | |
| Re-decode from framesBase64 in cover.ts | Zero plumbing change; pays ~50–200ms × 10 frames to re-decode | |

**User's choice:** Inline inside analyse()
**Notes:** Per-frame face results threaded through the same call path.

### Q2: How are per-frame face results plumbed?

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor detectFacesAcrossFrames to return per-frame AND aggregate | `{ faceCount, faceConfidence, perFrame: FaceResult[][] }`; one pass | ✓ |
| Run face detection a second time inside scoreCoverFrames | +300ms wasted; double work | |
| Pre-compute via separate loop in analyse() | Most explicit; adds a third variable to analyse() body | |

**User's choice:** Refactor detectFacesAcrossFrames

---

## FaceMesh lazy-load + failure handling

### Q1: When should @mediapipe/face_mesh load?

| Option | Description | Selected |
|--------|-------------|----------|
| On first analyse() call — alongside face-detection warmup | Added to Promise.allSettled in analyse(); model ready when scoreCoverFrames runs | ✓ |
| On CoverFramePanel mount | Would require re-running eye-contact on panel mount; contradicts Area 1 inline-scoring | |
| On warmup() pre-warm hook | Loads at app idle; wastes bandwidth for users who never analyse | |

**User's choice:** On first analyse() call

### Q2: How does eye-contact predictor degrade if FaceMesh fails to load?

| Option | Description | Selected |
|--------|-------------|----------|
| eyeContact = 0 for every frame; console.warn; continue | Matches engine.ts getFaceDetector null-on-fail pattern; effective 5-predictor max | ✓ |
| Fall back to bbox-centeredness proxy | Different signal; risks confusing users across runs | |
| Block cover panel entirely | Hard fail; inconsistent with Phase 3 graceful-degradation precedent | |

**User's choice:** eyeContact = 0

### Q3: Where is the FaceMesh model hosted?

| Option | Description | Selected |
|--------|-------------|----------|
| jsdelivr CDN with solutionPath | Matches engine.ts face-detection pattern; cached if face-detection already loaded | ✓ |
| Self-host in frontend/public/ | No CDN dep; ~10 MB deploy artifact + Nginx config | |

**User's choice:** jsdelivr CDN

---

## Predictor threshold calibration

### Q1: Tune thresholds before shipping?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship SPEC values + tuning harness | cover.calibration.test.ts mirrors engine.calibration.test.ts; revise in follow-up plan if results clearly off | ✓ |
| Tune first — add a dedicated Phase 12 tuning plan before UI | Empirical: extract frames, hand-label, fit thresholds; ~half day | |
| Ship as-is, no tuning plan | Trust SPEC values; risk shipping bad v1 | |

**User's choice:** Ship SPEC values + tuning harness

### Q2: Where do magic numbers live?

| Option | Description | Selected |
|--------|-------------|----------|
| COVER_THRESHOLDS const exported from cover.ts | Matches AUDIO_THRESHOLDS pattern at engine.ts:557–561; single source | ✓ |
| Inline magic numbers in each predictor | Tuning touches 6 places; discouraged by AUDIO_THRESHOLDS precedent | |
| JSON config file in cover-config.json | Overkill for v1; adds import boundary for no benefit | |

**User's choice:** COVER_THRESHOLDS const

---

## CoverFramePanel layout + 4-size download UX

### Q1: How should the top-3 frames render?

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal carousel — top-1 large with cover_text preview, #2 + #3 smaller flanking | Visual hierarchy; tap flank to promote; mobile fallback = horizontal scroll | ✓ |
| Equal 3-up grid | No clear recommendation; contradicts SPEC requirement 4 | |
| Vertical stack with #1 hero + #2/#3 below | Mobile-first stack; sub-optimal on desktop | |

**User's choice:** Horizontal carousel with hero

### Q2: How does "Show all 10" expand?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline 5×2 grid below top-3, toggled by chevron | One panel, no overlay; tap to promote; matches Phase 9 IdeaCard expand | ✓ |
| Lightbox / modal | Modal state management; loses context on close | |
| Always-on horizontal scrollable strip | Clutters mobile; vertical bloat | |

**User's choice:** Inline 5×2 grid

### Q3: How does the user trigger 4 platform-sized downloads?

| Option | Description | Selected |
|--------|-------------|----------|
| 4 explicit buttons (YT / IG Square / Story-TikTok / FB) | Most explicit; instant download per click; discoverable | ✓ |
| Single Download Cover button with dropdown | Two-click flow; dropdown finicky on mobile | |
| Single Download All 4 as ZIP | Adds jszip dep; poor mobile zip UX | |

**User's choice:** 4 explicit buttons
**Notes:** Filename pattern `cover-{platform}-{videoBaseName}-{Date.now()}.png`.

### Q4: Cover text preview — DOM overlay or canvas render?

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas render the chosen frame into the preview | WYSIWYG; single renderCoverPng path for preview + download; deterministic | ✓ |
| DOM overlay — absolute-positioned span over img | Faster render; pixel-mismatch with download (CSS text-shadow vs canvas strokeText) | |
| Both — DOM for editing, canvas for download | Editing isn't in SPEC scope; unnecessary complexity | |

**User's choice:** Canvas render

---

## Claude's Discretion

The user explicitly deferred these to Claude:
- Component-internal state shape (hero index, expanded toggle)
- Carousel transition CSS
- Font selection for canvas text (sans-serif default acceptable)
- Canvas font size scaling formula per target dimension
- `data-testid` attribute names (follow ScorePanel convention)
- Whether FaceMesh singleton lives in cover.ts or engine.ts (prefer cover.ts for cohesion — only cover scoring uses it)

## Deferred Ideas

- Per-platform AI cover text (Phase 5 schema extension)
- Auto-attach chosen cover to Phase 6 upload pipeline (YouTube thumbnails API, IG cover-frame param)
- Server-side persistence + cover regeneration in History
- Multi-line text wrap + custom fonts (out of scope for v1)
- Background removal / subject cutout
- Labelled quality benchmark / formal reference dataset
