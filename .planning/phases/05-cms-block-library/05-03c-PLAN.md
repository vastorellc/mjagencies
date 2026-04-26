---
phase: 05-cms-block-library
plan: 03c
type: execute
wave: 3
depends_on:
  - "05-01"
  - "05-02"
  - "05-03a"
  - "05-03b"
files_modified:
  - packages/ui/src/blocks/blog/BlogGrid/index.tsx
  - packages/ui/src/blocks/blog/BlogGrid/types.ts
  - packages/ui/src/blocks/blog/BlogGrid/stories.tsx
  - packages/ui/src/blocks/blog/BlogFeatured/index.tsx
  - packages/ui/src/blocks/blog/BlogFeatured/types.ts
  - packages/ui/src/blocks/blog/BlogFeatured/stories.tsx
  - packages/ui/src/blocks/blog/BlogRelated/index.tsx
  - packages/ui/src/blocks/blog/BlogRelated/types.ts
  - packages/ui/src/blocks/blog/BlogRelated/stories.tsx
  - packages/ui/src/blocks/blog/AuthorBio/index.tsx
  - packages/ui/src/blocks/blog/AuthorBio/types.ts
  - packages/ui/src/blocks/blog/AuthorBio/stories.tsx
  - packages/ui/src/blocks/tool/ToolEmbed/index.tsx
  - packages/ui/src/blocks/tool/ToolEmbed/types.ts
  - packages/ui/src/blocks/tool/ToolEmbed/stories.tsx
  - packages/ui/src/blocks/tool/ToolResult/index.tsx
  - packages/ui/src/blocks/tool/ToolResult/types.ts
  - packages/ui/src/blocks/tool/ToolResult/stories.tsx
  - packages/ui/src/blocks/tool/ToolCta/index.tsx
  - packages/ui/src/blocks/tool/ToolCta/types.ts
  - packages/ui/src/blocks/tool/ToolCta/stories.tsx
  - packages/ui/src/blocks/form/ContactForm/index.tsx
  - packages/ui/src/blocks/form/ContactForm/types.ts
  - packages/ui/src/blocks/form/ContactForm/stories.tsx
  - packages/ui/src/blocks/form/NewsletterForm/index.tsx
  - packages/ui/src/blocks/form/NewsletterForm/types.ts
  - packages/ui/src/blocks/form/NewsletterForm/stories.tsx
  - packages/ui/src/blocks/utility/FaqAccordion/index.tsx
  - packages/ui/src/blocks/utility/FaqAccordion/types.ts
  - packages/ui/src/blocks/utility/FaqAccordion/stories.tsx
  - packages/ui/src/blocks/utility/Divider/index.tsx
  - packages/ui/src/blocks/utility/Divider/types.ts
  - packages/ui/src/blocks/utility/Divider/stories.tsx
  - packages/ui/src/blocks/index.ts
  - packages/cms/src/blocks/payload-blocks.ts
  - packages/ui/src/index.ts
autonomous: true
requirements:
  - REQ-052
  - REQ-047

must_haves:
  truths:
    - "11 Blog/Tool/Form/Utility block React components exist with types.ts + index.tsx + stories.tsx"
    - "packages/ui/src/blocks/index.ts barrel-exports all 45 blocks by name"
    - "packages/cms/src/blocks/payload-blocks.ts exports PAYLOAD_BLOCKS array with all 45 Payload Block configs"
    - "packages/ui/src/index.ts has export * from './blocks/index.js' (Phase 4 exports preserved)"
    - "All 45 blocks use only --mj-* CSS tokens — zero hex literals"
  artifacts:
    - path: "packages/ui/src/blocks/index.ts"
      provides: "Barrel export for all 45 block components"
      contains: "HeroImage"
    - path: "packages/cms/src/blocks/payload-blocks.ts"
      provides: "Payload 3.82.1 Block[] config for all 45 blocks"
      exports: ["PAYLOAD_BLOCKS"]
    - path: "packages/ui/src/blocks/blog/BlogGrid/index.tsx"
      provides: "BlogGrid block React component"
      contains: "var(--mj-"
    - path: "packages/ui/src/blocks/utility/FaqAccordion/index.tsx"
      provides: "FaqAccordion using <details>/<summary>"
      contains: "details"
  key_links:
    - from: "packages/ui/src/blocks/index.ts"
      to: "packages/ui/src/blocks/*/index.tsx"
      via: "named re-exports"
      pattern: "export \\{ .* \\} from"
    - from: "packages/cms/src/blocks/payload-blocks.ts"
      to: "packages/ui/src/blocks/*/types.ts"
      via: "slug matching block component names"
      pattern: "PAYLOAD_BLOCKS"
---

<objective>
Build the final 11 blocks (Blog 4, Tool 3, Form 2, Utility 2), then assemble the barrel export (packages/ui/src/blocks/index.ts exporting all 45) and all 45 Payload block configs (packages/cms/src/blocks/payload-blocks.ts). This plan completes the full 45-block library.

