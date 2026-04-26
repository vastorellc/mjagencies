---
phase: 05-cms-block-library
plan: 03a
type: execute
wave: 2
depends_on:
  - "05-01"
  - "05-02"
files_modified:
  - packages/ui/src/blocks/hero/HeroImage/index.tsx
  - packages/ui/src/blocks/hero/HeroImage/types.ts
  - packages/ui/src/blocks/hero/HeroImage/stories.tsx
  - packages/ui/src/blocks/hero/HeroVideo/index.tsx
  - packages/ui/src/blocks/hero/HeroVideo/types.ts
  - packages/ui/src/blocks/hero/HeroVideo/stories.tsx
  - packages/ui/src/blocks/hero/HeroSplit/index.tsx
  - packages/ui/src/blocks/hero/HeroSplit/types.ts
  - packages/ui/src/blocks/hero/HeroSplit/stories.tsx
  - packages/ui/src/blocks/hero/HeroMinimal/index.tsx
  - packages/ui/src/blocks/hero/HeroMinimal/types.ts
  - packages/ui/src/blocks/hero/HeroMinimal/stories.tsx
  - packages/ui/src/blocks/content/RichText/index.tsx
  - packages/ui/src/blocks/content/RichText/types.ts
  - packages/ui/src/blocks/content/RichText/stories.tsx
  - packages/ui/src/blocks/content/TwoColumn/index.tsx
  - packages/ui/src/blocks/content/TwoColumn/types.ts
  - packages/ui/src/blocks/content/TwoColumn/stories.tsx
  - packages/ui/src/blocks/content/ThreeColumn/index.tsx
  - packages/ui/src/blocks/content/ThreeColumn/types.ts
  - packages/ui/src/blocks/content/ThreeColumn/stories.tsx
  - packages/ui/src/blocks/content/ImageText/index.tsx
  - packages/ui/src/blocks/content/ImageText/types.ts
  - packages/ui/src/blocks/content/ImageText/stories.tsx
  - packages/ui/src/blocks/content/TextImage/index.tsx
  - packages/ui/src/blocks/content/TextImage/types.ts
  - packages/ui/src/blocks/content/TextImage/stories.tsx
  - packages/ui/src/blocks/content/StatsBar/index.tsx
  - packages/ui/src/blocks/content/StatsBar/types.ts
  - packages/ui/src/blocks/content/StatsBar/stories.tsx
  - packages/ui/src/blocks/content/QuoteBlock/index.tsx
  - packages/ui/src/blocks/content/QuoteBlock/types.ts
  - packages/ui/src/blocks/content/QuoteBlock/stories.tsx
  - packages/ui/src/blocks/content/Timeline/index.tsx
  - packages/ui/src/blocks/content/Timeline/types.ts
  - packages/ui/src/blocks/content/Timeline/stories.tsx
  - packages/ui/src/blocks/cta/CtaFull/index.tsx
  - packages/ui/src/blocks/cta/CtaFull/types.ts
  - packages/ui/src/blocks/cta/CtaFull/stories.tsx
  - packages/ui/src/blocks/cta/CtaInline/index.tsx
  - packages/ui/src/blocks/cta/CtaInline/types.ts
  - packages/ui/src/blocks/cta/CtaInline/stories.tsx
  - packages/ui/src/blocks/cta/CtaCard/index.tsx
  - packages/ui/src/blocks/cta/CtaCard/types.ts
  - packages/ui/src/blocks/cta/CtaCard/stories.tsx
  - packages/ui/src/blocks/cta/CtaFloating/index.tsx
  - packages/ui/src/blocks/cta/CtaFloating/types.ts
  - packages/ui/src/blocks/cta/CtaFloating/stories.tsx
  - packages/ui/src/blocks/cta/NewsletterCta/index.tsx
  - packages/ui/src/blocks/cta/NewsletterCta/types.ts
  - packages/ui/src/blocks/cta/NewsletterCta/stories.tsx
