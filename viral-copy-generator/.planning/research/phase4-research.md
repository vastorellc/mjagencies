# Phase 4 Deep Research

**Phase:** 4 — Virality Score + Checklist + Gap Analysis
**Researched:** 2026-04-30
**Requirements covered:** SCORE-01 through SCORE-07

---

## Confirmed Approach (no changes needed)

### Score architecture is pure frontend — no backend call needed

All engine signals from Phase 3 live in browser memory. The score formula, checklist, and gap
analysis can execute synchronously in-browser using those signals. No network round-trip is
needed for Phase 4. The only backend interaction Phase 4 initiates is a single GET to fetch
`learned_weights` from `/api/learning/score-weights` — and even that should be treated as
optional (baseline weights used if the endpoint returns null or empty).

### Settings table `learned_weights` column must be added to schema in Phase 1

The spec's settings table does not include a `learned_weights` column. This column must be
added to the Phase 1 migration. It is JSONB, nullable, default null.

```sql
settings (
  ...
  learned_weights  JSONB  DEFAULT NULL,   -- calibration deltas per signal
  ...
)
```

The `/api/learning/score-weights` route (Phase 1, learning.ts) must read and return this
column. Phase 7 will write to it. Phase 4 reads it. Schema must exist from Phase 1 or Phase 4
will hit a DB error on its first GET.

### The 9 gap messages in the spec are a floor, not a ceiling

The spec shows 9 gap messages as plain static strings. Expanding them to include the actual
measured value (e.g. "Your max silence gap is 3.2s — remove gaps over 1.5s") is strictly
within spec intent ("specific fix for this video"), costs zero additional complexity, and
directly satisfies SCORE-06 ("every failed item shows a specific actionable fix for *this
video*, not generic advice"). The plan should build dynamic messages from the start — not
static strings.

### View range lookup must use the per-platform score for that platform

The spec table shows 4 score tiers × 4 platforms. The lookup key for each platform row must
be that platform's own computed score, not the overall score. This is the only interpretation
consistent with SCORE-03 ("score computed per platform with platform-weighted variants") and
SCORE-04 ("expected view range per platform per score tier"). If the overall score were used
for all platforms, there would be no point computing platform variants.

---

## Issues Found (must fix in plan)

### Issue 1: `learned_weights` column is absent from the spec schema

**Problem:** The spec's settings table schema (viral-copy-generator-FINAL-SPEC.md, Database
Schema section) does not declare a `learned_weights` column. The learning loop description
later says "stored as learned_weights JSONB in settings table." These two sections contradict
each other.

**Fix required in Phase 1:** Add `learned_weights JSONB DEFAULT NULL` to the settings table
migration. Phase 4 fetches it; Phase 7 writes it. If Phase 1 ships without the column, both
phases break.

---

### Issue 2: Metadata Quality checklist section cannot run in Phase 4

**Problem:** All 8 checks in "Section 2 — Metadata Quality" require AI output:

| Check | Requires |
|-------|---------|
| Title contains detected topic keyword | AI-generated title |
| Description mentions detected scene | AI-generated description |
| Tags match detected objects | AI-generated tags |
| Hashtags mix niche + broad | AI-generated hashtags |
| Caption opens with hook | AI-generated caption |
| CTA present in caption | AI-generated caption |
| Hashtag count within platform limit | AI-generated hashtags |
| No duplicate tags | AI-generated tags |

Phase 4 has no AI output. Phase 5 produces it.

**Fix required in plan:** Metadata Quality checks must be rendered in Phase 4 with a
`pending-ai` state (e.g. greyed out, labelled "Available after AI generation"). Phase 5 must
trigger a re-evaluation of the checklist after AI output arrives and update each item's
pass/fail status. The checklist component must accept a status of `pass | fail | pending`
(not just boolean). Planning tasks for Phase 4 must not attempt to implement these 8 checks
— those tasks belong to Phase 5.

---

### Issue 3: Pacing normalisation needs a defined curve, not a raw ratio

**Problem:** "Scene cuts per minute" produces a raw float (e.g. 2.3, 8.7, 22.0). Feeding this
directly into a weighted formula produces nonsense — a video with 22 cuts/min would overflow
the 0-100 output. A normalisation function must be defined before Phase 4 implementation
starts.

**Fix required in plan:** Each score component must be normalised to 0–100 using a defined
function before applying weights. The normalisation curves for all 7 components are specified
in Implementation Notes below.

---

### Issue 4: No per-platform weight tables exist in the spec

**Problem:** The spec states "Score shown once overall AND per platform (weighted differently
per algorithm)" but never defines the per-platform weights. SCORE-03 requires this.

**Fix required in plan:** Baseline per-platform weight tables must be defined and hardcoded
before Phase 4 implementation. The tables are defined in Implementation Notes below. These are
[ASSUMED] — derived from known algorithm priorities of each platform, not from official
documentation (which none of the platforms publish).