Purpose: 05-04 depends on PAYLOAD_BLOCKS from this plan's output. Running in Wave 3 ensures 05-03a and 05-03b have completed all block implementations before the barrel + Payload config are assembled.
Output: 11 new block triplets, blocks/index.ts barrel (all 45), payload-blocks.ts (all 45 Payload configs).
</objective>

<execution_context>
@C:/Users/jamshaid_pph/ClaudeMJ/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/jamshaid_pph/ClaudeMJ/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md

@mjagency/specs/cms.md
@packages/ui/src/index.ts
@.planning/phases/05-cms-block-library/05-03a-SUMMARY.md
@.planning/phases/05-cms-block-library/05-03b-SUMMARY.md

<interfaces>
<!-- After 05-03a and 05-03b complete, these exports exist: -->
<!-- Hero: HeroImage, HeroVideo, HeroSplit, HeroMinimal -->
<!-- Content: RichText, TwoColumn, ThreeColumn, ImageText, TextImage, StatsBar, QuoteBlock, Timeline -->
<!-- CTA: CtaFull, CtaInline, CtaCard, CtaFloating, NewsletterCta -->
<!-- Service: ServiceGrid, ServiceDetail, ProcessSteps, FeatureList, ComparisonTable, PricingTable -->
<!-- Trust: ClientLogos, TestimonialsGrid, TestimonialsSlider, CaseStudyCard, AwardsBar, TeamGrid -->
<!-- Media: ImageGallery, VideoEmbed, VideoHero, PortfolioGrid, BeforeAfter -->

<!-- Payload 3.82.1 Block config structure -->
```typescript
import type { Block } from 'payload'
const ExampleBlock: Block = {
  slug: 'hero-image',      // kebab-case, matches component name
  labels: { singular: 'Hero Image', plural: 'Hero Images' },
  fields: [
    { name: 'headline', type: 'text', required: true },
    { name: 'image', type: 'upload', relationTo: 'media_assets' },
  ],
}
```
<!-- All image/video fields use relationTo: 'media_assets' -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build Blog (4), Tool (3), Form (2), Utility (2) blocks — 11 blocks total</name>
  <files>
    packages/ui/src/blocks/blog/BlogGrid/types.ts
    packages/ui/src/blocks/blog/BlogGrid/index.tsx
    packages/ui/src/blocks/blog/BlogGrid/stories.tsx
    packages/ui/src/blocks/blog/BlogFeatured/types.ts
    packages/ui/src/blocks/blog/BlogFeatured/index.tsx
    packages/ui/src/blocks/blog/BlogFeatured/stories.tsx
    packages/ui/src/blocks/blog/BlogRelated/types.ts
    packages/ui/src/blocks/blog/BlogRelated/index.tsx
    packages/ui/src/blocks/blog/BlogRelated/stories.tsx
    packages/ui/src/blocks/blog/AuthorBio/types.ts
    packages/ui/src/blocks/blog/AuthorBio/index.tsx
    packages/ui/src/blocks/blog/AuthorBio/stories.tsx
    packages/ui/src/blocks/tool/ToolEmbed/types.ts
    packages/ui/src/blocks/tool/ToolEmbed/index.tsx
    packages/ui/src/blocks/tool/ToolEmbed/stories.tsx
    packages/ui/src/blocks/tool/ToolResult/types.ts
    packages/ui/src/blocks/tool/ToolResult/index.tsx
    packages/ui/src/blocks/tool/ToolResult/stories.tsx
    packages/ui/src/blocks/tool/ToolCta/types.ts
    packages/ui/src/blocks/tool/ToolCta/index.tsx
    packages/ui/src/blocks/tool/ToolCta/stories.tsx
    packages/ui/src/blocks/form/ContactForm/types.ts
    packages/ui/src/blocks/form/ContactForm/index.tsx
    packages/ui/src/blocks/form/ContactForm/stories.tsx
    packages/ui/src/blocks/form/NewsletterForm/types.ts
    packages/ui/src/blocks/form/NewsletterForm/index.tsx
    packages/ui/src/blocks/form/NewsletterForm/stories.tsx
    packages/ui/src/blocks/utility/FaqAccordion/types.ts
    packages/ui/src/blocks/utility/FaqAccordion/index.tsx
    packages/ui/src/blocks/utility/FaqAccordion/stories.tsx
    packages/ui/src/blocks/utility/Divider/types.ts
    packages/ui/src/blocks/utility/Divider/index.tsx
    packages/ui/src/blocks/utility/Divider/stories.tsx
  </files>
  <action>
Create 11 block triplets (types.ts + index.tsx + stories.tsx). Same CSS token and TypeScript rules as 05-03a/05-03b.

Props specs:

