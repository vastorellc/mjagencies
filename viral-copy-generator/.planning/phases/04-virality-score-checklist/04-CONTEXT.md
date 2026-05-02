# Phase 4: Virality Score + Checklist - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto (recommended option auto-selected for each gray area; user can edit before planning)

<domain>
## Phase Boundary

Pure-function transformation layer that turns an `EngineSignals` object (Phase 3 output) into:
1. A 0-100 overall **virality score** with color band
2. A **per-platform score variant** for each of the 5 platforms (YouTube, Instagram, TikTok, Facebook, X)
3. An **expected view range** for each platform, looked up from that platform's own score (not the overall score)
4. A **3-state checklist** (`pass | fail | pending`) across 4 categories — Video Technical, Metadata Quality (always pending — Phase 5 fills), Virality Boosters, Pakistan-specific niche checks
5. A **rule-based gap analysis** list with actual values interpolated into fix messages

All of this happens **without any AI call** — zero AI cost. Per-user `settings.learned_weights` is read at compute time and applied via `effectiveWeight = baseline + clampedDelta` (only when `dataPoints >= 10`, else baseline).

**In scope:** SCORE-01..SCORE-08
**Out of scope (other phases):** Engine signals (Phase 3), AI copy that fills Metadata Quality items (Phase 5), view logging that drives learned_weights (Phase 7)
</domain>

<decisions>
## Implementation Decisions

### Module structure

- **D-01:** Three new modules under `frontend/src/lib/`:
  - `score.ts` — pure functions: `computeScore(signals, weights, platform?)` → returns `{ overall, perPlatform: { youtube, instagram, tiktok, facebook, x } }`
  - `checklist.ts` — pure function: `buildChecklist(signals, options)` → returns `ChecklistItem[]` grouped by category
  - `gaps.ts` — pure function: `buildGapAnalysis(checklist)` → returns `string[]` (fix messages from failed items)
- **D-02:** Each module is dependency-free — no React, no DOM. Pure TypeScript with deterministic output. Makes them trivially testable in any environment (happy-dom or Node), unblocked by the deferred fixture videos in Phase 3.
- **D-03:** Types live in `frontend/src/lib/types.ts` alongside `EngineSignals`:
  - `Platform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'x'`
  - `ColorBand = 'red' | 'amber' | 'green' | 'bright-green'`
  - `ChecklistStatus = 'pass' | 'fail' | 'pending'`
  - `ChecklistCategory = 'video-technical' | 'metadata-quality' | 'virality-boosters' | 'niche-pakistan'`
  - `ChecklistItem = { id: string; category: ChecklistCategory; label: string; status: ChecklistStatus; fix: string }`

### Score formula (locked by ROADMAP)

- **D-04:** Baseline weights (sum to 1.0):
  - hook 0.25 (first scene change before 1s = strong hook)
  - pacing 0.20 (sceneCount per durationSec)
  - face 0.15 (faceCount + faceConfidence)
  - audio 0.15 (audioEnergy + beatPresent)
  - duration_fit 0.10 (closeness to platform-ideal length)
  - aspect_ratio 0.10 (closeness to platform-ideal aspect)
  - brightness 0.05 (luma in healthy 0.3-0.7 range)

### Per-signal normalization curves

Pure piecewise functions from `EngineSignals` value → 0-100. Each curve is documented inline. Phase 7 may calibrate these via learning loop.

- **D-05: hook(signals) → 0..100**
  - First scene change time = `sceneTimestamps[0] ?? durationSec`
  - 100 if firstSceneT ≤ 1.0s; 0 if firstSceneT ≥ 5.0s; linear in between
  - Edge: no scene cuts → 0
- **D-06: pacing(signals) → 0..100**
  - scenesPerSec = sceneCount / max(durationSec, 1)
  - 100 if scenesPerSec ≥ 0.4 (a cut every 2.5s); 0 if scenesPerSec ≤ 0.1; linear
  - Sweet spot for short-form is 0.3-0.5