---

### Issue 5: Face presence and aspect ratio are boolean signals, not scored 0–100

**Problem:** The engine produces `faceDetected: boolean` and `aspectRatio: string` (e.g.
"9:16"). Both need a defined mapping to a 0–100 component score before the weighted formula
can run.

**Fix required in plan:** Boolean signals map to binary scores (100 if condition met, 0 if
not) in the normalisation layer. See Implementation Notes.

---

### Issue 6: "Duration fit" needs a per-platform optimal range definition

**Problem:** "Duration fit (platform optimal)" is 10% of the score but no optimal ranges are
defined in the spec. The checklist says "Duration optimal per platform" validated by "ffmpeg
duration" but gives no numbers.

**Fix required in plan:** Optimal duration ranges per platform must be hardcoded. Recommended
values are defined in Implementation Notes. Scores inside the range score 100; scores outside
decay linearly to a floor of 0 at 2× the upper bound.

---

## Implementation Notes (specific code patterns)

### 1. EngineSignals TypeScript type

This type is the contract between Phase 3 (engine output) and Phase 4 (score + checklist). It
must be defined in a shared location — recommended: `frontend/src/lib/types.ts` — and imported
by both `engine.ts` (Phase 3) and `score.ts`, `checklist.ts`, `gaps.ts` (Phase 4).

```typescript
// frontend/src/lib/types.ts

export interface EngineSignals {
  // ffmpeg — metadata
  durationSeconds: number;          // total video length in seconds
  aspectRatio: string;              // e.g. "9:16", "16:9", "1:1"
  widthPx: number;
  heightPx: number;
  fps: number;
  bitrate: number;                  // kbps
  audioPresent: boolean;

  // ffmpeg — scene detection
  sceneCount: number;               // total scene cuts detected
  sceneTimestamps: number[];        // seconds of each cut
  hookSceneChange: boolean;         // scene change detected within first 3s

  // TF.js
  motionScoreFirst3s: number;       // 0–100, average motion in first 3 seconds
  faceDetected: boolean;
  faceTimestamps: number[];         // seconds where face appears
  sceneLabels: string[];            // e.g. ["road", "mountain", "laptop"]
  objectLabels: string[];           // COCO-SSD detected objects

  // Web Audio API
  audioEnergyScore: number;         // 0–100
  beatDetected: boolean;
  silenceGapMaxSeconds: number;     // longest silence gap in seconds

  // Canvas API
  brightnessScore: number;          // 0–100 luma average

  // Derived — set by engine orchestrator before signals are returned
  cutsPerMinute: number;            // sceneCount / (durationSeconds / 60)
  niches: string[];                 // detected niches e.g. ["travel", "car_drive"]
}

// Null-safe version — used when analysis has not yet run
export type PartialEngineSignals = Partial<EngineSignals>;

// Score output type
export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'x';

export interface PlatformScore {
  platform: Platform;
  score: number;                    // 0–100, rounded to integer
  viewRangeMin: number;
  viewRangeMax: number;
  viewRangeLabel: string;           // e.g. "2K–10K"
}

export interface ViralityScoreResult {
  overall: number;                  // 0–100
  components: ScoreComponents;
  platforms: PlatformScore[];
}

export interface ScoreComponents {
  hookStrength: number;             // 0–100 normalised component score
  pacing: number;
  facePresence: number;
  audioQuality: number;
  durationFit: number;
  aspectRatio: number;
  brightness: number;
}

// Checklist item — three-state: pass / fail / pending (awaiting AI output)
export type ChecklistStatus = 'pass' | 'fail' | 'pending';

export interface ChecklistItem {
  id: string;                       // e.g. "vertical-9-16"
  section: 'technical' | 'metadata' | 'boosters' | 'pakistan';
  label: string;
  status: ChecklistStatus;
  fix: string | null;               // null when status is 'pass' or 'pending'
  viewImpact: string | null;        // e.g. "+40% reach"
}

export interface GapMessage {
  checkId: string;
  message: string;                  // includes actual measured value where possible
}
```

---

### 2. Component normalisation functions

Each raw signal must be mapped to a 0–100 component score before weights are applied.