Blog blocks:
- **BlogGrid**: posts: Array<{ title: string; slug: string; excerpt: string; publishedAt: string; authorName?: string; imageUrl?: string; imageAlt?: string }>, columns?: 2 | 3, className?: string.
- **BlogFeatured**: post: { title: string; slug: string; excerpt: string; publishedAt: string; authorName: string; imageUrl: string; imageAlt: string; blurHash?: string }, className?: string. Large featured card layout.
- **BlogRelated**: posts: Array<{ title: string; slug: string; excerpt: string; imageUrl?: string; imageAlt?: string }>, headline?: string, className?: string. Smaller card list.
- **AuthorBio**: name: string, bio: string, role?: string, imageUrl?: string, imageAlt?: string, socialLinks?: Array<{ platform: string; href: string }>, className?: string. Profile card.

Tool blocks (tool result URLs are inline only — REQ-413):
- **ToolEmbed**: toolSlug: string, toolTitle: string, headline?: string, description?: string, className?: string. Container section that displays the tool UI inline (Phase 9 wires the actual tool component).
- **ToolResult**: resultHtml: string, disclaimer?: string, className?: string. Renders result inline via `dangerouslySetInnerHTML={{ __html: resultHtml }}` — add comment: `{/* TODO Phase 10: replace dangerouslySetInnerHTML with sanitized renderer */}`. Renders disclaimer if provided.
- **ToolCta**: toolSlug: string, toolTitle: string, description: string, ctaText: string, className?: string. CTA card to start a tool.

Form blocks:
- **ContactForm**: formId: string, headline?: string, description?: string, submitText?: string, className?: string. Add `'use client'`. Native HTML `<form>` with name, email, message fields. `onSubmit` prevents default and console.logs (server action wired Phase 9). useState for submitted state.
- **NewsletterForm**: formId: string, headline?: string, description?: string, submitText?: string, disclaimer?: string, className?: string. Add `'use client'`. Email input + submit. disclaimer rendered as `<small>` if provided.

Utility blocks:
- **FaqAccordion**: headline?: string, items: Array<{ question: string; answer: string }>, className?: string. Use native `<details>/<summary>` HTML — no JavaScript needed. `<summary>` contains the question; content inside `<details>` is the answer. Styled with --mj-* tokens.
- **Divider**: style?: 'line' | 'space' | 'ornament', size?: 'sm' | 'md' | 'lg', className?: string. 'line' = `<hr>` with border-color token. 'space' = `<div>` with margin. 'ornament' = `<div>` with a decorative separator using CSS border patterns and token colors.
  </action>
  <verify>
    <automated>cd /c/Users/jamshaid_pph/ClaudeMJ && pnpm --filter @mjagency/ui typecheck 2>&1 | grep -E "error|Error" | head -10</automated>
  </verify>
  <done>
    - 11 block directories created across blog/, tool/, form/, utility/
    - FaqAccordion uses <details>/<summary> (no JavaScript)
    - ContactForm and NewsletterForm have 'use client' directive
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/blog returns 0
    - pnpm --filter @mjagency/ui typecheck 0 errors
  </done>
  <acceptance_criteria>
    - ls packages/ui/src/blocks/blog/ shows BlogGrid BlogFeatured BlogRelated AuthorBio
    - ls packages/ui/src/blocks/tool/ shows ToolEmbed ToolResult ToolCta
    - ls packages/ui/src/blocks/form/ shows ContactForm NewsletterForm
    - ls packages/ui/src/blocks/utility/ shows FaqAccordion Divider
    - grep "details" packages/ui/src/blocks/utility/FaqAccordion/index.tsx exits 0
    - grep "'use client'" packages/ui/src/blocks/form/ContactForm/index.tsx exits 0
    - grep -rn "#[0-9a-fA-F]" packages/ui/src/blocks/blog exits 1 (no hex)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Create barrel export (blocks/index.ts) and Payload block configs (payload-blocks.ts); wire into packages/ui/src/index.ts</name>
  <files>
    packages/ui/src/blocks/index.ts
    packages/cms/src/blocks/payload-blocks.ts
    packages/ui/src/index.ts
  </files>
  <read_first>
    - packages/ui/src/index.ts (current exports from Phase 4 — MUST NOT overwrite these; only append)
    - packages/cms/src/collections/media-assets.ts (media_assets slug — used in upload field configs)
  </read_first>
  <action>
