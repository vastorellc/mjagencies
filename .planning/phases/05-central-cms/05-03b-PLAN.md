---
phase: 05-cms-block-library
plan: 03b
type: execute
wave: 2
depends_on:
  - "05-01"
  - "05-02"
files_modified:
  - packages/ui/src/blocks/service/ServiceGrid/index.tsx
  - packages/ui/src/blocks/service/ServiceGrid/types.ts
  - packages/ui/src/blocks/service/ServiceGrid/stories.tsx
  - packages/ui/src/blocks/service/ServiceDetail/index.tsx
  - packages/ui/src/blocks/service/ServiceDetail/types.ts
  - packages/ui/src/blocks/service/ServiceDetail/stories.tsx
  - packages/ui/src/blocks/service/ProcessSteps/index.tsx
  - packages/ui/src/blocks/service/ProcessSteps/types.ts
  - packages/ui/src/blocks/service/ProcessSteps/stories.tsx
  - packages/ui/src/blocks/service/FeatureList/index.tsx
  - packages/ui/src/blocks/service/FeatureList/types.ts
  - packages/ui/src/blocks/service/FeatureList/stories.tsx
  - packages/ui/src/blocks/service/ComparisonTable/index.tsx
  - packages/ui/src/blocks/service/ComparisonTable/types.ts
  - packages/ui/src/blocks/service/ComparisonTable/stories.tsx
  - packages/ui/src/blocks/service/PricingTable/index.tsx
  - packages/ui/src/blocks/service/PricingTable/types.ts
  - packages/ui/src/blocks/service/PricingTable/stories.tsx
  - packages/ui/src/blocks/trust/ClientLogos/index.tsx
  - packages/ui/src/blocks/trust/ClientLogos/types.ts
  - packages/ui/src/blocks/trust/ClientLogos/stories.tsx
  - packages/ui/src/blocks/trust/TestimonialsGrid/index.tsx
  - packages/ui/src/blocks/trust/TestimonialsGrid/types.ts
  - packages/ui/src/blocks/trust/TestimonialsGrid/stories.tsx
  - packages/ui/src/blocks/trust/TestimonialsSlider/index.tsx
  - packages/ui/src/blocks/trust/TestimonialsSlider/types.ts
  - packages/ui/src/blocks/trust/TestimonialsSlider/stories.tsx
  - packages/ui/src/blocks/trust/CaseStudyCard/index.tsx
  - packages/ui/src/blocks/trust/CaseStudyCard/types.ts
  - packages/ui/src/blocks/trust/CaseStudyCard/stories.tsx
  - packages/ui/src/blocks/trust/AwardsBar/index.tsx
  - packages/ui/src/blocks/trust/AwardsBar/types.ts
  - packages/ui/src/blocks/trust/AwardsBar/stories.tsx
  - packages/ui/src/blocks/trust/TeamGrid/index.tsx
  - packages/ui/src/blocks/trust/TeamGrid/types.ts
  - packages/ui/src/blocks/trust/TeamGrid/stories.tsx
  - packages/ui/src/blocks/media/ImageGallery/index.tsx
  - packages/ui/src/blocks/media/ImageGallery/types.ts
  - packages/ui/src/blocks/media/ImageGallery/stories.tsx
  - packages/ui/src/blocks/media/VideoEmbed/index.tsx
  - packages/ui/src/blocks/media/VideoEmbed/types.ts
  - packages/ui/src/blocks/media/VideoEmbed/stories.tsx
  - packages/ui/src/blocks/media/VideoHero/index.tsx
  - packages/ui/src/blocks/media/VideoHero/types.ts
  - packages/ui/src/blocks/media/VideoHero/stories.tsx
  - packages/ui/src/blocks/media/PortfolioGrid/index.tsx
  - packages/ui/src/blocks/media/PortfolioGrid/types.ts
  - packages/ui/src/blocks/media/PortfolioGrid/stories.tsx
  - packages/ui/src/blocks/media/BeforeAfter/index.tsx
  - packages/ui/src/blocks/media/BeforeAfter/types.ts
  - packages/ui/src/blocks/media/BeforeAfter/stories.tsx
autonomous: true
requirements:
  - REQ-052
  - REQ-047