```typescript
// frontend/src/lib/score.ts — normalisation helpers

// Hook strength: composite of hookSceneChange (boolean) + motionScoreFirst3s (0-100)
// If scene change present AND high motion: full score
// If only one: partial
// If neither: 0
function normaliseHook(hookSceneChange: boolean, motionScore: number): number {
  const sceneBonus = hookSceneChange ? 50 : 0;
  const motionContrib = motionScore * 0.5;    // motion is 0-100, contributes half
  return Math.min(100, sceneBonus + motionContrib);
}

// Pacing: cuts per minute, sigmoid-shaped curve
// 0 cuts/min = 0, 4 cuts/min = ~50, 8 cuts/min = ~80, 12+ cuts/min = 100
// Formula: score = 100 * (1 - e^(-cutsPerMin / 6))
// This prevents overflow and gives diminishing returns above 12 cuts/min
function normalisePacing(cutsPerMinute: number): number {
  if (cutsPerMinute <= 0) return 0;
  return Math.min(100, Math.round(100 * (1 - Math.exp(-cutsPerMinute / 6))));
}

// Face presence: boolean → binary
function normaliseFace(faceDetected: boolean): number {
  return faceDetected ? 100 : 0;
}

// Audio quality: composite of audioEnergyScore + beatDetected bonus
// If no audio present: 0 (hard floor — audio absence is a hard penalty)
// If audio present: energy score + small beat bonus
function normaliseAudio(
  audioPresent: boolean,
  audioEnergyScore: number,
  beatDetected: boolean,
  silenceGapMaxSeconds: number
): number {
  if (!audioPresent) return 0;
  let score = audioEnergyScore * 0.75;                // energy is primary (75%)
  if (beatDetected) score += 15;                      // beat bonus (+15)
  if (silenceGapMaxSeconds > 1.5) {
    // silence gap penalty: -5 per second over 1.5s, floor 0
    const penaltySeconds = silenceGapMaxSeconds - 1.5;
    score -= Math.min(score, penaltySeconds * 5);
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}

// Duration fit: per-platform optimal window
// Score 100 inside optimal range, linear decay to 0 at 2× upper bound
// Below minimum: linear decay to 0 at 0s
const OPTIMAL_DURATION: Record<Platform, [number, number]> = {
  youtube:   [15, 60],    // YouTube Shorts: 15–60s optimal
  instagram: [7,  30],    // Instagram Reels: 7–30s optimal
  tiktok:    [7,  60],    // TikTok: 7–60s optimal
  facebook:  [15, 60],    // Facebook Reels: 15–60s optimal
  x:         [10, 140],   // X video: 10–140s (X supports up to 140s short clips)
};

function normaliseDurationFit(durationSeconds: number, platform: Platform): number {
  if (durationSeconds <= 0) return 0;
  const [min, max] = OPTIMAL_DURATION[platform];
  if (durationSeconds >= min && durationSeconds <= max) return 100;
  if (durationSeconds < min) {
    // below minimum: linear from 0 at 0s to 100 at min
    return Math.round((durationSeconds / min) * 100);
  }
  // above maximum: linear decay to 0 at 2× max
  const overRun = durationSeconds - max;
  const decayRange = max; // 2× max - max = max
  return Math.max(0, Math.round(100 - (overRun / decayRange) * 100));
}

// Aspect ratio: binary — 9:16 scores 100, everything else 0
// Note: allow a small tolerance for near-9:16 ratios (e.g. 1080x1920 reported as "9:16")
function normaliseAspectRatio(aspectRatio: string): number {
  // Parse "W:H" string
  const parts = aspectRatio.split(':');
  if (parts.length !== 2) return 0;
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);
  if (isNaN(w) || isNaN(h) || h === 0) return 0;
  const ratio = w / h;
  // 9:16 = 0.5625 — accept ±0.02 tolerance for pixel rounding
  return Math.abs(ratio - 0.5625) < 0.02 ? 100 : 0;
}

// Brightness: threshold-based with linear ramp
// <30: 0, 30-60: linear ramp to 50, 60-80: linear ramp to 100, >80: 100
function normaliseBrightness(brightnessScore: number): number {
  if (brightnessScore < 30) return 0;
  if (brightnessScore < 60) return Math.round(((brightnessScore - 30) / 30) * 50);
  if (brightnessScore <= 80) return Math.round(50 + ((brightnessScore - 60) / 20) * 50);
  return 100;
}
```

---

### 3. Score formula and per-platform weight tables

