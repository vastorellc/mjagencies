# Phase 3: Video Upload + Analysis Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 03-video-upload-analysis
**Mode:** Auto (recommended option auto-selected for each gray area; no interactive Q&A)
**Areas discussed:** Upload zone layout, Loading indicator detail, Cancellation, Re-pick flow, Failure recovery, Model preload visibility, Mobile posture, Description textarea behavior

---

## Upload Zone Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Contained dropzone card | Card on Generator page that morphs into preview + analysis result panel after upload | ✓ |
| Full-page drop overlay | Whole viewport accepts drops; preview opens in modal or new screen | |
| Separate upload screen | Dedicated route/screen for upload, navigates back to Generator after | |

**User's choice:** Contained dropzone card (recommended)
**Notes:** Conventional pattern; full-page drop is unfamiliar in this flow; preserves screen real-estate for description textarea + Analyse button. No routing library means a separate screen would add friction.

---

## Loading Indicator Detail

| Option | Description | Selected |
|--------|-------------|----------|
| Step labels within each phase | "Extracting frames…", "Detecting faces…" then "Generating copy…" | ✓ |
| Two-phase only | Static "Analysing video…" then "Generating copy…" — no sub-steps | |
| Determinate percent bar | Progress bar with estimated percent | |

**User's choice:** Step labels within each phase (recommended)
**Notes:** Long operations (30-90s) feel less stuck with progress hints; aligns with two-phase requirement (ANALYSIS-08); avoids fake percent estimates that mislead.

---

## Cancellation

| Option | Description | Selected |
|--------|-------------|----------|
| Visible Cancel button | Cancel beside spinner; resets to pre-analysis state; in-flight WASM runs to completion in background but results discarded | ✓ |
| No cancellation | User must wait for analysis to finish or refresh the page | |
| Cancel with confirm modal | Cancel → "Are you sure?" before reset | |

**User's choice:** Visible Cancel button (recommended)
**Notes:** Long ops without cancel feel like a hostage situation. ffmpeg.wasm has no graceful cancel API but partial state isn't useful so wiping is fine. Confirm modal would be over-engineering — re-picking the same file is the recovery path.

---

## Re-pick Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Wipe + reset | Pick new file → wipe results, return to post-pick / pre-analysis state | ✓ |
| Confirm modal | "Discard analysis?" before swapping | |
| Keep as draft | Stash old analysis as a side panel / history list | |

**User's choice:** Wipe + reset (recommended)
**Notes:** Simpler state machine. Matches "session-scoped" rule from ROADMAP.md — analysis isn't persisted anywhere so there's nothing to "lose". Confirm modal would punish the common case (user changing their mind) for an unrealistic loss scenario.

---

## Analysis Failure Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error + Retry + Skip | Inline error card with Retry button and "Skip analysis, write copy from description" link | ✓ |
| Retry only | Show error and Retry; user must re-pick file to skip | |
| Skip only | Auto-fall-through to manual description on failure | |

**User's choice:** Inline error + Retry + Skip (recommended)
**Notes:** Maximum user agency. Matches the WebAssembly fallback pattern (ANALYSIS-09) — failed analysis and missing WebAssembly converge on the same Skip path. "Tell me more" expander surfaces the underlying error for debugging without burying the user in stack traces.

---

## TF.js Model Preload Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Silent preload + lazy spinner | Preload starts silently on file pick; "Preparing models…" cue only if Analyse is clicked before preload finishes | ✓ |
| Always show preload status | Persistent "Loading face detection…", "Loading object detection…" labels during preload | |
| No preload | Models load when Analyse is clicked; first analysis is slow | |

**User's choice:** Silent preload + lazy spinner (recommended)
**Notes:** Avoids false-progress noise on the fast path (where preload finishes before user clicks Analyse). Surfaces the wait only when actually waiting. Always-show would clutter the UI with model load status that the user doesn't care about.

---

## Mobile Posture

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop-first + advisory banner | Non-blocking "Best on desktop" banner on mobile; failure card catches genuine OOM | ✓ |
| Desktop-only block | Mobile sees "Use desktop" full-screen block; can't proceed | |
| Full mobile parity | Optimise for mobile equally (smaller models, lower frame counts, etc.) | |

**User's choice:** Desktop-first + advisory banner (recommended)
**Notes:** iPhone Safari can run ffmpeg.wasm but 250MB videos overwhelm most phones. Don't block but set expectations. The existing failure-card path (D-10) catches real OOM and offers Skip analysis. Touch devices use file picker only (drag-drop is desktop only).

---

## Description Textarea Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Empty placeholder | Empty by default with hint "Optional: brief description — helps AI when video is ambiguous" | ✓ |
| Pre-fill from filename | Auto-populate with `file.name` (stripped of extension) | |
| Required field | Force user to type a description before Analyse can be clicked | |

**User's choice:** Empty placeholder (recommended)
**Notes:** Pre-filling from filename pollutes prompts (filenames are usually `IMG_1234.mp4` or `WhatsApp Video 2026-05-02 at 14.55.32.mp4`). Required would block the common case where the video is self-explanatory.

---

## Claude's Discretion

- Component decomposition — planner decides
- Tailwind class structure — match existing GeneratorPage.tsx and SettingsPage.tsx patterns
- Error message copy — follow Phase 1's tone
- Beat detection library choice (`meyda` vs `music-tempo`) — researcher evaluates
- Frame extraction interval — researcher picks a value yielding ~10 frames for typical reels

## Deferred Ideas

- Bulk video processing (already in v2 backlog)
- Cloud-side analysis fallback (future, if usage data justifies)
- Resume in-flight analysis after page refresh (not worth IndexedDB complexity)
- Real-time frame preview during analysis (defer until polish phase)