must_haves:
  truths:
    - "17 Service/Trust/Media block React components exist under packages/ui/src/blocks/<category>/<BlockName>/"
    - "Every block component uses only --mj-* CSS custom properties — zero hex literals"
    - "Every block has a types.ts file exporting its props interface"
    - "Every block has a stories.tsx file with at least one named story export"
    - "TestimonialsGrid and TestimonialsSlider render the disclaimer prop — REQ-421"
    - "VideoEmbed implements the facade pattern — no iframe on initial render"
  artifacts:
    - path: "packages/ui/src/blocks/trust/TestimonialsGrid/index.tsx"
      provides: "TestimonialsGrid with disclaimer prop rendered"
      contains: "disclaimer"
    - path: "packages/ui/src/blocks/media/VideoEmbed/index.tsx"
      provides: "VideoEmbed facade — renders poster+play, iframe only on click"
      contains: "useState"
    - path: "packages/ui/src/blocks/media/BeforeAfter/index.tsx"
      provides: "BeforeAfter slider with onMouseMove/onTouchMove"
      contains: "use client"
  key_links:
    - from: "packages/ui/src/blocks/trust/TestimonialsGrid/index.tsx"
      to: "REQ-421 FTC testimonial disclaimer"
      via: "disclaimer prop rendered as <p>"
      pattern: "disclaimer"
    - from: "packages/ui/src/blocks/media/VideoEmbed/index.tsx"
      to: "YouTube/Vimeo iframe"
      via: "user click triggers iframe load"
      pattern: "useState"
---

<objective>
Build 17 Service (6), Trust (6), and Media (5) React block components in packages/ui/src/blocks/. Each block gets types.ts + index.tsx + stories.tsx. Runs in parallel with 05-03a (no file conflicts).

Purpose: Second batch of visual building units. Parallel execution with 05-03a saves a full wave. Plan 05-03c assembles barrel exports and Payload configs after both complete.
Output: 17 block directories (51 files) across service/, trust/, and media/ categories.
</objective>

<execution_context>
@C:/Users/jamshaid_pph/ClaudeMJ/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/jamshaid_pph/ClaudeMJ/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md

@mjagency/specs/cms.md
@mjagency/specs/media.md

<interfaces>
<!-- CSS token rule — ALL blocks MUST use these, never hex literals (REQ-047, Phase 4 constraint) -->
```css
--mj-color-brand-primary  --mj-color-brand-secondary  --mj-color-accent
--mj-color-text-primary  --mj-color-text-secondary
--mj-color-surface  --mj-color-bg  --mj-color-border
--mj-font-heading  --mj-font-body
--mj-text-xs through --mj-text-5xl
--mj-space-1 through --mj-space-16
--mj-radius-sm  --mj-radius-md  --mj-radius-lg  --mj-radius-full
--mj-color-success  --mj-color-warning  --mj-color-danger
```

<!-- Standard block structure (same as 05-03a) -->
```typescript
// types.ts: export interface BlockNameProps { ... }
// index.tsx: import type; export const BlockName: React.FC<BlockNameProps> = ...
// stories.tsx: Meta + StoryObj + Default story with real args
```

<!-- REQ-421 FTC testimonial disclaimer — MANDATORY on testimonial blocks -->
// TestimonialsGrid and TestimonialsSlider MUST render the disclaimer prop.
// disclaimer prop is required (not optional) — string type.
// Rendered as: <p style={{ fontSize: 'var(--mj-text-xs)', color: 'var(--mj-color-text-secondary)' }}>{disclaimer}</p>

<!-- VideoEmbed facade pattern (specs/media.md) -->
// NO iframe on initial render — renders poster image + play button.
// On click: load iframe. Prevents ~600KB YouTube/Vimeo JS on page load.
// Must have 'use client' directive and useState(false) for loaded state.
```typescript
const [loaded, setLoaded] = useState(false)
if (!loaded) {
  return <div onClick={() => setLoaded(true)}> {/* poster + play button */} </div>
}
return <iframe src={...} title={title} allow="autoplay" />
```