```typescript
// Baseline weights (overall score) — from spec
export const BASELINE_WEIGHTS = {
  hookStrength:  0.25,
  pacing:        0.20,
  facePresence:  0.15,
  audioQuality:  0.15,
  durationFit:   0.10,
  aspectRatio:   0.10,
  brightness:    0.05,
};

// Per-platform weights — [ASSUMED] derived from known platform algorithm priorities
// Rationale documented per platform:
export const PLATFORM_WEIGHTS: Record<Platform, typeof BASELINE_WEIGHTS> = {
  // YouTube Shorts: hook and pacing are king; face matters but less than hook
  youtube: {
    hookStrength:  0.30,   // +5 (hooks drive Shorts discovery)
    pacing:        0.20,
    facePresence:  0.10,   // -5 (scenery channels perform on YT Shorts)
    audioQuality:  0.15,
    durationFit:   0.15,   // +5 (YT penalises <15s Shorts heavily)
    aspectRatio:   0.07,   // -3
    brightness:    0.03,   // -2
  },
  // Instagram Reels: face/person heavily boosted; aspect ratio critical; bright aesthetics
  instagram: {
    hookStrength:  0.20,   // -5
    pacing:        0.15,   // -5
    facePresence:  0.25,   // +10 (face-to-camera drives IG reach)
    audioQuality:  0.15,
    durationFit:   0.08,   // -2
    aspectRatio:   0.12,   // +2 (IG suppresses non-vertical harder)
    brightness:    0.05,
  },
  // TikTok: hook within first 1-2s is the strongest signal; pacing and audio energy
  tiktok: {
    hookStrength:  0.35,   // +10 (TikTok's algo measures hook retention within 1-2s)
    pacing:        0.25,   // +5
    facePresence:  0.10,   // -5 (TikTok has strong non-face niches)
    audioQuality:  0.15,
    durationFit:   0.07,   // -3
    aspectRatio:   0.05,   // -5 (TikTok users swipe past non-vertical but less harsh)
    brightness:    0.03,   // -2
  },
  // Facebook Reels: lower algorithm pressure; duration tolerance wider; audio matters
  facebook: {
    hookStrength:  0.20,   // -5
    pacing:        0.15,   // -5
    facePresence:  0.15,
    audioQuality:  0.20,   // +5 (FB Watch users have sound on)
    durationFit:   0.12,   // +2
    aspectRatio:   0.10,
    brightness:    0.08,   // +3
  },
  // X/Twitter: text-first platform; video is secondary; hook and brevity matter most
  x: {
    hookStrength:  0.30,   // +5
    pacing:        0.15,   // -5
    facePresence:  0.10,   // -5
    audioQuality:  0.10,   // -5 (X often watched muted)
    durationFit:   0.20,   // +10 (X users drop off quickly; under 45s much better)
    aspectRatio:   0.10,
    brightness:    0.05,
  },
};

// All platform weights must sum to 1.0 — assert this at startup in dev builds
function assertWeightSums(): void {
  for (const [platform, weights] of Object.entries(PLATFORM_WEIGHTS)) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      console.error(`Weight sum error for ${platform}: ${sum}`);
    }
  }
}
```

---

### 4. Learned weights merge strategy

The `learned_weights` JSONB column stores calibration deltas — not absolute weights. This
distinction is critical: it stores how much each signal's weight has been nudged by actual
view performance, not the final weights themselves. The merge at runtime is:

```
effectiveWeight = clamp(baselineWeight + learnedDelta, 0.01, baselineWeight * 2)
```

Then re-normalise so all 7 weights sum to 1.0.

```typescript
// Structure of learned_weights JSONB in DB:
interface LearnedWeightsRecord {
  hookStrength?:  number;   // delta e.g. +0.05, -0.03
  pacing?:        number;
  facePresence?:  number;
  audioQuality?:  number;
  durationFit?:   number;
  aspectRatio?:   number;
  brightness?:    number;
  sampleCount:    number;   // how many data points drove this calibration
  lastUpdated:    string;   // ISO timestamp
}

// Merge function — called once at component mount after fetching /api/learning/score-weights
function mergeWeights(
  baseline: typeof BASELINE_WEIGHTS,
  learned: LearnedWeightsRecord | null
): typeof BASELINE_WEIGHTS {
  // Guard: fewer than 10 data points → use baseline unchanged (per spec LEARNING-07)
  if (!learned || learned.sampleCount < 10) return baseline;

  const merged = { ...baseline };
  const keys = Object.keys(baseline) as Array<keyof typeof BASELINE_WEIGHTS>;

  for (const key of keys) {
    const delta = learned[key] ?? 0;
    // Cap per signal: ±15% of baseline (per spec)
    const maxDelta = baseline[key] * 0.15;
    const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));
    merged[key] = baseline[key] + clampedDelta;
  }

  // Re-normalise to sum = 1.0
  const total = Object.values(merged).reduce((a, b) => a + b, 0);
  for (const key of keys) {
    merged[key] = merged[key] / total;
  }
  return merged;
}
```

Per-platform calibration note: The spec implies a single `learned_weights` entry applies to
all platforms. For Phase 4/7, treat the learned deltas as universal corrections applied to the
overall score only, and leave per-platform weight tables unchanged. Separate per-platform
calibration is a v2 enhancement.

---

### 5. Full score computation function