autonomous: true
requirements:
  - REQ-052
  - REQ-047

must_haves:
  truths:
    - "17 Hero/Content/CTA block React components exist under packages/ui/src/blocks/<category>/<BlockName>/"
    - "Every block component uses only --mj-* CSS custom properties — zero hex literals"
    - "Every block has a types.ts file exporting its props interface"
    - "Every block has a stories.tsx file with at least one named story export"
  artifacts:
    - path: "packages/ui/src/blocks/hero/HeroImage/index.tsx"
      provides: "HeroImage block React component"
      contains: "var(--mj-"
    - path: "packages/ui/src/blocks/hero/HeroImage/types.ts"
      provides: "HeroImageProps interface"
      exports: ["HeroImageProps"]
    - path: "packages/ui/src/blocks/content/StatsBar/index.tsx"
      provides: "StatsBar block with stats array prop"
      contains: "var(--mj-"
    - path: "packages/ui/src/blocks/cta/CtaFull/index.tsx"
      provides: "CtaFull block with primaryCta prop"
      contains: "var(--mj-"
  key_links:
    - from: "packages/ui/src/blocks/hero/HeroImage/index.tsx"
      to: "packages/ui/tokens/"
      via: "--mj-* CSS variables"
      pattern: "var\\(--mj-"
    - from: "packages/ui/src/blocks/*/index.tsx"
      to: "packages/ui/src/blocks/*/types.ts"
      via: "import type"
      pattern: "import type.*types"
---

<objective>
Build 17 Hero (4), Content (8), and CTA (5) React block components in packages/ui/src/blocks/. Each block gets a types.ts (props interface), index.tsx (component), and stories.tsx (Storybook story). All CSS uses --mj-* tokens exclusively.

Purpose: These blocks are the first batch of visual units for the 12-agency platform. Plan 05-03c assembles the barrel export and Payload block configs after all three 03* plans complete.
Output: 17 block directories (51 files) across hero/, content/, and cta/ categories.
</objective>

<execution_context>
@C:/Users/jamshaid_pph/ClaudeMJ/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/jamshaid_pph/ClaudeMJ/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md

@mjagency/specs/cms.md
@packages/ui/src/index.ts

<interfaces>
<!-- CSS token rule — ALL blocks MUST use these, never hex literals (REQ-047, Phase 4 constraint) -->
```css
/* Color tokens */
--mj-color-brand-primary      /* primary brand color */
--mj-color-brand-secondary    /* secondary brand color */
--mj-color-accent             /* accent color */
--mj-color-text-primary       /* body text */
--mj-color-text-secondary     /* secondary text */
--mj-color-surface            /* card/panel backgrounds */
--mj-color-bg                 /* page background */
--mj-color-border             /* borders */
--mj-color-shadow-low         /* subtle shadow */

/* Typography tokens */
--mj-font-heading             /* heading font family */
--mj-font-body                /* body font family */
--mj-text-xs  --mj-text-sm  --mj-text-base  --mj-text-lg  --mj-text-xl
--mj-text-2xl  --mj-text-3xl  --mj-text-4xl  --mj-text-5xl

/* Spacing tokens */
--mj-space-1 through --mj-space-16   /* 4px increments */
--mj-radius-sm  --mj-radius-md  --mj-radius-lg  --mj-radius-full

/* Semantic tokens */
--mj-color-success  --mj-color-warning  --mj-color-danger  --mj-color-info
```

