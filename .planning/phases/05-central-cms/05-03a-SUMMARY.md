---
phase: 05-central-cms
plan: 03a
subsystem: ui-blocks
tags: [react, blocks, storybook, css-tokens, typescript, design-system]

# Dependency graph
requires:
  - "05-01 (buildPayloadConfig, @mjagency/cms access helpers)"
  - "05-02 (CORE_COLLECTIONS — pages/posts reference block types)"
  - "packages/ui (CSS token schema from Phase 04 — --mj-* custom properties)"
provides:
  - "packages/ui/src/blocks/hero/ — 4 Hero block components (HeroImage, HeroVideo, HeroSplit, HeroMinimal)"
  - "packages/ui/src/blocks/content/ — 8 Content block components (RichText, TwoColumn, ThreeColumn, ImageText, TextImage, StatsBar, QuoteBlock, Timeline)"
  - "packages/ui/src/blocks/cta/ — 5 CTA block components (CtaFull, CtaInline, CtaCard, CtaFloating, NewsletterCta)"
  - "51 files total (17 types.ts + 17 index.tsx + 17 stories.tsx)"
affects:
  - "05-03c (barrel export + Payload block configs — depends on all three 03* plans)"
  - "Phase 7 (Puck builder — consumes these as visual block library)"

# Tech tracking
tech-stack:
  added:
    - "React.FC with explicit ReactElement return types throughout"
    - "Storybook StoryObj pattern with realistic (non-placeholder) args"
    - "CSS-in-JS inline styles using var(--mj-*) token references exclusively"
  patterns:
    - "Block triplet pattern: types.ts (interface) + index.tsx (component) + stories.tsx (stories)"
    - "ReactNode for rich content slots (body, content, leftContent, rightContent, columns[].content)"
    - "Primitive string/number types only in types.ts — no ReactNode in type files"
    - "'use client' on interactive blocks (CtaFloating, NewsletterCta, Hero blocks)"
    - "import type for all type-only imports"

key-files:
  created:
    - "packages/ui/src/blocks/hero/HeroImage/types.ts"
    - "packages/ui/src/blocks/hero/HeroImage/index.tsx"
    - "packages/ui/src/blocks/hero/HeroImage/stories.tsx"
    - "packages/ui/src/blocks/hero/HeroVideo/types.ts"
    - "packages/ui/src/blocks/hero/HeroVideo/index.tsx"
    - "packages/ui/src/blocks/hero/HeroVideo/stories.tsx"
    - "packages/ui/src/blocks/hero/HeroSplit/types.ts"
    - "packages/ui/src/blocks/hero/HeroSplit/index.tsx"
    - "packages/ui/src/blocks/hero/HeroSplit/stories.tsx"
    - "packages/ui/src/blocks/hero/HeroMinimal/types.ts"
    - "packages/ui/src/blocks/hero/HeroMinimal/index.tsx"
    - "packages/ui/src/blocks/hero/HeroMinimal/stories.tsx"
    - "packages/ui/src/blocks/content/RichText/types.ts"
    - "packages/ui/src/blocks/content/RichText/index.tsx"
    - "packages/ui/src/blocks/content/RichText/stories.tsx"
    - "packages/ui/src/blocks/content/TwoColumn/types.ts"
    - "packages/ui/src/blocks/content/TwoColumn/index.tsx"
    - "packages/ui/src/blocks/content/TwoColumn/stories.tsx"
    - "packages/ui/src/blocks/content/ThreeColumn/types.ts"
    - "packages/ui/src/blocks/content/ThreeColumn/index.tsx"
    - "packages/ui/src/blocks/content/ThreeColumn/stories.tsx"
    - "packages/ui/src/blocks/content/ImageText/types.ts"
    - "packages/ui/src/blocks/content/ImageText/index.tsx"
    - "packages/ui/src/blocks/content/ImageText/stories.tsx"
    - "packages/ui/src/blocks/content/TextImage/types.ts"
    - "packages/ui/src/blocks/content/TextImage/index.tsx"
    - "packages/ui/src/blocks/content/TextImage/stories.tsx"
    - "packages/ui/src/blocks/content/StatsBar/types.ts"
    - "packages/ui/src/blocks/content/StatsBar/index.tsx"
    - "packages/ui/src/blocks/content/StatsBar/stories.tsx"
    - "packages/ui/src/blocks/content/QuoteBlock/types.ts"
    - "packages/ui/src/blocks/content/QuoteBlock/index.tsx"
    - "packages/ui/src/blocks/content/QuoteBlock/stories.tsx"
    - "packages/ui/src/blocks/content/Timeline/types.ts"
    - "packages/ui/src/blocks/content/Timeline/index.tsx"
    - "packages/ui/src/blocks/content/Timeline/stories.tsx"
    - "packages/ui/src/blocks/cta/CtaFull/types.ts"
    - "packages/ui/src/blocks/cta/CtaFull/index.tsx"
    - "packages/ui/src/blocks/cta/CtaFull/stories.tsx"
    - "packages/ui/src/blocks/cta/CtaInline/types.ts"
    - "packages/ui/src/blocks/cta/CtaInline/index.tsx"
    - "packages/ui/src/blocks/cta/CtaInline/stories.tsx"
    - "packages/ui/src/blocks/cta/CtaCard/types.ts"
    - "packages/ui/src/blocks/cta/CtaCard/index.tsx"
    - "packages/ui/src/blocks/cta/CtaCard/stories.tsx"
    - "packages/ui/src/blocks/cta/CtaFloating/types.ts"
    - "packages/ui/src/blocks/cta/CtaFloating/index.tsx"
    - "packages/ui/src/blocks/cta/CtaFloating/stories.tsx"
    - "packages/ui/src/blocks/cta/NewsletterCta/types.ts"
    - "packages/ui/src/blocks/cta/NewsletterCta/index.tsx"
    - "packages/ui/src/blocks/cta/NewsletterCta/stories.tsx"