```typescript
// frontend/src/lib/score.ts

export function computeViralityScore(
  signals: EngineSignals,
  learnedWeights: LearnedWeightsRecord | null
): ViralityScoreResult {
  // Edge case guards
  const safeDuration = signals.durationSeconds > 0 ? signals.durationSeconds : 0;
  const safeCutsPerMin = safeDuration > 0
    ? (signals.sceneCount / safeDuration) * 60
    : 0;

  // Normalise all 7 components to 0-100
  const components: ScoreComponents = {
    hookStrength:  normaliseHook(signals.hookSceneChange, signals.motionScoreFirst3s),
    pacing:        normalisePacing(safeCutsPerMin),
    facePresence:  normaliseFace(signals.faceDetected),
    audioQuality:  normaliseAudio(
                     signals.audioPresent,
                     signals.audioEnergyScore,
                     signals.beatDetected,
                     signals.silenceGapMaxSeconds
                   ),
    durationFit:   normaliseDurationFit(safeDuration, 'youtube'),  // overall uses YT as reference
    aspectRatio:   normaliseAspectRatio(signals.aspectRatio),
    brightness:    normaliseBrightness(signals.brightnessScore),
  };

  // Merge baseline weights with learned calibration
  const weights = mergeWeights(BASELINE_WEIGHTS, learnedWeights);

  // Compute overall score
  const overall = Math.round(
    components.hookStrength  * weights.hookStrength  +
    components.pacing        * weights.pacing        +
    components.facePresence  * weights.facePresence  +
    components.audioQuality  * weights.audioQuality  +
    components.durationFit   * weights.durationFit   +
    components.aspectRatio   * weights.aspectRatio   +
    components.brightness    * weights.brightness
  );

  // Compute per-platform scores (each uses its own weight table + platform-specific duration fit)
  const platforms: PlatformScore[] = (['youtube', 'instagram', 'tiktok', 'facebook', 'x'] as Platform[])
    .map(platform => {
      const pw = PLATFORM_WEIGHTS[platform];
      const platformComponents = {
        ...components,
        durationFit: normaliseDurationFit(safeDuration, platform),
      };
      const platformScore = Math.round(
        platformComponents.hookStrength  * pw.hookStrength  +
        platformComponents.pacing        * pw.pacing        +
        platformComponents.facePresence  * pw.facePresence  +
        platformComponents.audioQuality  * pw.audioQuality  +
        platformComponents.durationFit   * pw.durationFit   +
        platformComponents.aspectRatio   * pw.aspectRatio   +
        platformComponents.brightness    * pw.brightness
      );
      const { min, max, label } = getViewRange(platform, platformScore);
      return { platform, score: platformScore, viewRangeMin: min, viewRangeMax: max, viewRangeLabel: label };
    });

  return { overall: Math.min(100, Math.max(0, overall)), components, platforms };
}
```

---

### 6. View range lookup using per-platform score

```typescript
// frontend/src/lib/score.ts

// Lookup is keyed by the platform's own score, not the overall score (per SCORE-03/04)
const VIEW_RANGES: Record<Platform, Array<{ min: number; max: number; label: string; displayMin: number; displayMax: number }>> = {
  youtube: [
    { min: 80, max: 100, displayMin: 10000,  displayMax: 100000, label: '10K–100K' },
    { min: 60, max: 79,  displayMin: 2000,   displayMax: 10000,  label: '2K–10K'   },
    { min: 40, max: 59,  displayMin: 500,    displayMax: 2000,   label: '500–2K'   },
    { min: 0,  max: 39,  displayMin: 0,      displayMax: 500,    label: '<500'     },
  ],
  instagram: [
    { min: 80, max: 100, displayMin: 15000,  displayMax: 200000, label: '15K–200K' },
    { min: 60, max: 79,  displayMin: 3000,   displayMax: 15000,  label: '3K–15K'   },
    { min: 40, max: 59,  displayMin: 500,    displayMax: 3000,   label: '500–3K'   },
    { min: 0,  max: 39,  displayMin: 0,      displayMax: 500,    label: '<500'     },
  ],
  tiktok: [
    { min: 80, max: 100, displayMin: 50000,  displayMax: 500000, label: '50K–500K' },
    { min: 60, max: 79,  displayMin: 5000,   displayMax: 50000,  label: '5K–50K'   },
    { min: 40, max: 59,  displayMin: 1000,   displayMax: 5000,   label: '1K–5K'    },
    { min: 0,  max: 39,  displayMin: 0,      displayMax: 1000,   label: '<1K'      },
  ],
  facebook: [
    { min: 80, max: 100, displayMin: 5000,   displayMax: 50000,  label: '5K–50K'  },
    { min: 60, max: 79,  displayMin: 1000,   displayMax: 5000,   label: '1K–5K'   },
    { min: 40, max: 59,  displayMin: 200,    displayMax: 1000,   label: '200–1K'  },
    { min: 0,  max: 39,  displayMin: 0,      displayMax: 200,    label: '<200'    },
  ],
  // X is not in the spec view range table — show N/A
  x: [
    { min: 0,  max: 100, displayMin: 0, displayMax: 0, label: 'Engagement-based' },
  ],
};

function getViewRange(platform: Platform, platformScore: number): { min: number; max: number; label: string } {
  const ranges = VIEW_RANGES[platform];
  const tier = ranges.find(r => platformScore >= r.min && platformScore <= r.max) ?? ranges[ranges.length - 1];
  return { min: tier.displayMin, max: tier.displayMax, label: tier.label };
}
```

