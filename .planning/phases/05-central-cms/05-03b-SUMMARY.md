---
phase: 05-cms-block-library
plan: "03b"
subsystem: block-library
tags:
  - react
  - blocks
  - storybook
  - service-blocks
  - trust-blocks
  - media-blocks
  - ftc-compliance
  - video-facade
  - css-tokens

dependency_graph:
  requires:
    - "05-01 (buildPayloadConfig, access helpers)"
    - "05-02 (CMS collections — pages/posts reference blocks)"
    - "05-03a (parallel — hero/content/cta/blog/tool/form/utility blocks — no file conflicts)"
  provides:
    - "packages/ui/src/blocks/service/ — 6 React block components"
    - "packages/ui/src/blocks/trust/ — 6 React block components (TestimonialsGrid/Slider with required disclaimer)"
    - "packages/ui/src/blocks/media/ — 5 React block components (VideoEmbed facade, BeforeAfter slider)"
  affects:
    - "05-03c (barrel exports + Payload block configs — depends on all 03a + 03b blocks)"
    - "05-04 (Lexical editor block registry — references these components)"

tech_stack:
  added: []
  patterns:
    - "VideoEmbed facade pattern — useState(false) for loaded; iframe only on user click (prevents ~600KB YouTube/Vimeo JS on initial load)"
    - "BeforeAfter slider — useState<number>(50) for position; clipPath on after image; onMouseMove/onTouchMove drag handlers"
    - "TestimonialsGrid/Slider — disclaimer is required string prop (TypeScript enforces REQ-421 FTC compliance)"
    - "All block CSS via --mj-* custom properties only — zero hex literals"

key_files:
  created:
    - packages/ui/src/blocks/service/ServiceGrid/types.ts
    - packages/ui/src/blocks/service/ServiceGrid/index.tsx
    - packages/ui/src/blocks/service/ServiceGrid/stories.tsx
    - packages/ui/src/blocks/service/ServiceDetail/types.ts
    - packages/ui/src/blocks/service/ServiceDetail/index.tsx
    - packages/ui/src/blocks/service/ServiceDetail/stories.tsx
    - packages/ui/src/blocks/service/ProcessSteps/types.ts
    - packages/ui/src/blocks/service/ProcessSteps/index.tsx
    - packages/ui/src/blocks/service/ProcessSteps/stories.tsx
    - packages/ui/src/blocks/service/FeatureList/types.ts
    - packages/ui/src/blocks/service/FeatureList/index.tsx
    - packages/ui/src/blocks/service/FeatureList/stories.tsx
    - packages/ui/src/blocks/service/ComparisonTable/types.ts
    - packages/ui/src/blocks/service/ComparisonTable/index.tsx
    - packages/ui/src/blocks/service/ComparisonTable/stories.tsx
    - packages/ui/src/blocks/service/PricingTable/types.ts
    - packages/ui/src/blocks/service/PricingTable/index.tsx
    - packages/ui/src/blocks/service/PricingTable/stories.tsx
    - packages/ui/src/blocks/trust/ClientLogos/types.ts
    - packages/ui/src/blocks/trust/ClientLogos/index.tsx
    - packages/ui/src/blocks/trust/ClientLogos/stories.tsx
    - packages/ui/src/blocks/trust/TestimonialsGrid/types.ts
    - packages/ui/src/blocks/trust/TestimonialsGrid/index.tsx
    - packages/ui/src/blocks/trust/TestimonialsGrid/stories.tsx
    - packages/ui/src/blocks/trust/TestimonialsSlider/types.ts
    - packages/ui/src/blocks/trust/TestimonialsSlider/index.tsx
    - packages/ui/src/blocks/trust/TestimonialsSlider/stories.tsx
    - packages/ui/src/blocks/trust/CaseStudyCard/types.ts
    - packages/ui/src/blocks/trust/CaseStudyCard/index.tsx
    - packages/ui/src/blocks/trust/CaseStudyCard/stories.tsx
    - packages/ui/src/blocks/trust/AwardsBar/types.ts
    - packages/ui/src/blocks/trust/AwardsBar/index.tsx
    - packages/ui/src/blocks/trust/AwardsBar/stories.tsx
    - packages/ui/src/blocks/trust/TeamGrid/types.ts
    - packages/ui/src/blocks/trust/TeamGrid/index.tsx
    - packages/ui/src/blocks/trust/TeamGrid/stories.tsx
    - packages/ui/src/blocks/media/ImageGallery/types.ts
    - packages/ui/src/blocks/media/ImageGallery/index.tsx
    - packages/ui/src/blocks/media/ImageGallery/stories.tsx
    - packages/ui/src/blocks/media/VideoEmbed/types.ts
    - packages/ui/src/blocks/media/VideoEmbed/index.tsx
    - packages/ui/src/blocks/media/VideoEmbed/stories.tsx
    - packages/ui/src/blocks/media/VideoHero/types.ts
    - packages/ui/src/blocks/media/VideoHero/index.tsx
    - packages/ui/src/blocks/media/VideoHero/stories.tsx
    - packages/ui/src/blocks/media/PortfolioGrid/types.ts
    - packages/ui/src/blocks/media/PortfolioGrid/index.tsx
    - packages/ui/src/blocks/media/PortfolioGrid/stories.tsx
    - packages/ui/src/blocks/media/BeforeAfter/types.ts
    - packages/ui/src/blocks/media/BeforeAfter/index.tsx
    - packages/ui/src/blocks/media/BeforeAfter/stories.tsx
  modified: []