1. Create packages/ui/src/blocks/index.ts — barrel export for all 45 blocks:
```typescript
// Hero blocks (4)
export { HeroImage } from './hero/HeroImage/index.js'
export { HeroVideo } from './hero/HeroVideo/index.js'
export { HeroSplit } from './hero/HeroSplit/index.js'
export { HeroMinimal } from './hero/HeroMinimal/index.js'
// Content blocks (8)
export { RichText } from './content/RichText/index.js'
export { TwoColumn } from './content/TwoColumn/index.js'
export { ThreeColumn } from './content/ThreeColumn/index.js'
export { ImageText } from './content/ImageText/index.js'
export { TextImage } from './content/TextImage/index.js'
export { StatsBar } from './content/StatsBar/index.js'
export { QuoteBlock } from './content/QuoteBlock/index.js'
export { Timeline } from './content/Timeline/index.js'
// CTA blocks (5)
export { CtaFull } from './cta/CtaFull/index.js'
export { CtaInline } from './cta/CtaInline/index.js'
export { CtaCard } from './cta/CtaCard/index.js'
export { CtaFloating } from './cta/CtaFloating/index.js'
export { NewsletterCta } from './cta/NewsletterCta/index.js'
// Service blocks (6)
export { ServiceGrid } from './service/ServiceGrid/index.js'
export { ServiceDetail } from './service/ServiceDetail/index.js'
export { ProcessSteps } from './service/ProcessSteps/index.js'
export { FeatureList } from './service/FeatureList/index.js'
export { ComparisonTable } from './service/ComparisonTable/index.js'
export { PricingTable } from './service/PricingTable/index.js'
// Trust blocks (6)
export { ClientLogos } from './trust/ClientLogos/index.js'
export { TestimonialsGrid } from './trust/TestimonialsGrid/index.js'
export { TestimonialsSlider } from './trust/TestimonialsSlider/index.js'
export { CaseStudyCard } from './trust/CaseStudyCard/index.js'
export { AwardsBar } from './trust/AwardsBar/index.js'
export { TeamGrid } from './trust/TeamGrid/index.js'
// Media blocks (5)
export { ImageGallery } from './media/ImageGallery/index.js'
export { VideoEmbed } from './media/VideoEmbed/index.js'
export { VideoHero } from './media/VideoHero/index.js'
export { PortfolioGrid } from './media/PortfolioGrid/index.js'
export { BeforeAfter } from './media/BeforeAfter/index.js'
// Blog blocks (4)
export { BlogGrid } from './blog/BlogGrid/index.js'
export { BlogFeatured } from './blog/BlogFeatured/index.js'
export { BlogRelated } from './blog/BlogRelated/index.js'
export { AuthorBio } from './blog/AuthorBio/index.js'
// Tool blocks (3)
export { ToolEmbed } from './tool/ToolEmbed/index.js'
export { ToolResult } from './tool/ToolResult/index.js'
export { ToolCta } from './tool/ToolCta/index.js'
// Form blocks (2)
export { ContactForm } from './form/ContactForm/index.js'
export { NewsletterForm } from './form/NewsletterForm/index.js'
// Utility blocks (2)
export { FaqAccordion } from './utility/FaqAccordion/index.js'
export { Divider } from './utility/Divider/index.js'
```

