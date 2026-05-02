# Phase 4: Virality Score + Checklist - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-05-02
**Phase:** 04-virality-score-checklist
**Mode:** Auto (recommended option auto-selected for each gray area)

The roadmap and SCORE-01..SCORE-08 requirements lock most of the headline decisions (formula weights, color bands, 3-state checklist, view ranges per platform per tier, calibration via dataPoints≥10 + EMA). Auto-mode picked sensible defaults for the remaining gray areas, which are mostly concrete tables (per-platform weight overrides, view range numbers, signal normalization curves, checklist item enumeration, and Pakistan-specific niche checks).

## Per-platform weight overrides

| Option | Description | Selected |
|---|---|---|
| Distinct weight tables per platform | Each of the 5 platforms gets its own weight overrides reflecting algorithm differences (YT favors retention/audio, IG favors hook, TikTok favors hook+pacing, FB favors face, X favors duration_fit) | ✓ |
| Same baseline weights across all platforms | Use one weight table; per-platform variation comes only from `duration_fit` and `aspect_ratio` (since those are platform-specific anyway) | |
| Configurable per-user weights | Let user adjust weights manually | |

**Choice:** Distinct weight tables (D-12 in CONTEXT.md). Phase 7 learning loop will further refine these based on actual user data.

## View range tiers per platform

| Option | Description | Selected |
|---|---|---|
| 4 tiers per platform matching color bands | red/amber/green/bright-green ranges, each platform has its own range numbers reflecting realistic outcomes for the PK market | ✓ |
| Single global range table | One range per band, applied to all platforms | |
| Tier count tied to score precision | 5+ tiers per platform | |

**Choice:** 4 tiers matching color bands (D-13 in CONTEXT.md). PK market reality: TikTok highest reach, Facebook declining, X smallest. Phase 7 calibration adjusts based on actual user data.

## Per-signal normalization curves

| Option | Description | Selected |
|---|---|---|
| Piecewise linear with explicit thresholds | Each signal has 2-3 anchor points (e.g. hook = 100 if firstSceneT ≤ 1s, 0 if ≥ 5s, linear between) | ✓ |
| Sigmoid curves | Smoother transitions with one shape parameter per signal | |
| Lookup table per signal | Discrete bands with hard cutoffs | |

**Choice:** Piecewise linear (D-05..D-11 in CONTEXT.md). Easy to read in code, easy to calibrate by tweaking anchor points, no surprising non-monotonic behavior.

## Pakistan-specific niche checks

| Option | Description | Selected |
|---|---|---|
| 3 lightweight items: vertical-for-reels-shorts, no-face-niche-ok (info), pkt-posting-window-hint (info) | Two are info rows that pass without fix messages — they reassure the no-face PK creator profile. One is functional (vertical aspect requirement) | ✓ |
| 5+ niche items | Add language detection (Urdu/Roman Urdu/English), niche-specific hashtag suggestions, etc. | |
| No niche section | Drop the Pakistan-specific category | |

**Choice:** 3 items (D-18 in CONTEXT.md). The two info rows (no_face_niche_ok, pkt_posting_window_hint) directly address PK creator anxieties from PROJECT.md (no-face creator + PKT timezone). Heavier niche logic deferred to v2.

## Checklist categories and item counts

| Option | Description | Selected |
|---|---|---|
| 5+8+5+3 = 21 items across 4 categories | Video Technical 5, Metadata Quality 8 (all pending), Virality Boosters 5, Niche-Pakistan 3 | ✓ |
| Larger checklist (~30 items) | More granular items per category | |
| Smaller checklist (~12 items) | Just the highest-impact 3 per category | |

**Choice:** 21 items (D-15..D-18). Granular enough to give meaningful, specific fix advice; small enough to not overwhelm. Metadata Quality 8 items are a Phase 5 contract — they're declared in Phase 4 as `pending` so the UI surface exists day 1.

## Score visualization layout

| Option | Description | Selected |
|---|---|---|
| Hero score ring + 5 platform mini-cards + 4 collapsible checklist accordions + inline gap panel | Vertical scroll layout under the analysis result | ✓ |
| Tabs (Score / Per-platform / Checklist) | Reduces scroll, hides info | |
| Single linear list | No accordions; everything visible always | |

**Choice:** Hero + grid + accordions (D-22 in CONTEXT.md). Default-expanded: Video Technical + Virality Boosters (the actionable ones). Default-collapsed: Metadata Quality (pending) + Niche-Pakistan (informational).

## Gap analysis surfacing

| Option | Description | Selected |
|---|---|---|
| Inline panel below checklists, numbered "Fix this to boost your score:" list | All failed items at once, no clicks required | ✓ |
| On-click expansion per checklist item | User clicks the failed item to reveal the fix | |
| Modal/popover | Dedicated panel that opens on a "Show fixes" button | |

**Choice:** Inline panel (D-19 in CONTEXT.md). Direct, action-oriented, matches the product's value prop ("ready to copy-paste in 30 seconds").

## Learning calibration UI

| Option | Description | Selected |
|---|---|---|
| Quiet footer text near score (hidden until first post, count till 10, "calibrated" after) | Progressive disclosure as data arrives | ✓ |
| Always-visible progress bar | "Calibration: 6/10 posts" as a bar | |
| Hidden entirely | No UI surface; learning silent | |

**Choice:** Quiet footer (D-21 in CONTEXT.md). Avoids confusing fresh users who have zero posts logged.

## Score recompute trigger

| Option | Description | Selected |
|---|---|---|
| useMemo keyed on (signals, learned_weights, dataPoints) | Recomputes when any input changes; all 5 platform variants always-computed | ✓ |
| Lazy compute on platform switch | Compute only the active platform's variant | |
| Recompute on every render | Cheapest mental model, slight waste | |

**Choice:** useMemo (D-24). Pure functions are cheap; computing all 5 variants is fine.

## Claude's Discretion

- Tailwind class composition for cards/accordions — match SettingsPage.tsx visual language
- Animation/transition on band changes — keep simple (instant)
- Per-signal sub-score display ("Hook: 80, Pacing: 60") — defer to Phase 10
- Memoization granularity — planner picks
- Platform icons — text-based (1-letter in circle)

## Deferred Ideas

- Per-signal sub-score breakdown UI — Phase 10
- Score history sparkline — Phase 7+
- Platform-specific checklist sections beyond Niche-Pakistan — v2
- Animated band transitions — Phase 10
- A/B variant scoring — v2