key_decisions:
  - "VideoEmbed uses useState(false) facade — no iframe rendered until user click, preventing ~600KB YouTube/Vimeo JS load on page"
  - "TestimonialsGrid/Slider disclaimer prop is required string (not string | undefined) — TypeScript enforces FTC REQ-421 at compile time"
  - "BeforeAfter uses clipPath: inset(0 0 0 {position}%) on after image — cleaner than overflow+translate; avoids double-render"
  - "HTML entities (&#8249; &#8250;) replaced with Unicode literals to avoid false-positive hex-literal grep matches"
  - "VideoHero muted/loop/autoPlay/playsInline are hardcoded true — not props, per specs/media.md requirement"
  - "TeamGrid fallback renders first-initial avatar div when no imageUrl — prevents broken img alt confusion"

metrics:
  duration: "25m"
  completed: "2026-04-26"
  tasks: 3
  files_created: 51
  files_modified: 0
---

# Phase 05 Plan 03b: Service / Trust / Media Block Library Summary

**One-liner:** 17 React block components (51 files) across service/trust/media categories — VideoEmbed facade pattern, BeforeAfter drag slider, TestimonialsGrid/Slider with required FTC disclaimer prop (REQ-421).

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-26T13:04:48Z
- **Completed:** 2026-04-26T13:30:00Z
- **Tasks:** 3
- **Files created:** 51

## What Was Built

### Task 1: 6 Service Blocks

| Block | Key Feature |
|-------|-------------|
| ServiceGrid | CSS grid (2/3 col), icon + title + description, optional href links |
| ServiceDetail | Feature checklist with Unicode ✓, optional CTA button |
| ProcessSteps | Numbered vertical steps, circular badge with brand-primary bg |
| FeatureList | Table layout with included/excluded indicators and color-coded badges |
| ComparisonTable | Semantic `<table>` with `<thead>/<tbody>`, responsive overflow wrapper |
| PricingTable | 3-plan layout, highlighted plan uses brand-primary bg with contrasting text |

### Task 2: 6 Trust Blocks

| Block | Key Feature |
|-------|-------------|
| ClientLogos | Flex-wrap row, grayscale+opacity filter on logos, optional href |
| TestimonialsGrid | Auto-fill CSS grid, `<blockquote>` semantics, **required disclaimer** (REQ-421) |
| TestimonialsSlider | `use client` + prev/next navigation, **required disclaimer** (REQ-421) |
| CaseStudyCard | Client label, result callout with brand-primary border-left, optional card-level link |
| AwardsBar | Horizontal flex-wrap row of award badges with optional year |
| TeamGrid | Auto-fill grid, fallback first-initial avatar, LinkedIn link |

REQ-421 enforcement: `disclaimer: string` (not `string | undefined`) in both testimonial block types. TypeScript will error at the call site if disclaimer is omitted — compiler-enforced FTC compliance.

### Task 3: 5 Media Blocks

| Block | Key Feature |
|-------|-------------|
| ImageGallery | CSS grid (2/3/4 col), `<figure>/<figcaption>`, lazy loading |
| VideoEmbed | **Facade pattern** — poster + play button; iframe only on click |
| VideoHero | `<video>` with muted+loop+autoPlay+playsInline hardcoded (not props) |
| PortfolioGrid | CSS grid cards, category label, optional card-level link |
| BeforeAfter | `use client` + `useState<number>(50)`, clipPath on after image, drag + touch handlers |

VideoEmbed facade detail: Initial render is a `<div>` with poster image and SVG play button. On click/keydown, `setLoaded(true)` triggers re-render with the actual `<iframe>` and `?autoplay=1`. YouTube src: `https://www.youtube.com/embed/{videoId}?autoplay=1`. Vimeo: `https://player.vimeo.com/video/{videoId}?autoplay=1`.