- **D-07: face(signals) → 0..100**
  - 0 if faceCount === 0 (this is normal for Pakistani creators per PROJECT.md, **but** the score still rewards face content because most platforms' algorithms favor face-content; the niche-checklist gives a non-penalising "no-face" pass for travel/scenery niches)
  - faceConfidence × 100 capped at 100 if faceCount > 0
  - Edge: faceConfidence is undefined when faceCount = 0 — treat as 0
- **D-08: audio(signals) → 0..100**
  - 0 if hasAudio === false (silent videos under-perform on platforms with autoplay-with-sound)
  - audioEnergy × 60 + (beatPresent ? 40 : 0); capped at 100
  - Edge: silenceGapsSec > 1.5 subtracts 20 (clipped at 0 floor)
- **D-09: duration_fit(signals, platform?) → 0..100**
  - Platform-ideal lengths (seconds): youtube 30, instagram 30, tiktok 21, facebook 30, x 45
  - When `platform` is omitted (overall): use the average of the 5 ideals = 31.2
  - 100 if |durationSec - ideal| ≤ 5; 0 if |durationSec - ideal| ≥ 30; linear
- **D-10: aspect_ratio(signals, platform?) → 0..100**
  - Platform-ideal aspect ratios: youtube 0.5625 (9:16), instagram 0.5625, tiktok 0.5625, facebook 0.5625, x 1.0 (square accepted)
  - 100 if |aspectRatio - ideal| ≤ 0.05; 0 if |aspectRatio - ideal| ≥ 0.4; linear
  - Edge: NaN aspect ratio → 0 (handles 0-width/0-height edge case)
- **D-11: brightness(signals) → 0..100**
  - Healthy range is luma 0.3-0.7
  - 100 if 0.3 ≤ brightnessScore ≤ 0.7; 0 if ≤ 0.1 or ≥ 0.9; linear in transition zones

### Per-platform weight overrides

Each platform's algorithm rewards different signals. Overall score uses baseline weights; platform variants override.

- **D-12: Per-platform weight tables** (each row sums to 1.0):

| signal | overall | youtube | instagram | tiktok | facebook | x |
|---|---|---|---|---|---|---|
| hook | 0.25 | 0.25 | 0.30 | 0.30 | 0.20 | 0.30 |
| pacing | 0.20 | 0.20 | 0.20 | 0.25 | 0.15 | 0.20 |
| face | 0.15 | 0.10 | 0.15 | 0.10 | 0.25 | 0.15 |
| audio | 0.15 | 0.20 | 0.10 | 0.15 | 0.15 | 0.05 |
| duration_fit | 0.10 | 0.10 | 0.10 | 0.05 | 0.10 | 0.15 |
| aspect_ratio | 0.10 | 0.10 | 0.10 | 0.10 | 0.10 | 0.10 |
| brightness | 0.05 | 0.05 | 0.05 | 0.05 | 0.05 | 0.05 |

Rationale:
- YouTube favors retention → audio weighted up (0.20). Face down (0.10) — YT also rewards scenery/B-roll.
- Instagram is hook-heavy (algorithm decides in first 3s) → hook 0.30. Audio down (0.10) — IG often plays muted.
- TikTok is hook + pacing dominant (FYP scroll behavior) → hook + pacing both 0.30 / 0.25.
- Facebook is face-content-heavy (older audience, family/friends videos) → face 0.25.
- X has lowest audio reward (most users mute) and rewards longer-form discussion-starter content → duration_fit 0.15.

### View range tiers

- **D-13: View range table per platform per color band:**

| Band | Score | YouTube | Instagram | TikTok | Facebook | X |
|---|---|---|---|---|---|---|
| red | 0-39 | < 1k | < 500 | < 2k | < 500 | < 500 |
| amber | 40-59 | 1k-10k | 500-5k | 2k-25k | 500-5k | 500-5k |
| green | 60-79 | 10k-100k | 5k-50k | 25k-250k | 5k-50k | 5k-25k |
| bright-green | 80-100 | 100k-1M+ | 50k-500k+ | 250k-5M+ | 50k-500k+ | 25k-250k+ |

Rationale: TikTok ranges are highest (FYP virality), Facebook lowest among algorithmic platforms (declining organic reach), X lowest overall (smaller user base in PK market). These are starting points — Phase 7 learning loop calibrates against actual user data.

### Color bands

- **D-14: Color band thresholds (locked by SCORE-02):**
  - red: 0-39
  - amber: 40-59
  - green: 60-79
  - bright-green: 80-100
- Band lookup is a pure function `bandForScore(score: number): ColorBand`

### Checklist enumeration

- **D-15: Video Technical (5 items)**
  1. `aspect_ratio_vertical` — pass if `aspectRatio < 0.6` (vertical-friendly for Reels/Shorts/TikTok). Fix: `"Aspect is {aspectRatio}; vertical (9:16 = 0.5625) gets ~3× more reach on Reels and Shorts."`
  2. `duration_in_band` — pass if `durationSec` between 10-90s. Fix: `"Length is {durationSec}s; short-form sweet spot is 10-90s."`
  3. `has_audio` — pass if `hasAudio === true`. Fix: `"Video has no audio track. Even ambient sound or music helps autoplay-with-sound platforms."`
  4. `brightness_healthy` — pass if `0.3 <= brightnessScore <= 0.7`. Fix: `"Brightness is {brightnessScore}; aim for 0.3-0.7 (avoid washed-out or too-dark footage)."`
  5. `resolution_min` — pass if `width >= 720`. Fix: `"Resolution is {width}×{height}; minimum 720p for clean upscaling on platform delivery."`

- **D-16: Metadata Quality (8 items, all `pending` in Phase 4 — filled by Phase 5 AI output):**
  1. `caption_length_youtube` — pending
  2. `caption_length_instagram` — pending
  3. `caption_length_tiktok` — pending
  4. `hashtag_count_in_band` — pending (3-7 for IG; 4-6 for TikTok; 1-3 for YT Shorts)
  5. `hook_in_first_line` — pending
  6. `cta_present` — pending
  7. `language_match_niche` — pending (Urdu/Roman Urdu/English mix appropriate for niche)
  8. `description_keyword_density` — pending (YouTube SEO)

- **D-17: Virality Boosters (5 items)**
  1. `strong_hook` — pass if `sceneTimestamps[0] < 1.5`. Fix: `"First scene change at {firstSceneT}s; cut to action before 1.5s to hook scrollers."`
  2. `multiple_scene_cuts` — pass if `sceneCount >= 3`. Fix: `"Only {sceneCount} scene change(s) detected; 3-7 cuts keep viewers watching."`
  3. `motion_present` — pass if `motionScore > 0.15`. Fix: `"Motion score is {motionScore}; static shots underperform — add camera movement or subject motion."`
  4. `beat_aligned_audio` — pass if `beatPresent === true`. Fix: `"No clear beat detected; trending audio or music with beat increases retention."`
  5. `no_long_silence` — pass if all `silenceGapsSec[i] < 1.5`. Fix: `"Silence gap of {longestGapSec}s detected; trim gaps over 1.5s to maintain pacing."`

- **D-18: Niche-Pakistan (3 items)**
  1. `vertical_for_reels_shorts` — pass if `aspectRatio < 0.6` AND user has IG/TikTok/YT enabled. Same data as `aspect_ratio_vertical` but framed as platform-specific for the PK creator. Fix: `"Vertical (9:16) is required for IG Reels and TikTok native feed."`
  2. `no_face_niche_ok` — INFO (not pass/fail) if `faceCount === 0` AND user's `default_niche` is in `['travel', 'hotels', 'cars', 'bikes']`. Surfaces as pass with no fix; reassures the creator their no-face content is on-brand for the niche. (Implementation: status `pass`, fix is empty string, label "No-face content matches travel/hotel/drive niche — algorithm penalty offset by niche relevance.")
  3. `pkt_posting_window_hint` — INFO (always pass) reminds creator of peak-PKT posting window. Fix is empty; label: `"Peak PKT posting window: 8-10pm — schedule via auto-upload (Phase 6)."`

Total: 5 + 8 + 5 + 3 = 21 checklist items. Metadata Quality 8 items always pending; other 13 evaluate against signals.

### Gap analysis

- **D-19: Gap analysis** — `buildGapAnalysis(checklist)`:
  - Filter to items where `status === 'fail'` AND `fix` is non-empty
  - Map to fix strings (already have actual values interpolated by `checklist.ts`)
  - Group order: Video Technical → Virality Boosters → Niche-Pakistan
  - Metadata Quality items never appear in gap analysis (pending state)
  - Output is `string[]` — UI renders as numbered list

### Learning calibration

- **D-20: Calibration application** — `applyLearnedWeights(baseline, learnedWeights, dataPoints)`:
  - If `dataPoints < 10`: return baseline unchanged
  - Else: for each signal, `effectiveWeight = clamp(baseline + delta, 0, 1)` where `delta = learnedWeights[signal] ?? 0`
  - Re-normalize the resulting weights so they sum to 1.0 (delta drift compensation)
  - Returns the same shape as baseline weights
- **D-21: Calibration UI hint** — Score component shows a small footer line:
  - `dataPoints === 0`: hidden (no posts yet — don't confuse fresh users)
  - `0 < dataPoints < 10`: "Score calibration: {dataPoints}/10 posts logged"
  - `dataPoints >= 10`: "Calibrated to your data ({dataPoints} posts)" — plain, no progress bar

### Score visualization (UI)

- **D-22: Score panel layout (in GeneratorPage.tsx, after the analysis result)**:
  1. **Hero block** — large numeric score (0-100), colored ring background matching the band
  2. **Per-platform mini-cards (5 in a horizontal grid)** — each card shows: platform icon/text, that platform's score number, expected view range (from D-13), color band on the score number
  3. **Checklist accordions** — 4 collapsible sections (Video Technical, Metadata Quality, Virality Boosters, Niche-Pakistan), each showing item count `(X/Y passed)` in the header. Default-expanded: Video Technical + Virality Boosters. Default-collapsed: Metadata Quality (pending), Niche-Pakistan
  4. **Gap analysis panel** — inline below checklists, header "Fix this to boost your score:", numbered list. Hidden if no failed items.

- **D-23: Tailwind palette per band:**
  - red: `bg-red-500 text-white border-red-600`
  - amber: `bg-amber-500 text-white border-amber-600`
  - green: `bg-green-500 text-white border-green-600`
  - bright-green: `bg-emerald-400 text-white border-emerald-500`

### Recompute trigger

- **D-24:** Score recomputes via React `useMemo` keyed on `(signals, settings.learned_weights, settings.dataPoints)`. Platform variants always all-five computed (no UI toggle that triggers recompute on platform switch). Cheap pure functions — no perf concern.

### Edge case handling (locked by ROADMAP success criteria 5)

- **D-25:** Score never crashes/NaNs:
  - `durationSec === 0` → return overall score 0; all per-platform scores 0; all signal-derived items fail with "Video has no duration"
  - `hasAudio === false` → audio signal = 0; `has_audio` checklist fails; `beat_aligned_audio` checklist fails; `no_long_silence` skipped (no gaps to evaluate)
  - `faceCount === 0` → face signal = 0; no `face` checklist item exists in this phase (face is implicit in score formula only)
  - `sceneCount === 0` → hook=0, pacing=0; both `strong_hook` and `multiple_scene_cuts` fail
  - `NaN aspectRatio` → aspect_ratio signal = 0; `aspect_ratio_vertical` fails with "Aspect ratio could not be determined"

### Claude's Discretion

- Exact Tailwind class composition for cards/accordions — match SettingsPage.tsx visual language
- Animation/transition on band changes — keep simple (instant, no animation)
- Per-signal sub-score display (e.g., showing "Hook: 80, Pacing: 60") — defer to Phase 10 polish; not in v1
- Whether to memoize at the per-signal level or just the top-level score — planner picks
- Platform icons (use text/abbreviations vs Heroicons vs SVG) — text + 1-letter circle is fine

### Folded Todos

None.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and contracts
- `.planning/ROADMAP.md` §"Phase 4: Virality Score + Checklist" — goal, key implementation notes, success criteria
- `.planning/REQUIREMENTS.md` SCORE-01..SCORE-08
- `.planning/PROJECT.md` — Pakistan-primary audience, niches, no-face creator profile

### Project rules
- `viral-copy-generator/CLAUDE.md` §"Frontend" — h-[100dvh], Tailwind only, no UI library
- `viral-copy-generator/CLAUDE.md` §"Database" — JSONB partial update for settings.learned_weights (Phase 7 work, not Phase 4)

### Upstream phase contracts (Phase 4 reads these)
- `.planning/phases/03-video-upload-analysis/03-CONTEXT.md` D-15 — `EngineSignals` interface lives in `frontend/src/lib/types.ts`
- `.planning/phases/03-video-upload-analysis/03-RESEARCH.md` — concrete EngineSignals fields (durationSec, width, height, aspectRatio, fps, bitrate, hasAudio, audioEnergy, beatPresent, silenceGapsSec, sceneCount, sceneTimestamps, faceCount, faceConfidence, objectLabels, motionScore, brightnessScore, framesBase64)
- `.planning/phases/02-settings-social-oauth/02-02-SUMMARY.md` — `settings.learned_weights JSONB` column shape

### Existing code Phase 4 extends
- `viral-copy-generator/frontend/src/lib/types.ts` — extend with Platform, ColorBand, ChecklistStatus, ChecklistCategory, ChecklistItem
- `viral-copy-generator/frontend/src/pages/GeneratorPage.tsx` — score panel renders below the analysis result
- `viral-copy-generator/frontend/test/setup.ts` — happy-dom test setup (Phase 3 Wave 0 Tasks 1+2 already landed)

No external specs/ADRs needed.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **types.ts** — already extended in Phase 2 with Settings types and Phase 3 will (eventually) add EngineSignals. Phase 4 adds Platform, ColorBand, ChecklistStatus, ChecklistCategory, ChecklistItem
- **Tailwind 4 theme** — Phase 1+2 patterns: red-500/amber-500/green-500 already used for error/success/info; Phase 4 adds emerald-400 for bright-green band
- **Vitest dual-project config** (Phase 3 Wave 0 Tasks 1+2 already landed) — Phase 4's pure-function tests run under happy-dom (the lighter project), so they are fast and **do not block on the deferred fixture videos**. This is exactly why we pivoted from Phase 3.
- **GeneratorPage.tsx** — current Phase 2 placeholder is the integration point; Phase 4 adds the score panel below where Phase 3 will render the analysis result

### Established Patterns
- **No routing library / no UI library** — Tailwind only (CLAUDE.md rule)
- **Pure functions in `lib/`** — encryption.ts, oauth-state.ts in Phase 2 set the precedent for dependency-free, deterministic library modules. score.ts/checklist.ts/gaps.ts follow this pattern.
- **Vitest for pure-function unit tests** — happy-dom env, no browser bootstrap needed
- **TypeScript strict, no `any`** — every helper has explicit input/output types

### Integration Points
- `frontend/src/lib/score.ts` (NEW) — pure functions, imported by GeneratorPage
- `frontend/src/lib/checklist.ts` (NEW) — pure functions, imported by GeneratorPage
- `frontend/src/lib/gaps.ts` (NEW) — pure functions, imported by GeneratorPage
- `frontend/src/lib/types.ts` — add Platform/ColorBand/ChecklistItem types
- `frontend/src/pages/GeneratorPage.tsx` — render score panel + per-platform cards + checklist accordions + gap panel
- `frontend/src/components/ScorePanel.tsx` (NEW) — hero score + ring
- `frontend/src/components/PlatformCardGrid.tsx` (NEW) — 5 mini-cards
- `frontend/src/components/ChecklistAccordion.tsx` (NEW) — 4 collapsible sections
- `frontend/src/components/GapAnalysisPanel.tsx` (NEW) — numbered fix list

### Cross-phase awareness
- **Phase 4 can ship before Phase 3 unblocks** — Phase 4 tests against a hand-mocked `EngineSignals` object. The score panel will render with mock data while Phase 3 fixtures are pending; once Phase 3 wires the real `analyse()` output, the panel automatically receives real signals via React state — no Phase 4 code changes needed.
- **Phase 5 fills Metadata Quality** — Phase 4 ships those 8 items as `pending`. Phase 5 re-evaluates them after AI output arrives (no Phase 4 rewrite).
- **Phase 7 fills `settings.learned_weights`** — Phase 4 reads it but is robust to it being null/empty (baseline weights only when dataPoints < 10).

</code_context>

<specifics>
## Specific Ideas

- Hero score ring style: `w-32 h-32 rounded-full border-8` (Tailwind), border color matches band
- Platform mini-card: 1-letter circle (Y, I, T, F, X) + score number + view range — compact, 5-card grid on desktop, 2-row stacked on mobile
- Checklist item icon: ✓ (pass), ✗ (fail), … (pending) — text characters, no SVG/icons
- Gap analysis header copy: "Fix this to boost your score:" — direct, action-oriented (matches the product's value prop)
- Niche-Pakistan info copy for `no_face_niche_ok`: "No-face content matches travel/hotel/drive niche — algorithm penalty offset by niche relevance."
- Niche-Pakistan info copy for `pkt_posting_window_hint`: "Peak PKT posting window: 8-10pm — schedule via auto-upload (Phase 6)."

## Pakistani-creator-specific touches
- The `no_face_niche_ok` checklist item is a deliberate **info row** (status: pass, no fix) — it tells creators their no-face niche content isn't getting penalized in their score, which addresses an anxiety the product directly solves
- View range tiers reflect Pakistan-market realities — TikTok dominant (huge PK base), Facebook declining, X smaller share
</specifics>

<deferred>
## Deferred Ideas

- **Per-signal sub-score breakdown UI** ("Hook: 80, Pacing: 60") — defer to Phase 10 polish
- **Score history sparkline** — comparing this video's score to user's average — needs view-history data, defer to Phase 7+
- **Platform-specific checklist sections** — beyond Niche-Pakistan, e.g. "TikTok-specific tips" — would balloon checklist; defer to v2
- **Animated band transitions** — when AI re-runs and score changes — defer to Phase 10
- **A/B variant scoring** — score 2 versions side-by-side — defer to v2

No reviewed-but-not-folded todos.
</deferred>

---

*Phase: 04-virality-score-checklist*
*Context gathered: 2026-05-02*