2. Create packages/cms/src/blocks/payload-blocks.ts — all 45 Payload Block configs:
```typescript
/**
 * packages/cms/src/blocks/payload-blocks.ts
 * Payload 3.82.1 Block configurations for all 45 CMS blocks (REQ-052).
 * Used by Plan 05-04's buildPayloadConfig() via BlocksFeature({ blocks: PAYLOAD_BLOCKS }).
 */
import type { Block } from 'payload'

// Define one Block config per block. slug is kebab-case matching component name.
// All image/video fields use relationTo: 'media_assets'.
// Only include fields editors set — computed fields (blurHash, dominant_color) are excluded.

// Hero blocks (4)
const heroImageBlock: Block = {
  slug: 'hero-image',
  labels: { singular: 'Hero Image', plural: 'Hero Images' },
  fields: [
    { name: 'headline', type: 'text', required: true },
    { name: 'subheadline', type: 'text' },
    { name: 'cta_text', type: 'text' },
    { name: 'cta_href', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media_assets', required: true },
    { name: 'overlay_opacity', type: 'number', defaultValue: 0.4, min: 0, max: 1 },
  ],
}
const heroVideoBlock: Block = {
  slug: 'hero-video',
  labels: { singular: 'Hero Video', plural: 'Hero Videos' },
  fields: [
    { name: 'headline', type: 'text', required: true },
    { name: 'subheadline', type: 'text' },
    { name: 'cta_text', type: 'text' },
    { name: 'cta_href', type: 'text' },
    { name: 'video', type: 'upload', relationTo: 'media_assets', required: true },
    { name: 'poster', type: 'upload', relationTo: 'media_assets' },
  ],
}
const heroSplitBlock: Block = {
  slug: 'hero-split',
  labels: { singular: 'Hero Split', plural: 'Hero Splits' },
  fields: [
    { name: 'headline', type: 'text', required: true },
    { name: 'subheadline', type: 'text' },
    { name: 'cta_text', type: 'text' },
    { name: 'cta_href', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media_assets', required: true },
    { name: 'image_position', type: 'select', defaultValue: 'right', options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }] },
  ],
}
const heroMinimalBlock: Block = {
  slug: 'hero-minimal',
  labels: { singular: 'Hero Minimal', plural: 'Hero Minimals' },
  fields: [
    { name: 'headline', type: 'text', required: true },
    { name: 'subheadline', type: 'text' },
    { name: 'cta_text', type: 'text' },
    { name: 'cta_href', type: 'text' },
  ],
}

// Content blocks (8)
const richTextBlock: Block = { slug: 'rich-text', labels: { singular: 'Rich Text', plural: 'Rich Text' }, fields: [{ name: 'content', type: 'richText', required: true }] }
const twoColumnBlock: Block = { slug: 'two-column', labels: { singular: 'Two Column', plural: 'Two Columns' }, fields: [{ name: 'left_content', type: 'richText', required: true }, { name: 'right_content', type: 'richText', required: true }] }
const threeColumnBlock: Block = { slug: 'three-column', labels: { singular: 'Three Column', plural: 'Three Columns' }, fields: [{ name: 'columns', type: 'array', fields: [{ name: 'content', type: 'richText', required: true }], minRows: 3, maxRows: 3 }] }
const imageTextBlock: Block = { slug: 'image-text', labels: { singular: 'Image + Text', plural: 'Image + Text' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'body', type: 'richText', required: true }, { name: 'image', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'image_position', type: 'select', defaultValue: 'left', options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }] }] }
const textImageBlock: Block = { slug: 'text-image', labels: { singular: 'Text + Image', plural: 'Text + Image' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'body', type: 'richText', required: true }, { name: 'image', type: 'upload', relationTo: 'media_assets', required: true }] }
const statsBarBlock: Block = { slug: 'stats-bar', labels: { singular: 'Stats Bar', plural: 'Stats Bars' }, fields: [{ name: 'stats', type: 'array', fields: [{ name: 'value', type: 'text', required: true }, { name: 'label', type: 'text', required: true }, { name: 'source', type: 'text' }], minRows: 1 }] }
const quoteBlock: Block = { slug: 'quote-block', labels: { singular: 'Quote Block', plural: 'Quote Blocks' }, fields: [{ name: 'quote', type: 'textarea', required: true }, { name: 'attribution', type: 'text', required: true }, { name: 'role', type: 'text' }, { name: 'avatar', type: 'upload', relationTo: 'media_assets' }] }
const timelineBlock: Block = { slug: 'timeline', labels: { singular: 'Timeline', plural: 'Timelines' }, fields: [{ name: 'items', type: 'array', fields: [{ name: 'date', type: 'text', required: true }, { name: 'title', type: 'text', required: true }, { name: 'description', type: 'textarea', required: true }], minRows: 1 }] }

// CTA blocks (5)
const ctaFullBlock: Block = { slug: 'cta-full', labels: { singular: 'CTA Full', plural: 'CTA Full' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'subheadline', type: 'text' }, { name: 'primary_cta_text', type: 'text', required: true }, { name: 'primary_cta_href', type: 'text', required: true }, { name: 'secondary_cta_text', type: 'text' }, { name: 'secondary_cta_href', type: 'text' }] }
const ctaInlineBlock: Block = { slug: 'cta-inline', labels: { singular: 'CTA Inline', plural: 'CTA Inline' }, fields: [{ name: 'text', type: 'text', required: true }, { name: 'cta_text', type: 'text', required: true }, { name: 'cta_href', type: 'text', required: true }] }
const ctaCardBlock: Block = { slug: 'cta-card', labels: { singular: 'CTA Card', plural: 'CTA Cards' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'body', type: 'textarea', required: true }, { name: 'cta_text', type: 'text', required: true }, { name: 'cta_href', type: 'text', required: true }, { name: 'icon', type: 'upload', relationTo: 'media_assets' }] }
const ctaFloatingBlock: Block = { slug: 'cta-floating', labels: { singular: 'CTA Floating', plural: 'CTA Floating' }, fields: [{ name: 'text', type: 'text', required: true }, { name: 'cta_text', type: 'text', required: true }, { name: 'cta_href', type: 'text', required: true }, { name: 'position', type: 'select', defaultValue: 'bottom-right', options: [{ label: 'Bottom Right', value: 'bottom-right' }, { label: 'Bottom Left', value: 'bottom-left' }] }] }
const newsletterCtaBlock: Block = { slug: 'newsletter-cta', labels: { singular: 'Newsletter CTA', plural: 'Newsletter CTAs' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'description', type: 'textarea' }, { name: 'placeholder', type: 'text', defaultValue: 'Enter your email' }, { name: 'submit_text', type: 'text', defaultValue: 'Subscribe' }, { name: 'disclaimer', type: 'text' }] }

// Service blocks (6)
const serviceGridBlock: Block = { slug: 'service-grid', labels: { singular: 'Service Grid', plural: 'Service Grids' }, fields: [{ name: 'items', type: 'array', fields: [{ name: 'title', type: 'text', required: true }, { name: 'description', type: 'textarea', required: true }, { name: 'icon', type: 'upload', relationTo: 'media_assets' }, { name: 'href', type: 'text' }], minRows: 1 }, { name: 'columns', type: 'select', defaultValue: '3', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }] }] }
const serviceDetailBlock: Block = { slug: 'service-detail', labels: { singular: 'Service Detail', plural: 'Service Details' }, fields: [{ name: 'title', type: 'text', required: true }, { name: 'description', type: 'richText', required: true }, { name: 'features', type: 'array', fields: [{ name: 'feature', type: 'text', required: true }] }, { name: 'cta_text', type: 'text' }, { name: 'cta_href', type: 'text' }, { name: 'icon', type: 'upload', relationTo: 'media_assets' }] }
const processStepsBlock: Block = { slug: 'process-steps', labels: { singular: 'Process Steps', plural: 'Process Steps' }, fields: [{ name: 'steps', type: 'array', fields: [{ name: 'step', type: 'number', required: true }, { name: 'title', type: 'text', required: true }, { name: 'description', type: 'textarea', required: true }, { name: 'icon', type: 'upload', relationTo: 'media_assets' }], minRows: 1 }] }
const featureListBlock: Block = { slug: 'feature-list', labels: { singular: 'Feature List', plural: 'Feature Lists' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'features', type: 'array', fields: [{ name: 'title', type: 'text', required: true }, { name: 'description', type: 'textarea', required: true }, { name: 'included', type: 'checkbox', defaultValue: true }], minRows: 1 }] }
const comparisonTableBlock: Block = { slug: 'comparison-table', labels: { singular: 'Comparison Table', plural: 'Comparison Tables' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'headers', type: 'array', fields: [{ name: 'header', type: 'text', required: true }], minRows: 2 }, { name: 'rows', type: 'array', fields: [{ name: 'feature', type: 'text', required: true }, { name: 'values', type: 'array', fields: [{ name: 'value', type: 'text', required: true }] }], minRows: 1 }] }
const pricingTableBlock: Block = { slug: 'pricing-table', labels: { singular: 'Pricing Table', plural: 'Pricing Tables' }, fields: [{ name: 'plans', type: 'array', fields: [{ name: 'name', type: 'text', required: true }, { name: 'price', type: 'text', required: true }, { name: 'period', type: 'text' }, { name: 'features', type: 'array', fields: [{ name: 'feature', type: 'text', required: true }] }, { name: 'cta_text', type: 'text', required: true }, { name: 'cta_href', type: 'text', required: true }, { name: 'highlighted', type: 'checkbox', defaultValue: false }], minRows: 1 }] }

// Trust blocks (6)
const clientLogosBlock: Block = { slug: 'client-logos', labels: { singular: 'Client Logos', plural: 'Client Logos' }, fields: [{ name: 'headline', type: 'text' }, { name: 'logos', type: 'array', fields: [{ name: 'image', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'href', type: 'text' }], minRows: 1 }] }
const testimonialsGridBlock: Block = { slug: 'testimonials-grid', labels: { singular: 'Testimonials Grid', plural: 'Testimonials Grids' }, fields: [{ name: 'testimonials', type: 'array', fields: [{ name: 'quote', type: 'textarea', required: true }, { name: 'author', type: 'text', required: true }, { name: 'role', type: 'text' }, { name: 'company', type: 'text' }, { name: 'avatar', type: 'upload', relationTo: 'media_assets' }], minRows: 1 }, { name: 'disclaimer', type: 'text', required: true, defaultValue: 'Individual results may vary. Testimonials are not necessarily representative of all users.' }] }
const testimonialsSliderBlock: Block = { slug: 'testimonials-slider', labels: { singular: 'Testimonials Slider', plural: 'Testimonials Sliders' }, fields: [{ name: 'testimonials', type: 'array', fields: [{ name: 'quote', type: 'textarea', required: true }, { name: 'author', type: 'text', required: true }, { name: 'role', type: 'text' }, { name: 'company', type: 'text' }, { name: 'avatar', type: 'upload', relationTo: 'media_assets' }], minRows: 1 }, { name: 'disclaimer', type: 'text', required: true, defaultValue: 'Individual results may vary. Testimonials are not necessarily representative of all users.' }] }
const caseStudyCardBlock: Block = { slug: 'case-study-card', labels: { singular: 'Case Study Card', plural: 'Case Study Cards' }, fields: [{ name: 'title', type: 'text', required: true }, { name: 'client', type: 'text', required: true }, { name: 'result', type: 'text', required: true }, { name: 'description', type: 'textarea', required: true }, { name: 'image', type: 'upload', relationTo: 'media_assets' }, { name: 'href', type: 'text' }] }
const awardsBarBlock: Block = { slug: 'awards-bar', labels: { singular: 'Awards Bar', plural: 'Awards Bars' }, fields: [{ name: 'awards', type: 'array', fields: [{ name: 'name', type: 'text', required: true }, { name: 'image', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'year', type: 'text' }], minRows: 1 }] }
const teamGridBlock: Block = { slug: 'team-grid', labels: { singular: 'Team Grid', plural: 'Team Grids' }, fields: [{ name: 'members', type: 'array', fields: [{ name: 'name', type: 'text', required: true }, { name: 'role', type: 'text', required: true }, { name: 'bio', type: 'textarea' }, { name: 'image', type: 'upload', relationTo: 'media_assets' }, { name: 'linked_in', type: 'text' }], minRows: 1 }] }

// Media blocks (5)
const imageGalleryBlock: Block = { slug: 'image-gallery', labels: { singular: 'Image Gallery', plural: 'Image Galleries' }, fields: [{ name: 'images', type: 'array', fields: [{ name: 'image', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'caption', type: 'text' }], minRows: 1 }, { name: 'columns', type: 'select', defaultValue: '3', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }] }] }
const videoEmbedBlock: Block = { slug: 'video-embed', labels: { singular: 'Video Embed', plural: 'Video Embeds' }, fields: [{ name: 'video_id', type: 'text', required: true }, { name: 'platform', type: 'select', required: true, options: [{ label: 'YouTube', value: 'youtube' }, { label: 'Vimeo', value: 'vimeo' }] }, { name: 'poster', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'title', type: 'text', required: true }] }
const videoHeroBlock: Block = { slug: 'video-hero', labels: { singular: 'Video Hero', plural: 'Video Heroes' }, fields: [{ name: 'video', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'poster', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'headline', type: 'text' }] }
const portfolioGridBlock: Block = { slug: 'portfolio-grid', labels: { singular: 'Portfolio Grid', plural: 'Portfolio Grids' }, fields: [{ name: 'items', type: 'array', fields: [{ name: 'title', type: 'text', required: true }, { name: 'image', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'category', type: 'text' }, { name: 'href', type: 'text' }], minRows: 1 }, { name: 'columns', type: 'select', defaultValue: '3', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }] }] }
const beforeAfterBlock: Block = { slug: 'before-after', labels: { singular: 'Before / After', plural: 'Before / After' }, fields: [{ name: 'before_image', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'after_image', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'headline', type: 'text' }] }

// Blog blocks (4)
const blogGridBlock: Block = { slug: 'blog-grid', labels: { singular: 'Blog Grid', plural: 'Blog Grids' }, fields: [{ name: 'posts', type: 'relationship', relationTo: 'posts', hasMany: true }, { name: 'columns', type: 'select', defaultValue: '3', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }] }] }
const blogFeaturedBlock: Block = { slug: 'blog-featured', labels: { singular: 'Blog Featured', plural: 'Blog Featured' }, fields: [{ name: 'post', type: 'relationship', relationTo: 'posts', required: true }] }
const blogRelatedBlock: Block = { slug: 'blog-related', labels: { singular: 'Blog Related', plural: 'Blog Related' }, fields: [{ name: 'posts', type: 'relationship', relationTo: 'posts', hasMany: true }, { name: 'headline', type: 'text' }] }
const authorBioBlock: Block = { slug: 'author-bio', labels: { singular: 'Author Bio', plural: 'Author Bios' }, fields: [{ name: 'author', type: 'relationship', relationTo: 'authors', required: true }] }

// Tool blocks (3)
const toolEmbedBlock: Block = { slug: 'tool-embed', labels: { singular: 'Tool Embed', plural: 'Tool Embeds' }, fields: [{ name: 'tool_slug', type: 'text', required: true }, { name: 'tool_title', type: 'text', required: true }, { name: 'headline', type: 'text' }, { name: 'description', type: 'textarea' }] }
const toolResultBlock: Block = { slug: 'tool-result', labels: { singular: 'Tool Result', plural: 'Tool Results' }, fields: [{ name: 'tool_slug', type: 'text', required: true }, { name: 'disclaimer', type: 'text' }] }
const toolCtaBlock: Block = { slug: 'tool-cta', labels: { singular: 'Tool CTA', plural: 'Tool CTAs' }, fields: [{ name: 'tool_slug', type: 'text', required: true }, { name: 'tool_title', type: 'text', required: true }, { name: 'description', type: 'textarea', required: true }, { name: 'cta_text', type: 'text', required: true }] }

// Form blocks (2)
const contactFormBlock: Block = { slug: 'contact-form', labels: { singular: 'Contact Form', plural: 'Contact Forms' }, fields: [{ name: 'form_id', type: 'relationship', relationTo: 'forms', required: true }, { name: 'headline', type: 'text' }, { name: 'description', type: 'textarea' }, { name: 'submit_text', type: 'text', defaultValue: 'Send Message' }] }
const newsletterFormBlock: Block = { slug: 'newsletter-form', labels: { singular: 'Newsletter Form', plural: 'Newsletter Forms' }, fields: [{ name: 'form_id', type: 'relationship', relationTo: 'forms', required: true }, { name: 'headline', type: 'text' }, { name: 'description', type: 'textarea' }, { name: 'submit_text', type: 'text', defaultValue: 'Subscribe' }, { name: 'disclaimer', type: 'text' }] }

// Utility blocks (2)
const faqAccordionBlock: Block = { slug: 'faq-accordion', labels: { singular: 'FAQ Accordion', plural: 'FAQ Accordions' }, fields: [{ name: 'headline', type: 'text' }, { name: 'items', type: 'array', fields: [{ name: 'question', type: 'text', required: true }, { name: 'answer', type: 'textarea', required: true }], minRows: 1 }] }
const dividerBlock: Block = { slug: 'divider', labels: { singular: 'Divider', plural: 'Dividers' }, fields: [{ name: 'style', type: 'select', defaultValue: 'line', options: [{ label: 'Line', value: 'line' }, { label: 'Space', value: 'space' }, { label: 'Ornament', value: 'ornament' }] }, { name: 'size', type: 'select', defaultValue: 'md', options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }] }] }

export const PAYLOAD_BLOCKS: Block[] = [
  heroImageBlock, heroVideoBlock, heroSplitBlock, heroMinimalBlock,
  richTextBlock, twoColumnBlock, threeColumnBlock, imageTextBlock, textImageBlock,
  statsBarBlock, quoteBlock, timelineBlock,
  ctaFullBlock, ctaInlineBlock, ctaCardBlock, ctaFloatingBlock, newsletterCtaBlock,
  serviceGridBlock, serviceDetailBlock, processStepsBlock, featureListBlock,
  comparisonTableBlock, pricingTableBlock,
  clientLogosBlock, testimonialsGridBlock, testimonialsSliderBlock,
  caseStudyCardBlock, awardsBarBlock, teamGridBlock,
  imageGalleryBlock, videoEmbedBlock, videoHeroBlock, portfolioGridBlock, beforeAfterBlock,
  blogGridBlock, blogFeaturedBlock, blogRelatedBlock, authorBioBlock,
  toolEmbedBlock, toolResultBlock, toolCtaBlock,
  contactFormBlock, newsletterFormBlock,
  faqAccordionBlock, dividerBlock,
]
```