key-decisions:
  - "ReactNode used for rich content slots (body, content, columns[].content) — enables Lexical/Puck output to render serialized JSX in Phase 7 without dangerouslySetInnerHTML"
  - "String props for all primitive text (headline, quote, attribution) — text content rendered as JSX text nodes, naturally XSS-safe by React without additional sanitization"
  - "ThreeColumn columns typed as Array<ThreeColumnItem> with content: ReactNode — allows heterogeneous column content from Puck block output"
  - "CtaFloating uses spread object for left/right positioning — avoids conditional prop nullification TypeScript issue with inline spread"

# Metrics
duration: 8min
completed: 2026-04-26
---

# Phase 05 Plan 03a: Hero + Content + CTA Block Library Summary

**One-liner:** 17 React block components (Hero x4, Content x8, CTA x5) across 51 files using var(--mj-*) CSS tokens exclusively, with TypeScript strict props and Storybook stories with real content args.

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-26T13:03:12Z
- **Completed:** 2026-04-26T13:11:35Z
- **Tasks:** 3
- **Files created:** 51

## Accomplishments

- Created 4 Hero blocks: HeroImage (overlay on dominant-color bg), HeroVideo (muted autoplay loop with poster), HeroSplit (flex-row with imagePosition prop via flexDirection), HeroMinimal (centered text-only, no image dependency)
- Created 8 Content blocks: RichText (ReactNode wrapper), TwoColumn (flex gap), ThreeColumn (CSS grid), ImageText (image on left by default), TextImage (image on right by default), StatsBar (flex stats with cite source), QuoteBlock (blockquote with optional avatar), Timeline (ordered list with dot/line connectors)
- Created 5 CTA blocks: CtaFull (full-width branded banner), CtaInline (single-line flex row), CtaCard (card with optional icon), CtaFloating (fixed-position overlay, zIndex 9000), NewsletterCta (useState email input, form onSubmit)
- All 51 files comply with zero hex literals — every CSS value uses var(--mj-*) tokens
- TypeScript strict mode throughout: explicit return types (React.ReactElement), import type for interfaces, no any types

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Hero blocks (4)** - `8a1bd1c` (feat)
2. **Task 2: Build Content blocks (8)** - `071005d` (feat)
3. **Task 3: Build CTA blocks (5)** - `a593084` (feat)

## Files Created

### Hero (12 files)

| Block | types.ts | index.tsx | stories.tsx |
|-------|---------|-----------|-------------|
| HeroImage | HeroImageProps with overlayOpacity, imageDominantColor | overlay on img with minHeight 60vh | Default + NoOverlay stories |
| HeroVideo | HeroVideoProps with videoPoster, posterAlt | video element muted/loop/autoPlay/playsInline | Default story |
| HeroSplit | imagePosition: 'left' \| 'right' | flexDirection row/row-reverse | Default + ImageLeft stories |
| HeroMinimal | headline, subheadline, ctaText, ctaHref | centered text, no image | Default + HeadlineOnly stories |