---

### 7. Checklist implementation with three-state items

```typescript
// frontend/src/lib/checklist.ts

import type { ChecklistItem, ChecklistStatus, EngineSignals } from './types';

export function buildChecklist(signals: EngineSignals): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // === Section 1: Video Technical (all can be checked from engine signals alone) ===

  items.push({
    id: 'vertical-9-16',
    section: 'technical',
    label: 'Vertical 9:16 format',
    status: isVertical(signals.aspectRatio) ? 'pass' : 'fail',
    fix: isVertical(signals.aspectRatio) ? null
      : `Re-export as 9:16 vertical — current ratio is ${signals.aspectRatio}. Horizontal gets suppressed by all short-form algorithms.`,
    viewImpact: '+40% reach',
  });

  items.push({
    id: 'duration-optimal',
    section: 'technical',
    label: 'Duration optimal per platform',
    // This check passes if the video is in range for at least one target platform
    status: isAnyDurationOptimal(signals.durationSeconds) ? 'pass' : 'fail',
    fix: isAnyDurationOptimal(signals.durationSeconds) ? null
      : `Your video is ${signals.durationSeconds}s. Trim to under 60s — completion rate drops sharply after 60s for short-form.`,
    viewImpact: '+25% completion',
  });

  items.push({
    id: 'hook-scene-change',
    section: 'technical',
    label: 'Scene change in first 3s',
    status: signals.hookSceneChange ? 'pass' : 'fail',
    fix: signals.hookSceneChange ? null
      : 'No scene change detected in your first 3 seconds. Cut to your strongest visual moment within the first 2 seconds.',
    viewImpact: '+30% retention',
  });

  items.push({
    id: 'face-in-frame',
    section: 'technical',
    label: 'Face in frame',
    status: signals.faceDetected ? 'pass' : 'fail',
    fix: signals.faceDetected ? null
      : 'No face detected. Add a face-to-camera moment — even 2s of face-cam boosts trust and CTR significantly.',
    viewImpact: '+20% CTR',
  });

  items.push({
    id: 'motion-first-3s',
    section: 'technical',
    label: 'Motion in first 3s',
    status: signals.motionScoreFirst3s >= 40 ? 'pass' : 'fail',
    fix: signals.motionScoreFirst3s >= 40 ? null
      : `Motion score in first 3s: ${signals.motionScoreFirst3s}/100. Start with movement — pan, cut, or action. Static opens lose 60% of viewers.`,
    viewImpact: '+25% scroll stop',
  });

  items.push({
    id: 'audio-energetic',
    section: 'technical',
    label: 'Audio present and energetic',
    status: signals.audioPresent && signals.audioEnergyScore >= 50 ? 'pass' : 'fail',
    fix: !signals.audioPresent
      ? 'No audio detected. Add background music or voice — silent videos perform significantly worse on all platforms.'
      : `Audio energy score: ${signals.audioEnergyScore}/100. Increase background music volume or speak louder in the first 5 seconds.`,
    viewImpact: '+20% engagement',
  });

  items.push({
    id: 'no-silence-gap',
    section: 'technical',
    label: 'No silence gap over 1.5s',
    status: signals.silenceGapMaxSeconds <= 1.5 ? 'pass' : 'fail',
    fix: signals.silenceGapMaxSeconds <= 1.5 ? null
      : `Max silence gap detected: ${signals.silenceGapMaxSeconds.toFixed(1)}s. Remove gaps over 1.5s — long silences kill watch time and trigger algorithm down-rank.`,
    viewImpact: '+15% watch time',
  });

  items.push({
    id: 'brightness-score',
    section: 'technical',
    label: 'Brightness score above 60',
    status: signals.brightnessScore >= 60 ? 'pass' : 'fail',
    fix: signals.brightnessScore >= 60 ? null
      : `Brightness score: ${signals.brightnessScore}/100. Shoot near a window or add +20% brightness in your editor. Dark videos scroll past faster.`,
    viewImpact: '+10% appeal',
  });

  // === Section 2: Metadata Quality (ALL deferred to Phase 5 — requires AI output) ===

  const metadataChecks = [
    { id: 'title-keyword',      label: 'Title contains detected topic keyword' },
    { id: 'desc-scene-mention', label: 'Description mentions detected scene/setting' },
    { id: 'tags-match-objects', label: 'Tags match detected objects and locations' },
    { id: 'hashtag-mix',        label: 'Hashtags mix niche + broad categories' },
    { id: 'caption-hook',       label: 'Caption opens with a hook (question or bold statement)' },
    { id: 'cta-present',        label: 'CTA present in caption or description' },
    { id: 'hashtag-count',      label: 'Hashtag count within platform limit' },
    { id: 'no-duplicate-tags',  label: 'No duplicate tags across title and description' },
  ];

  for (const check of metadataChecks) {
    items.push({
      id: check.id,
      section: 'metadata',
      label: check.label,
      status: 'pending',           // Always pending — Phase 5 will update these
      fix: null,
      viewImpact: null,
    });
  }

  // === Section 3: Virality Boosters ===

  const cutsPerMin = signals.durationSeconds > 0
    ? (signals.sceneCount / signals.durationSeconds) * 60
    : 0;

  items.push({
    id: 'multiple-scene-cuts',
    section: 'boosters',
    label: 'Multiple scene cuts detected',
    status: signals.sceneCount >= 3 ? 'pass' : 'fail',
    fix: signals.sceneCount >= 3 ? null
      : `Only ${signals.sceneCount} cut(s) detected (${cutsPerMin.toFixed(1)} cuts/min). Aim for 6–12 cuts/min — faster pacing holds attention.`,
    viewImpact: '+20% pacing',
  });

  items.push({
    id: 'energetic-beat',
    section: 'boosters',
    label: 'Energetic audio beat detected',
    status: signals.beatDetected ? 'pass' : 'fail',
    fix: signals.beatDetected ? null
      : 'No clear beat detected in audio. Add background music with a clear rhythmic beat — it improves pacing feel and watch time.',
    viewImpact: '+15% engagement',
  });

  // Caption length and hashtag structure checks are deferred to Phase 5 (require AI output)
  items.push({
    id: 'caption-length',
    section: 'boosters',
    label: 'Caption length optimal per platform',
    status: 'pending',
    fix: null,
    viewImpact: '+10% read rate',
  });

  items.push({
    id: 'hashtag-structure',
    section: 'boosters',
    label: 'Trending hashtag structure (niche + broad mix)',
    status: 'pending',
    fix: null,
    viewImpact: '+20% discovery',
  });

  // Text overlay — TF.js OCR detection. If no OCR signal, mark as unknown (pending)
  // Phase 3 may or may not produce an OCR result depending on TF.js model loaded.
  // Safe fallback: mark pending if not detected; if detected, pass.
  items.push({
    id: 'text-overlay',
    section: 'boosters',
    label: 'Text overlay detected in video',
    status: 'pending',    // Phase 3 OCR result can update this if available
    fix: null,
    viewImpact: '+15% retention',
  });

  // === Section 4: Pakistan-Specific Niche Checks ===

  const niche = signals.niches[0] ?? '';

  if (niche === 'travel' || niche === 'outdoor') {
    items.push({
      id: 'scene-variety',
      section: 'pakistan',
      label: 'Scene variety detected (multiple locations)',
      status: signals.sceneCount >= 5 ? 'pass' : 'fail',
      fix: signals.sceneCount >= 5 ? null
        : `Only ${signals.sceneCount} scene cuts suggest limited location variety. Mix in b-roll from different angles or locations.`,
      viewImpact: null,
    });
  }

  if (niche === 'car_drive' || niche === 'bike_ride') {
    items.push({
      id: 'high-motion-score',
      section: 'pakistan',
      label: 'Motion score high (expected above 70 for drive content)',
      status: signals.motionScoreFirst3s >= 70 ? 'pass' : 'fail',
      fix: signals.motionScoreFirst3s >= 70 ? null
        : `Motion score: ${signals.motionScoreFirst3s}/100. Drive content needs visible speed and movement. Start with the most dynamic section.`,
      viewImpact: null,
    });
  }

  if (!signals.faceDetected) {
    items.push({
      id: 'cover-frame-quality',
      section: 'pakistan',
      label: 'Cover frame quality (best scenic shot suggested)',
      status: 'pending',   // AI provides cover_frame_suggestion in Phase 5
      fix: null,
      viewImpact: null,
    });
  }

  if (niche === 'coding') {
    items.push({
      id: 'screen-readable',
      section: 'pakistan',
      label: 'Screen capture text is readable',
      status: 'pending',   // Requires OCR — mark pending if not available
      fix: null,
      viewImpact: null,
    });
  }

  return items;
}

function isVertical(aspectRatio: string): boolean {
  const parts = aspectRatio.split(':');
  if (parts.length !== 2) return false;
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);
  return !isNaN(w) && !isNaN(h) && h > 0 && (w / h) < 0.75;   // portrait = w < h
}

function isAnyDurationOptimal(durationSeconds: number): boolean {
  // Passes if within at least one platform's optimal range
  return durationSeconds >= 7 && durationSeconds <= 140;
}
```