<!-- Block component standard structure -->
```typescript
// Every block follows this pattern:
// types.ts:
export interface BlockNameProps {
  className?: string
  // ... block-specific props (all strings/numbers/arrays — no React nodes in types.ts)
}

// index.tsx:
import type { BlockNameProps } from './types.js'
export const BlockName: React.FC<BlockNameProps> = ({ ...props }) => {
  // ALL inline style values use: style={{ color: 'var(--mj-color-text-primary)' }}
  // NEVER: style={{ color: '#1a1a1a' }}
  return <section>...</section>
}
export default BlockName

// stories.tsx:
import type { Meta, StoryObj } from '@storybook/react'
import { BlockName } from './index.js'
const meta: Meta<typeof BlockName> = { component: BlockName }
export default meta
type Story = StoryObj<typeof BlockName>
export const Default: Story = { args: { /* real non-placeholder values */ } }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build Hero blocks (4) — HeroImage, HeroVideo, HeroSplit, HeroMinimal</name>
  <files>
    packages/ui/src/blocks/hero/HeroImage/types.ts
    packages/ui/src/blocks/hero/HeroImage/index.tsx
    packages/ui/src/blocks/hero/HeroImage/stories.tsx
    packages/ui/src/blocks/hero/HeroVideo/types.ts
    packages/ui/src/blocks/hero/HeroVideo/index.tsx
    packages/ui/src/blocks/hero/HeroVideo/stories.tsx
    packages/ui/src/blocks/hero/HeroSplit/types.ts
    packages/ui/src/blocks/hero/HeroSplit/index.tsx
    packages/ui/src/blocks/hero/HeroSplit/stories.tsx
    packages/ui/src/blocks/hero/HeroMinimal/types.ts
    packages/ui/src/blocks/hero/HeroMinimal/index.tsx
    packages/ui/src/blocks/hero/HeroMinimal/stories.tsx
  </files>
  <read_first>
    - packages/ui/src/index.ts (understand existing token exports, no conflicts)
    - mjagency/specs/cms.md (45 BLOCKS — hero block names and required fields)
  </read_first>
  <action>
Create each block as a triplet: types.ts + index.tsx + stories.tsx.

**CRITICAL CSS RULE**: Every CSS value for color, font, spacing, or border-radius MUST use `var(--mj-*)`. NEVER hardcoded hex, rgb(), or hsl() values.

**CRITICAL CONTENT RULE (CLAUDE.md §5)**: All text must render from props — no hardcoded placeholder strings.

**TypeScript strict mode**: No `any` types. Explicit return types. `import type` for type-only imports.

**HeroImage** (packages/ui/src/blocks/hero/HeroImage/):
types.ts:
```typescript
export interface HeroImageProps {
  headline: string
  subheadline?: string
  ctaText?: string
  ctaHref?: string
  imageUrl: string
  imageAlt: string
  imageBlurHash?: string
  imageDominantColor?: string
  overlayOpacity?: number  // 0-1
  className?: string
}
```
index.tsx:
```typescript
'use client'
import type { HeroImageProps } from './types.js'