### Content (24 files)

| Block | Key prop design | Notable implementation |
|-------|----------------|------------------------|
| RichText | content: ReactNode | div wrapper with body typography |
| TwoColumn | leftContent/rightContent: ReactNode, gap?: string | flex row, gap defaults to var(--mj-space-8) |
| ThreeColumn | columns: ThreeColumnItem[] with content: ReactNode | CSS grid 3-column |
| ImageText | imagePosition?: 'left' | 'right', body: ReactNode | flex row with image left by default |
| TextImage | same as ImageText | image right by default |
| StatsBar | stats: StatItem[] with value/label/source | source renders as cite element |
| QuoteBlock | quote, attribution, role, avatarUrl/avatarAlt | blockquote with left border accent |
| Timeline | items: TimelineItem[] with date/title/description | ol with dot/line connectors |

### CTA (15 files)

| Block | Key prop design | Notable implementation |
|-------|----------------|------------------------|
| CtaFull | primaryCta + secondaryCta?: CtaLink | full-width brand-primary bg, inverted button colors |
| CtaInline | text, ctaText, ctaHref | single-line flex row in surface card |
| CtaCard | headline, body (string), iconUrl optional | card with flex-start CTA button |
| CtaFloating | position: 'bottom-right' \| 'bottom-left' | position: 'fixed', zIndex: 9000, 'use client' |
| NewsletterCta | placeholder, submitText, disclaimer optional | 'use client', useState email, form onSubmit |

## Decisions Made

- **ReactNode for content slots:** RichText.content, TwoColumn.leftContent/rightContent, ThreeColumn.columns[].content, ImageText/TextImage.body are all ReactNode. This allows Puck/Lexical in Phase 7 to pass serialized JSX without requiring dangerouslySetInnerHTML.
- **String props for text primitives:** headline, quote, body (CtaCard), etc. are typed as string. React renders string props as text nodes — inherently XSS-safe. No additional sanitization needed for Phase 5 (Puck wiring in Phase 7 adds server-side validation at that layer per T-05-03a-01).
- **ThreeColumnItem type in types.ts:** The content: ReactNode field required importing ReactNode from react, making the types.ts file use an import. This is the correct pattern since ReactNode is the appropriate type for renderable content slots.
- **CtaFloating spread positioning:** Used `...( position === 'bottom-right' ? { right: ... } : { left: ... } )` spread pattern to avoid TypeScript issues with conditionally-present style keys.

## Deviations from Plan

None - plan executed exactly as written.

All 17 blocks implemented with the exact prop signatures, CSS token patterns, and file structure specified in the plan.

## Known Stubs

- `NewsletterCta` form submission: `console.log('Newsletter subscription submitted:', email)` — form only prevents default and logs. Server action wired in Phase 9 per plan spec (T-05-03a-02 accepted disposition).

## Threat Surface Scan

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-05-03a-01 String inputs XSS | React renders string props as text nodes (not innerHTML) — inherently safe | Mitigated by React JSX rendering |
| T-05-03a-02 NewsletterCta form | e.preventDefault() + console.log only; Phase 9 wires server action with full validation | Accepted per plan |

No new threat surface introduced beyond what was planned.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| packages/ui/src/blocks/hero/ has 4 directories | FOUND |
| packages/ui/src/blocks/content/ has 8 directories | FOUND |
| packages/ui/src/blocks/cta/ has 5 directories | FOUND |
| HeroImage/index.tsx contains var(--mj- | FOUND |
| CtaFull/index.tsx contains primaryCta | FOUND |
| StatsBar/index.tsx contains stats array | FOUND |
| CtaFloating/index.tsx: position: 'fixed' | FOUND |
| CtaFloating/index.tsx: zIndex: 9000 | FOUND |
| NewsletterCta/index.tsx: 'use client' | FOUND |
| NewsletterCta/index.tsx: useState | FOUND |
| Zero hex literals in blocks/ | VERIFIED (grep returned 0 matches) |
| Zero any types in blocks/ | VERIFIED (grep returned 0 matches) |
| Task 1 commit 8a1bd1c in git log | FOUND |
| Task 2 commit 071005d in git log | FOUND |
| Task 3 commit a593084 in git log | FOUND |

---
*Phase: 05-central-cms*
*Completed: 2026-04-26*