<!-- BeforeAfter slider -->
// 'use client' + useState for slider position (0-100%).
// Drag divider with onMouseMove / onTouchMove.
// overflow: hidden container, two images absolutely positioned.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build Service blocks (6) — ServiceGrid, ServiceDetail, ProcessSteps, FeatureList, ComparisonTable, PricingTable</name>
  <files>
    packages/ui/src/blocks/service/ServiceGrid/types.ts
    packages/ui/src/blocks/service/ServiceGrid/index.tsx
    packages/ui/src/blocks/service/ServiceGrid/stories.tsx
    packages/ui/src/blocks/service/ServiceDetail/types.ts
    packages/ui/src/blocks/service/ServiceDetail/index.tsx
    packages/ui/src/blocks/service/ServiceDetail/stories.tsx
    packages/ui/src/blocks/service/ProcessSteps/types.ts
    packages/ui/src/blocks/service/ProcessSteps/index.tsx
    packages/ui/src/blocks/service/ProcessSteps/stories.tsx
    packages/ui/src/blocks/service/FeatureList/types.ts
    packages/ui/src/blocks/service/FeatureList/index.tsx
    packages/ui/src/blocks/service/FeatureList/stories.tsx
    packages/ui/src/blocks/service/ComparisonTable/types.ts
    packages/ui/src/blocks/service/ComparisonTable/index.tsx
    packages/ui/src/blocks/service/ComparisonTable/stories.tsx
    packages/ui/src/blocks/service/PricingTable/types.ts
    packages/ui/src/blocks/service/PricingTable/index.tsx
    packages/ui/src/blocks/service/PricingTable/stories.tsx
  </files>
  <action>
Create 6 service block triplets. All CSS via --mj-* tokens. No any types. No hex literals.

Props specs:
- **ServiceGrid**: items: Array<{ title: string; description: string; iconUrl?: string; iconAlt?: string; href?: string }>, columns?: 2 | 3, className?: string. CSS grid layout.
- **ServiceDetail**: title: string, description: React.ReactNode, iconUrl?: string, iconAlt?: string, features: string[], ctaText?: string, ctaHref?: string, className?: string. Feature checkmarks use Unicode ✓ or a styled span.
- **ProcessSteps**: steps: Array<{ step: number; title: string; description: string; iconUrl?: string }>, className?: string. Numbered vertical steps.
- **FeatureList**: headline: string, features: Array<{ title: string; description: string; included: boolean }>, className?: string. Table-like layout with included/excluded indicators.
- **ComparisonTable**: headline: string, headers: string[], rows: Array<{ feature: string; values: string[] }>, className?: string. `<table>` element with `<thead>` and `<tbody>`.
- **PricingTable**: plans: Array<{ name: string; price: string; period?: string; features: string[]; ctaText: string; ctaHref: string; highlighted?: boolean }>, className?: string. Highlighted plan uses `backgroundColor: 'var(--mj-color-brand-primary)'` and contrasting text.

Stories: each has a `Default` story with 2-3 realistic items. No placeholder text.
  </action>
  <verify>
    <automated>cd /c/Users/jamshaid_pph/ClaudeMJ && pnpm --filter @mjagency/ui typecheck 2>&1 | grep -E "error|Error" | head -10</automated>
  </verify>
  <done>
    - 6 service block directories created with types.ts + index.tsx + stories.tsx
    - ls packages/ui/src/blocks/service/ shows all 6 directories
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/service returns 0
  </done>
  <acceptance_criteria>
    - ls packages/ui/src/blocks/service/ shows ServiceGrid ServiceDetail ProcessSteps FeatureList ComparisonTable PricingTable
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/service exits 1 (no hex literals)
    - grep -rn "any" packages/ui/src/blocks/service exits 1 (no any types)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Build Trust blocks (6) — ClientLogos, TestimonialsGrid, TestimonialsSlider, CaseStudyCard, AwardsBar, TeamGrid</name>
  <files>
    packages/ui/src/blocks/trust/ClientLogos/types.ts
    packages/ui/src/blocks/trust/ClientLogos/index.tsx
    packages/ui/src/blocks/trust/ClientLogos/stories.tsx
    packages/ui/src/blocks/trust/TestimonialsGrid/types.ts
    packages/ui/src/blocks/trust/TestimonialsGrid/index.tsx
    packages/ui/src/blocks/trust/TestimonialsGrid/stories.tsx
    packages/ui/src/blocks/trust/TestimonialsSlider/types.ts
    packages/ui/src/blocks/trust/TestimonialsSlider/index.tsx
    packages/ui/src/blocks/trust/TestimonialsSlider/stories.tsx
    packages/ui/src/blocks/trust/CaseStudyCard/types.ts
    packages/ui/src/blocks/trust/CaseStudyCard/index.tsx
    packages/ui/src/blocks/trust/CaseStudyCard/stories.tsx
    packages/ui/src/blocks/trust/AwardsBar/types.ts
    packages/ui/src/blocks/trust/AwardsBar/index.tsx
    packages/ui/src/blocks/trust/AwardsBar/stories.tsx
    packages/ui/src/blocks/trust/TeamGrid/types.ts
    packages/ui/src/blocks/trust/TeamGrid/index.tsx
    packages/ui/src/blocks/trust/TeamGrid/stories.tsx
  </files>
  <action>