---

### 8. Gap analysis — dynamic messages

```typescript
// frontend/src/lib/gaps.ts

import type { ChecklistItem, GapMessage, EngineSignals } from './types';

// Gap messages are derived from the checklist — only failed items produce gaps.
// Messages use actual measured values where possible for specificity (SCORE-06).
export function buildGapMessages(
  checklist: ChecklistItem[],
  signals: EngineSignals
): GapMessage[] {
  return checklist
    .filter(item => item.status === 'fail' && item.fix !== null)
    .map(item => ({
      checkId: item.id,
      message: item.fix as string,   // fix is guaranteed non-null when status is 'fail'
    }));
}
```

The `fix` field on each `ChecklistItem` already contains the dynamic, value-interpolated
message string (built in `checklist.ts` above). The gaps module simply filters failed items
and surfaces their fix strings. This keeps the message logic in one place (checklist.ts) and
avoids duplication.

---

### 9. Backend route required in Phase 1

Phase 4 requires the following endpoint to exist from Phase 1:

```
GET /api/learning/score-weights
Response: { learned_weights: LearnedWeightsRecord | null }
```

If no weights have been saved (fresh install), the endpoint must return `{ learned_weights: null }` — not 404 or empty body. Phase 4 handles null by using baseline weights unchanged.