BeforeAfter detail: `clipPath: inset(0 0 0 {position}%)` is applied to the after image. Container has `overflow: hidden`. Mouse/touch events use `useRef` for drag state to avoid stale closures. `useCallback` wraps all handlers.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build 6 Service blocks | `67d516a` | 18 files (service/**/types.ts, index.tsx, stories.tsx) |
| 2 | Build 6 Trust blocks | `6ce38d5` | 18 files (trust/**/types.ts, index.tsx, stories.tsx) |
| 3 | Build 5 Media blocks | `4dd1503` | 15 files (media/**/types.ts, index.tsx, stories.tsx) |

## Verification Results

```
ls packages/ui/src/blocks/service/   → ComparisonTable FeatureList PricingTable ProcessSteps ServiceDetail ServiceGrid ✓
ls packages/ui/src/blocks/trust/     → AwardsBar CaseStudyCard ClientLogos TeamGrid TestimonialsGrid TestimonialsSlider ✓
ls packages/ui/src/blocks/media/     → BeforeAfter ImageGallery PortfolioGrid VideoEmbed VideoHero ✓
grep -rn "#[0-9a-fA-F]" .../blocks  → 0 matches ✓
grep -rn ": any" .../blocks          → 0 matches ✓
grep "disclaimer" TestimonialsGrid/index.tsx → line 6 (destructured), line 94 (rendered) ✓
grep "disclaimer" TestimonialsSlider/index.tsx → line 7 (destructured), line 159 (rendered) ✓
grep "disclaimer?" TestimonialsGrid/types.ts  → 0 matches (prop NOT optional) ✓
grep "'use client'" VideoEmbed/index.tsx → line 1 ✓
grep "useState" VideoEmbed/index.tsx → line 2 (import), line 20 (const [loaded]) ✓
grep "'use client'" BeforeAfter/index.tsx → line 1 ✓
grep "muted={true}" VideoHero/index.tsx → line 24 ✓
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HTML entities &#8249;/&#8250; replaced to avoid false hex grep matches**
- **Found during:** Task 2 verification
- **Issue:** `&#8249;` and `&#8250;` HTML entities in TestimonialsSlider buttons matched `grep -rn "#[0-9a-fA-F]"` pattern (`#824` in `&#8249;`), which would cause the acceptance criteria check to exit 0 (fail) instead of exit 1 (pass)
- **Fix:** Replaced with Unicode string literals `{'‹'}` and `{'›'}`
- **Files modified:** `packages/ui/src/blocks/trust/TestimonialsSlider/index.tsx`
- **Commit:** Included in `6ce38d5` (Task 2 commit)

## Known Stubs

None. All 17 blocks are fully implemented with real content in stories, all props wired, no placeholder text.

## Threat Surface Scan

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-05-03b-01 VideoEmbed info disclosure | Facade pattern — no YouTube/Vimeo iframe until user click | Mitigated in VideoEmbed/index.tsx |
| T-05-03b-02 Block string input tampering | String inputs rendered as text children (not dangerouslySetInnerHTML) — no XSS vector | Mitigated across all 17 blocks |
| T-05-03b-03 TestimonialsGrid disclaimer tampering | `disclaimer: string` required prop — TypeScript compile error if omitted | Mitigated in types.ts |

No new threat surface introduced beyond the plan's threat model.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `packages/ui/src/blocks/service/` has 6 directories | FOUND |
| `packages/ui/src/blocks/trust/` has 6 directories | FOUND |
| `packages/ui/src/blocks/media/` has 5 directories | FOUND |
| `TestimonialsGrid/index.tsx` contains `disclaimer` | FOUND |
| `TestimonialsSlider/index.tsx` contains `disclaimer` | FOUND |
| `TestimonialsGrid/types.ts` has no `disclaimer?` (optional) | CONFIRMED (grep exits 1) |
| `VideoEmbed/index.tsx` has `'use client'` at line 1 | FOUND |
| `VideoEmbed/index.tsx` has `useState` | FOUND |
| `BeforeAfter/index.tsx` has `'use client'` at line 1 | FOUND |
| `VideoHero/index.tsx` has `muted={true}` hardcoded | FOUND |
| Zero hex literals across all blocks | CONFIRMED (grep exits 1) |
| Zero `: any` types across all blocks | CONFIRMED (grep exits 1) |
| Task 1 commit `67d516a` in git log | FOUND |
| Task 2 commit `6ce38d5` in git log | FOUND |
| Task 3 commit `4dd1503` in git log | FOUND |