Create 6 trust block triplets.

Props specs:
- **ClientLogos**: headline?: string, logos: Array<{ imageUrl: string; imageAlt: string; href?: string }>, className?: string. Flex wrap row of logo images.
- **TestimonialsGrid**: testimonials: Array<{ quote: string; author: string; role?: string; company?: string; avatarUrl?: string; avatarAlt?: string }>, disclaimer: string (REQUIRED — NOT optional, REQ-421), className?: string. Grid of testimonial cards. disclaimer is rendered below the grid as `<p style={{ fontSize: 'var(--mj-text-xs)', color: 'var(--mj-color-text-secondary)' }}>{disclaimer}</p>`.
- **TestimonialsSlider**: Same props shape as TestimonialsGrid (testimonials array + required disclaimer string). Add `'use client'` for slider state. Simple previous/next button controls.
- **CaseStudyCard**: title: string, client: string, result: string, description: string, imageUrl?: string, imageAlt?: string, href?: string, className?: string. Card layout.
- **AwardsBar**: awards: Array<{ name: string; imageUrl: string; imageAlt: string; year?: string }>, className?: string. Horizontal row.
- **TeamGrid**: members: Array<{ name: string; role: string; bio?: string; imageUrl?: string; imageAlt?: string; linkedIn?: string }>, className?: string. Grid of member cards.

CRITICAL: TestimonialsGrid and TestimonialsSlider disclaimer prop is NOT optional — type string (not string | undefined). The disclaimer is always rendered. This is REQ-421 FTC compliance.
  </action>
  <verify>
    <automated>cd /c/Users/jamshaid_pph/ClaudeMJ && pnpm --filter @mjagency/ui typecheck 2>&1 | grep -E "error|Error" | head -10</automated>
  </verify>
  <done>
    - 6 trust block directories created
    - TestimonialsGrid has disclaimer: string (not optional) in types.ts
    - grep "disclaimer" packages/ui/src/blocks/trust/TestimonialsGrid/index.tsx exits 0
    - grep "disclaimer" packages/ui/src/blocks/trust/TestimonialsSlider/index.tsx exits 0
  </done>
  <acceptance_criteria>
    - ls packages/ui/src/blocks/trust/ shows ClientLogos TestimonialsGrid TestimonialsSlider CaseStudyCard AwardsBar TeamGrid
    - grep "disclaimer" packages/ui/src/blocks/trust/TestimonialsGrid/index.tsx exits 0
    - grep "disclaimer" packages/ui/src/blocks/trust/TestimonialsSlider/index.tsx exits 0
    - grep "disclaimer\?" packages/ui/src/blocks/trust/TestimonialsGrid/types.ts exits 1 (NOT optional — no ? on disclaimer)
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/trust exits 1 (no hex)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Build Media blocks (5) — ImageGallery, VideoEmbed, VideoHero, PortfolioGrid, BeforeAfter</name>
  <files>
    packages/ui/src/blocks/media/ImageGallery/types.ts
    packages/ui/src/blocks/media/ImageGallery/index.tsx
    packages/ui/src/blocks/media/ImageGallery/stories.tsx
    packages/ui/src/blocks/media/VideoEmbed/types.ts
    packages/ui/src/blocks/media/VideoEmbed/index.tsx
    packages/ui/src/blocks/media/VideoEmbed/stories.tsx
    packages/ui/src/blocks/media/VideoHero/types.ts
    packages/ui/src/blocks/media/VideoHero/index.tsx
    packages/ui/src/blocks/media/VideoHero/stories.tsx
    packages/ui/src/blocks/media/PortfolioGrid/types.ts
    packages/ui/src/blocks/media/PortfolioGrid/index.tsx
    packages/ui/src/blocks/media/PortfolioGrid/stories.tsx
    packages/ui/src/blocks/media/BeforeAfter/types.ts
    packages/ui/src/blocks/media/BeforeAfter/index.tsx
    packages/ui/src/blocks/media/BeforeAfter/stories.tsx
  </files>
  <action>
Create 5 media block triplets.