3. Append to packages/ui/src/index.ts (read file first — do NOT overwrite Phase 4 exports):
```typescript
// Plan 05-03c: 45-block library
export * from './blocks/index.js'
```
  </action>
  <verify>
    <automated>cd /c/Users/jamshaid_pph/ClaudeMJ && pnpm --filter @mjagency/ui typecheck 2>&1 | grep -c "error" || echo "0"</automated>
  </verify>
  <done>
    - packages/ui/src/blocks/index.ts exports all 45 block components
    - packages/cms/src/blocks/payload-blocks.ts exports PAYLOAD_BLOCKS with 45 entries
    - packages/ui/src/index.ts has `export * from './blocks/index.js'` (Phase 4 exports preserved)
    - grep "PAYLOAD_BLOCKS" packages/cms/src/blocks/payload-blocks.ts exits 0
    - pnpm --filter @mjagency/ui typecheck exits 0
    - pnpm --filter @mjagency/cms typecheck exits 0
  </done>
  <acceptance_criteria>
    - grep "HeroImage" packages/ui/src/blocks/index.ts exits 0
    - grep "Divider" packages/ui/src/blocks/index.ts exits 0
    - grep "PAYLOAD_BLOCKS" packages/cms/src/blocks/payload-blocks.ts exits 0
    - grep "export \* from './blocks/index.js'" packages/ui/src/index.ts exits 0
    - pnpm --filter @mjagency/ui typecheck exits 0
    - pnpm --filter @mjagency/cms typecheck exits 0
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| editor → PAYLOAD_BLOCKS | Block field configs define what editors can input — fields must not allow unsafe HTML |
| ToolResult resultHtml | HTML rendered via dangerouslySetInnerHTML — Phase 10 must replace with sanitized renderer |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-03c-01 | Tampering | ToolResult resultHtml | mitigate | Comment in code: Phase 10 must replace dangerouslySetInnerHTML with sanitized renderer |
| T-05-03c-02 | Tampering | block string inputs | mitigate | PUCK BUILDER RULES: all block components sanitize string inputs before rendering (CLAUDE.md puck rules) |
| T-05-03c-03 | Tampering | testimonials disclaimer | mitigate | Payload block config has disclaimer as required field with safe defaultValue |
</threat_model>

<verification>
1. `grep "PAYLOAD_BLOCKS" packages/cms/src/blocks/payload-blocks.ts` exits 0
2. `grep "HeroImage\|Divider" packages/ui/src/blocks/index.ts` shows both (first and last exports)
3. `grep "export \* from './blocks/index.js'" packages/ui/src/index.ts` exits 0
4. `pnpm --filter @mjagency/ui typecheck` exits 0
5. `pnpm --filter @mjagency/cms typecheck` exits 0
6. Count entries in PAYLOAD_BLOCKS array: should be 45
</verification>

<success_criteria>
- 11 new block components exist with types.ts + index.tsx + stories.tsx
- packages/ui/src/blocks/index.ts barrel-exports all 45 blocks
- packages/cms/src/blocks/payload-blocks.ts exports PAYLOAD_BLOCKS with all 45 Block configs
- packages/ui/src/index.ts re-exports all blocks (Phase 4 exports preserved)
- Both packages typecheck clean
</success_criteria>

<output>
After completion, create `.planning/phases/05-cms-block-library/05-03c-SUMMARY.md`
</output>