export const HeroImage: React.FC<HeroImageProps> = ({
  headline, subheadline, ctaText, ctaHref, imageUrl, imageAlt,
  imageBlurHash, imageDominantColor, overlayOpacity = 0.4, className = '',
}) => (
  <section
    className={`mj-block mj-block--hero-image ${className}`}
    style={{
      position: 'relative',
      backgroundColor: imageDominantColor ?? 'var(--mj-color-surface)',
      minHeight: '60vh',
    }}
  >
    <img
      src={imageUrl}
      alt={imageAlt}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      loading="eager"
      decoding="async"
    />
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        backgroundColor: 'var(--mj-color-bg)',
        opacity: overlayOpacity,
      }}
    />
    <div style={{ position: 'relative', zIndex: 1, padding: 'var(--mj-space-16)' }}>
      <h1 style={{ fontFamily: 'var(--mj-font-heading)', fontSize: 'var(--mj-text-5xl)', color: 'var(--mj-color-text-primary)' }}>
        {headline}
      </h1>
      {subheadline && (
        <p style={{ fontSize: 'var(--mj-text-xl)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-4)' }}>
          {subheadline}
        </p>
      )}
      {ctaText && ctaHref && (
        <a
          href={ctaHref}
          style={{
            display: 'inline-block',
            marginTop: 'var(--mj-space-8)',
            padding: 'var(--mj-space-3) var(--mj-space-6)',
            backgroundColor: 'var(--mj-color-brand-primary)',
            color: 'var(--mj-color-bg)',
            borderRadius: 'var(--mj-radius-md)',
            textDecoration: 'none',
            fontFamily: 'var(--mj-font-body)',
          }}
        >
          {ctaText}
        </a>
      )}
    </div>
  </section>
)
export default HeroImage
```

stories.tsx: Export a `Default` story with args: headline, imageUrl (use a real placeholder URL like 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200'), imageAlt.

**HeroVideo** props: videoUrl: string, videoPoster: string, posterAlt: string, headline: string, subheadline?: string, ctaText?: string, ctaHref?: string, className?: string.
Implementation: `<video>` element with poster, muted, loop, autoPlay, playsInline. Overlay + headline on top.

**HeroSplit** props: headline: string, subheadline?: string, ctaText?: string, ctaHref?: string, imageUrl: string, imageAlt: string, imagePosition?: 'left' | 'right', className?: string.
Implementation: flex row with text on one side, image on other. `flexDirection` based on imagePosition.

**HeroMinimal** props: headline: string, subheadline?: string, ctaText?: string, ctaHref?: string, className?: string.
Implementation: centered text section, no image. Uses `textAlign: 'center'` and `padding: 'var(--mj-space-16)'`.
  </action>
  <verify>
    <automated>cd /c/Users/jamshaid_pph/ClaudeMJ && pnpm --filter @mjagency/ui typecheck 2>&1 | grep -E "error|Error" | head -10</automated>
  </verify>
  <done>
    - 4 hero block directories created, each with types.ts + index.tsx + stories.tsx
    - grep -rn "var(--mj-" packages/ui/src/blocks/hero/HeroImage/index.tsx exits 0
    - grep -rn "#[0-9a-fA-F]{3,6}" packages/ui/src/blocks/hero/HeroImage/index.tsx exits 1 (no hex)
    - pnpm --filter @mjagency/ui typecheck reports 0 errors for hero blocks
  </done>
  <acceptance_criteria>
    - ls packages/ui/src/blocks/hero/ shows HeroImage HeroVideo HeroSplit HeroMinimal
    - grep -rn "var(--mj-" packages/ui/src/blocks/hero/HeroImage/index.tsx exits 0
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/hero exits 1 (no hex)
    - grep -rn "any" packages/ui/src/blocks/hero exits 1 (no any types)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Build Content blocks (8) — RichText, TwoColumn, ThreeColumn, ImageText, TextImage, StatsBar, QuoteBlock, Timeline</name>
  <files>
    packages/ui/src/blocks/content/RichText/types.ts
    packages/ui/src/blocks/content/RichText/index.tsx
    packages/ui/src/blocks/content/RichText/stories.tsx
    packages/ui/src/blocks/content/TwoColumn/types.ts
    packages/ui/src/blocks/content/TwoColumn/index.tsx
    packages/ui/src/blocks/content/TwoColumn/stories.tsx
    packages/ui/src/blocks/content/ThreeColumn/types.ts
    packages/ui/src/blocks/content/ThreeColumn/index.tsx
    packages/ui/src/blocks/content/ThreeColumn/stories.tsx
    packages/ui/src/blocks/content/ImageText/types.ts
    packages/ui/src/blocks/content/ImageText/index.tsx
    packages/ui/src/blocks/content/ImageText/stories.tsx
    packages/ui/src/blocks/content/TextImage/types.ts
    packages/ui/src/blocks/content/TextImage/index.tsx
    packages/ui/src/blocks/content/TextImage/stories.tsx
    packages/ui/src/blocks/content/StatsBar/types.ts
    packages/ui/src/blocks/content/StatsBar/index.tsx
    packages/ui/src/blocks/content/StatsBar/stories.tsx
    packages/ui/src/blocks/content/QuoteBlock/types.ts
    packages/ui/src/blocks/content/QuoteBlock/index.tsx
    packages/ui/src/blocks/content/QuoteBlock/stories.tsx
    packages/ui/src/blocks/content/Timeline/types.ts
    packages/ui/src/blocks/content/Timeline/index.tsx
    packages/ui/src/blocks/content/Timeline/stories.tsx
  </files>
  <action>
Create 8 content block triplets (types.ts + index.tsx + stories.tsx). Same CSS token and TypeScript rules as Task 1.

Props specs:
- **RichText**: content: React.ReactNode, className?: string. Simple wrapper `<div>` that renders its children.
- **TwoColumn**: leftContent: React.ReactNode, rightContent: React.ReactNode, gap?: string, className?: string. Flex row with `gap: gap ?? 'var(--mj-space-8)'`.
- **ThreeColumn**: columns: Array<{ content: React.ReactNode }>, className?: string. CSS grid with 3 columns.
- **ImageText**: imageUrl: string, imageAlt: string, imageBlurHash?: string, headline: string, body: React.ReactNode, imagePosition?: 'left' | 'right', className?: string. Flex row layout.
- **TextImage**: Same as ImageText but imagePosition defaults to 'right'.
- **StatsBar**: stats: Array<{ value: string; label: string; source?: string }>, className?: string. Flex row of stat items. `source` renders as a small `<cite>` below the label.
- **QuoteBlock**: quote: string, attribution: string, role?: string, avatarUrl?: string, avatarAlt?: string, className?: string. `<blockquote>` element with optional avatar.
- **Timeline**: items: Array<{ date: string; title: string; description: string }>, className?: string. Vertical list with date markers.

For stories.tsx on each: export a `Default` story with realistic args (e.g., StatsBar with 3 stats: {value: '30-45%', label: 'Revenue increase'}, etc.). No placeholder text per CLAUDE.md §5.
  </action>
  <verify>
    <automated>cd /c/Users/jamshaid_pph/ClaudeMJ && pnpm --filter @mjagency/ui typecheck 2>&1 | grep -E "error|Error" | head -10</automated>
  </verify>
  <done>
    - 8 content block directories created, each with types.ts + index.tsx + stories.tsx
    - ls packages/ui/src/blocks/content/ shows all 8 directories
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/content returns 0 (no hex)
    - pnpm --filter @mjagency/ui typecheck 0 errors
  </done>
  <acceptance_criteria>
    - ls packages/ui/src/blocks/content/ shows RichText TwoColumn ThreeColumn ImageText TextImage StatsBar QuoteBlock Timeline
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/content exits 1 (no hex literals)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Build CTA blocks (5) — CtaFull, CtaInline, CtaCard, CtaFloating, NewsletterCta</name>
  <files>
    packages/ui/src/blocks/cta/CtaFull/types.ts
    packages/ui/src/blocks/cta/CtaFull/index.tsx
    packages/ui/src/blocks/cta/CtaFull/stories.tsx
    packages/ui/src/blocks/cta/CtaInline/types.ts
    packages/ui/src/blocks/cta/CtaInline/index.tsx
    packages/ui/src/blocks/cta/CtaInline/stories.tsx
    packages/ui/src/blocks/cta/CtaCard/types.ts
    packages/ui/src/blocks/cta/CtaCard/index.tsx
    packages/ui/src/blocks/cta/CtaCard/stories.tsx
    packages/ui/src/blocks/cta/CtaFloating/types.ts
    packages/ui/src/blocks/cta/CtaFloating/index.tsx
    packages/ui/src/blocks/cta/CtaFloating/stories.tsx
    packages/ui/src/blocks/cta/NewsletterCta/types.ts
    packages/ui/src/blocks/cta/NewsletterCta/index.tsx
    packages/ui/src/blocks/cta/NewsletterCta/stories.tsx
  </files>
  <action>
Create 5 CTA block triplets. Same CSS token and TypeScript rules.

Props specs:
- **CtaFull**: headline: string, subheadline?: string, primaryCta: { text: string; href: string }, secondaryCta?: { text: string; href: string }, className?: string. Full-width banner with centered text and buttons.
- **CtaInline**: text: string, ctaText: string, ctaHref: string, className?: string. Single-line text + button, flex row.
- **CtaCard**: headline: string, body: string, ctaText: string, ctaHref: string, iconUrl?: string, iconAlt?: string, className?: string. Card with optional icon, headline, body, and a CTA button.
- **CtaFloating**: text: string, ctaText: string, ctaHref: string, position?: 'bottom-right' | 'bottom-left', className?: string. `position: 'fixed'`, `bottom: 'var(--mj-space-6)'`, `right/left: 'var(--mj-space-6)'`, `zIndex: 9000`. Add `'use client'` directive.
- **NewsletterCta**: headline: string, description: string, placeholder: string, submitText: string, disclaimer?: string, className?: string. Add `'use client'` — uses `useState` for the email input. Native `<form>` with `onSubmit` that prevents default and logs submission (server action wired in Phase 9). Renders disclaimer as `<small>` if provided.
  </action>
  <verify>
    <automated>cd /c/Users/jamshaid_pph/ClaudeMJ && pnpm --filter @mjagency/ui typecheck 2>&1 | grep -c "error" || echo "0"</automated>
  </verify>
  <done>
    - 5 CTA block directories created with types.ts + index.tsx + stories.tsx
    - CtaFloating uses position: 'fixed' and zIndex: 9000
    - NewsletterCta has 'use client' directive and useState
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/cta returns 0
    - pnpm --filter @mjagency/ui typecheck 0 errors
  </done>
  <acceptance_criteria>
    - ls packages/ui/src/blocks/cta/ shows CtaFull CtaInline CtaCard CtaFloating NewsletterCta
    - grep "position: 'fixed'" packages/ui/src/blocks/cta/CtaFloating/index.tsx exits 0
    - grep "zIndex: 9000" packages/ui/src/blocks/cta/CtaFloating/index.tsx exits 0
    - grep "'use client'" packages/ui/src/blocks/cta/NewsletterCta/index.tsx exits 0
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/cta exits 1 (no hex)
    - pnpm --filter @mjagency/ui typecheck exits 0
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| editor → block string props | String inputs rendered in JSX — must not allow XSS |
| CtaFloating | Fixed-position element rendered over page content |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-03a-01 | Tampering | block string inputs | mitigate | PUCK BUILDER RULES: all block components sanitize string inputs before rendering (CLAUDE.md puck rules) |
| T-05-03a-02 | Tampering | NewsletterCta form | accept | Form submission wired to server action in Phase 9 with full validation; Phase 5 only prevents default |
</threat_model>

<verification>
1. `ls packages/ui/src/blocks/hero/` shows HeroImage HeroVideo HeroSplit HeroMinimal
2. `ls packages/ui/src/blocks/content/` shows all 8 directories
3. `ls packages/ui/src/blocks/cta/` shows all 5 directories
4. `grep -rn "var(--mj-" packages/ui/src/blocks/hero/HeroImage/index.tsx` exits 0
5. `grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/` exits 1 (no hex literals)
6. `pnpm --filter @mjagency/ui typecheck` exits 0
</verification>

<success_criteria>
- 17 block components exist across hero/ (4), content/ (8), cta/ (5)
- Each block has types.ts + index.tsx + stories.tsx
- All components use only --mj-* CSS custom properties — zero hex literals
- TypeScript strict mode — no any types
- packages/ui typechecks clean
</success_criteria>

<output>
After completion, create `.planning/phases/05-cms-block-library/05-03a-SUMMARY.md`
</output>