Props specs:
- **ImageGallery**: images: Array<{ url: string; alt: string; caption?: string; blurHash?: string }>, columns?: 2 | 3 | 4, className?: string. CSS grid.
- **VideoEmbed** (facade pattern per specs/media.md): videoId: string, platform: 'youtube' | 'vimeo', posterUrl: string, posterAlt: string, title: string, className?: string. Add `'use client'`. Use `useState(false)` for `loaded`. When not loaded: render poster image + play button overlay. When loaded: render iframe. YouTube iframe src: `https://www.youtube.com/embed/${videoId}?autoplay=1`. Vimeo: `https://player.vimeo.com/video/${videoId}?autoplay=1`. This facade prevents ~600KB third-party JS on initial page load.
- **VideoHero**: videoUrl: string, posterUrl: string, posterAlt: string, headline?: string, className?: string. `<video>` element always muted={true}, loop={true}, autoPlay={true}, playsInline={true}. No user control over mute/loop — these are hardcoded per specs/media.md. Overlay + optional headline.
- **PortfolioGrid**: items: Array<{ title: string; imageUrl: string; imageAlt: string; category?: string; href?: string }>, columns?: 2 | 3, className?: string. CSS grid of portfolio cards.
- **BeforeAfter**: beforeUrl: string, beforeAlt: string, afterUrl: string, afterAlt: string, headline?: string, className?: string. Add `'use client'`. `useState<number>(50)` for slider position. Container: `position: 'relative', overflow: 'hidden'`. Before image: full width. After image: `position: 'absolute', inset: 0`, clipped by `clipPath: 'inset(0 0 0 {position}%)'`. Divider bar: `position: 'absolute'`, vertical line, draggable with `onMouseDown`/`onMouseMove`/`onMouseUp`/`onTouchMove`.
  </action>
  <verify>
    <automated>cd /c/Users/jamshaid_pph/ClaudeMJ && pnpm --filter @mjagency/ui typecheck 2>&1 | grep -c "error" || echo "0"</automated>
  </verify>
  <done>
    - 5 media block directories created
    - VideoEmbed has useState for loaded state (facade pattern)
    - VideoHero has muted={true} hardcoded (not a prop)
    - BeforeAfter has 'use client' and useState for position
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/media returns 0
    - pnpm --filter @mjagency/ui typecheck 0 errors
  </done>
  <acceptance_criteria>
    - ls packages/ui/src/blocks/media/ shows ImageGallery VideoEmbed VideoHero PortfolioGrid BeforeAfter
    - grep "'use client'" packages/ui/src/blocks/media/VideoEmbed/index.tsx exits 0
    - grep "useState" packages/ui/src/blocks/media/VideoEmbed/index.tsx exits 0
    - grep "'use client'" packages/ui/src/blocks/media/BeforeAfter/index.tsx exits 0
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/media exits 1 (no hex)
    - pnpm --filter @mjagency/ui typecheck exits 0
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| VideoEmbed | YouTube/Vimeo iframe loaded on click — no third-party JS on initial page load |
| TestimonialsGrid/Slider | FTC disclaimer must render — missing disclaimer is a compliance violation |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-03b-01 | Information Disclosure | VideoEmbed | mitigate | Facade pattern — no YouTube/Vimeo iframe until user clicks (specs/media.md) |
| T-05-03b-02 | Tampering | block string inputs | mitigate | All block components sanitize string inputs before rendering (CLAUDE.md puck rules) |
| T-05-03b-03 | Tampering | TestimonialsGrid disclaimer | mitigate | disclaimer is required string prop — cannot be omitted without TypeScript error |
</threat_model>

<verification>
1. `ls packages/ui/src/blocks/service/` shows 6 directories
2. `ls packages/ui/src/blocks/trust/` shows 6 directories
3. `ls packages/ui/src/blocks/media/` shows 5 directories
4. `grep "disclaimer" packages/ui/src/blocks/trust/TestimonialsGrid/index.tsx` exits 0
5. `grep "useState" packages/ui/src/blocks/media/VideoEmbed/index.tsx` exits 0
6. `grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/` exits 1 (no hex literals across all blocks)
7. `pnpm --filter @mjagency/ui typecheck` exits 0
</verification>

<success_criteria>
- 17 block components exist across service/ (6), trust/ (6), media/ (5)
- Each block has types.ts + index.tsx + stories.tsx
- TestimonialsGrid and TestimonialsSlider have required (non-optional) disclaimer prop
- VideoEmbed implements facade pattern — no iframe on initial render
- All components use only --mj-* CSS custom properties — zero hex literals
- packages/ui typechecks clean
</success_criteria>

<output>
After completion, create `.planning/phases/05-cms-block-library/05-03b-SUMMARY.md`
</output>