---

### 10. Edge case handling table

| Situation | What happens | How handled |
|-----------|-------------|-------------|
| `durationSeconds === 0` | Duration unknown (metadata extraction failed) | Duration fit component returns 0; overall score computed from remaining 6 components; no crash |
| `audioPresent === false` | No audio track | Audio quality component returns 0 (hard penalty); silenceGapMaxSeconds set to 0 |
| `faceDetected === false` | No face found | facePresence component = 0; Pakistan-specific cover-frame check marked pending |
| `sceneCount === 0` | No scene cuts detected | cutsPerMinute = 0; pacing component = 0; hookSceneChange = false |
| `motionScoreFirst3s === undefined` | TF.js didn't return a value | Default to 0; hook component uses only sceneBonus |
| `aspectRatio` malformed (e.g. "") | Parse fails | normaliseAspectRatio returns 0 |
| `brightnessScore === undefined` | Canvas API unavailable | Default to 0; brightness component = 0 |
| `learned_weights` fetch fails (network) | Cannot reach /api/learning/score-weights | Catch error, use baseline weights; display no warning to user |
| `learned_weights.sampleCount < 10` | Not enough calibration data | Use baseline weights, ignore deltas (per LEARNING-07) |
| `signals.niches` empty | Niche detection failed | Pakistan-specific section omitted from checklist |

---

## Dependency Checklist (must be true before phase starts)

- [ ] **Phase 3 complete and merged:** `EngineSignals` object produced correctly by engine.ts — all fields
      populated or null-safe defaults set
- [ ] **`EngineSignals` type exists** at `frontend/src/lib/types.ts` — agreed shape with Phase 3 implementer
      before either phase is coded
- [ ] **`learned_weights` column exists** in settings table in the DB migration (Phase 1 must add it — see
      Issue 1 above)
- [ ] **`GET /api/learning/score-weights`** route exists and returns `{ learned_weights: null }` on fresh
      install (Phase 1 backend)
- [ ] **Phase 3 sets `cutsPerMinute`** as a derived field on EngineSignals — or Phase 4 computes it from
      `sceneCount` and `durationSeconds` (either approach works, but must be consistent)
- [ ] **`niches` array populated** by Phase 3 engine orchestrator using detected object/scene labels —
      Phase 4 Pakistan checks depend on this

---

## Estimated Risk: LOW

Phase 4 is pure deterministic logic — no external API calls, no async operations beyond the
single GET for learned weights. All inputs are well-defined from the spec and Phase 3 output.
The only non-trivial decisions are:

1. The per-platform weight tables (marked [ASSUMED] — reasonable defaults, adjustable post-ship
   based on actual results)
2. The normalisation curves (defined above — all are monotonic and bounded, no surprises)
3. The Metadata Quality deferral (confirmed correct by spec analysis — Phase 4 cannot evaluate
   AI-dependent checks without AI output)

The main execution risk is the `learned_weights` schema gap (Issue 1) — if Phase 1 ships
without that column, Phase 4's backend GET will error. This must be fixed in Phase 1 planning.

---

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|--------------|
| A1 | Per-platform weight tables (PLATFORM_WEIGHTS constant) | Score variances between platforms may not reflect actual algorithm priorities. Adjustable post-ship without schema change — low blast radius. |
| A2 | Optimal duration ranges per platform (OPTIMAL_DURATION constant) | Duration scoring may over/under-penalise certain lengths. Adjustable post-ship. |
| A3 | Pacing exponential curve constant (divisor = 6) | Curve may give too much or too little score to low-pacing videos. Tunable constant. |
| A4 | Audio energy threshold for pass/fail (>= 50) | Threshold may be too strict or too lenient. Tunable. |
| A5 | Motion score threshold for first-3s pass (>= 40) | May produce false fails for slow-paced travel content. Tunable. |
| A6 | Learned_weights applies universally across all platforms (not per-platform) | If per-platform calibration diverges, a single delta may correct one platform and harm another. Acceptable for Phase 7 v1; per-platform calibration is a v2 concern. |
