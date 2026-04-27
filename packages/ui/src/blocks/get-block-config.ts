/**
 * packages/ui/src/blocks/get-block-config.ts
 *
 * getBlockConfig() — returns a Puck-compatible Config object containing all
 * registered block components from @mjagency/ui.
 *
 * SECURITY: Each block component in this registry sanitizes string inputs
 * via DOMPurify before rendering (CLAUDE.md Puck Rules §6).
 * This function MUST be passed as the Puck `config` prop in PuckEditorClient.
 * Never replace this with `{ components: {} }` — that would bypass DOMPurify
 * sanitization on all block string props.
 *
 * The return type uses a minimal compatible interface so @mjagency/ui does not
 * need to depend on @measured/puck. The consumer (packages/builder) casts to
 * Puck's Config<any> type after import.
 */

import type React from 'react'

import { HeroImage } from './hero/HeroImage/index.js'
import { HeroVideo } from './hero/HeroVideo/index.js'
import { HeroSplit } from './hero/HeroSplit/index.js'
import { HeroMinimal } from './hero/HeroMinimal/index.js'
import { RichText } from './content/RichText/index.js'
import { TwoColumn } from './content/TwoColumn/index.js'
import { ThreeColumn } from './content/ThreeColumn/index.js'
import { ImageText } from './content/ImageText/index.js'
import { TextImage } from './content/TextImage/index.js'
import { StatsBar } from './content/StatsBar/index.js'
import { QuoteBlock } from './content/QuoteBlock/index.js'
import { Timeline } from './content/Timeline/index.js'
import { CtaFull } from './cta/CtaFull/index.js'
import { CtaInline } from './cta/CtaInline/index.js'
import { CtaCard } from './cta/CtaCard/index.js'
import { CtaFloating } from './cta/CtaFloating/index.js'
import { NewsletterCta } from './cta/NewsletterCta/index.js'
import { ServiceGrid } from './service/ServiceGrid/index.js'
import { ServiceDetail } from './service/ServiceDetail/index.js'
import { ProcessSteps } from './service/ProcessSteps/index.js'
import { FeatureList } from './service/FeatureList/index.js'
import { ComparisonTable } from './service/ComparisonTable/index.js'
import { PricingTable } from './service/PricingTable/index.js'
import { ClientLogos } from './trust/ClientLogos/index.js'
import { TestimonialsGrid } from './trust/TestimonialsGrid/index.js'
import { TestimonialsSlider } from './trust/TestimonialsSlider/index.js'
import { CaseStudyCard } from './trust/CaseStudyCard/index.js'
import { AwardsBar } from './trust/AwardsBar/index.js'
import { TeamGrid } from './trust/TeamGrid/index.js'
import { ImageGallery } from './media/ImageGallery/index.js'
import { VideoEmbed } from './media/VideoEmbed/index.js'
import { VideoHero } from './media/VideoHero/index.js'
import { PortfolioGrid } from './media/PortfolioGrid/index.js'
import { BeforeAfter } from './media/BeforeAfter/index.js'
import { BlogGrid } from './blog/BlogGrid/index.js'
import { BlogFeatured } from './blog/BlogFeatured/index.js'
import { BlogRelated } from './blog/BlogRelated/index.js'
import { AuthorBio } from './blog/AuthorBio/index.js'
import { ToolEmbed } from './tool/ToolEmbed/index.js'
import { ToolResult } from './tool/ToolResult/index.js'
import { ToolCta } from './tool/ToolCta/index.js'
import { FaqAccordion } from './utility/FaqAccordion/index.js'
import { Divider } from './utility/Divider/index.js'

/**
 * Minimal Puck component config shape.
 * Compatible with @measured/puck Config<any>.
 * @mjagency/ui does not depend on @measured/puck to avoid circular deps.
 * Components are typed as ComponentType<any> to avoid requiring @measured/puck.
 */
export interface PuckComponentEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: React.ComponentType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultProps?: Record<string, any>
}

export interface MjBlockConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: Record<string, PuckComponentEntry>
}

// Helper to cast any block component to PuckComponentEntry.render without TypeScript objecting.
// This is safe: Puck passes props from its JSON state — strong prop types are enforced at
// design-time via Puck field definitions, not at this registry level.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asBlock(component: React.ComponentType<any>): PuckComponentEntry {
  return { render: component, fields: {}, defaultProps: {} }
}

/**
 * Returns a Puck-compatible Config containing all registered @mjagency/ui block
 * components. Pass this as the `config` prop to `<Puck>` — never use an empty
 * `{ components: {} }` which would bypass block-level DOMPurify sanitization.
 *
 * @returns MjBlockConfig — cast to Config<any> in packages/builder
 */
export function getBlockConfig(): MjBlockConfig {
  return {
    components: {
      // Hero blocks
      HeroImage: asBlock(HeroImage),
      HeroVideo: asBlock(HeroVideo),
      HeroSplit: asBlock(HeroSplit),
      HeroMinimal: asBlock(HeroMinimal),
      // Content blocks
      RichText: asBlock(RichText),
      TwoColumn: asBlock(TwoColumn),
      ThreeColumn: asBlock(ThreeColumn),
      ImageText: asBlock(ImageText),
      TextImage: asBlock(TextImage),
      StatsBar: asBlock(StatsBar),
      QuoteBlock: asBlock(QuoteBlock),
      Timeline: asBlock(Timeline),
      // CTA blocks
      CtaFull: asBlock(CtaFull),
      CtaInline: asBlock(CtaInline),
      CtaCard: asBlock(CtaCard),
      CtaFloating: asBlock(CtaFloating),
      NewsletterCta: asBlock(NewsletterCta),
      // Service blocks
      ServiceGrid: asBlock(ServiceGrid),
      ServiceDetail: asBlock(ServiceDetail),
      ProcessSteps: asBlock(ProcessSteps),
      FeatureList: asBlock(FeatureList),
      ComparisonTable: asBlock(ComparisonTable),
      PricingTable: asBlock(PricingTable),
      // Trust blocks
      ClientLogos: asBlock(ClientLogos),
      TestimonialsGrid: asBlock(TestimonialsGrid),
      TestimonialsSlider: asBlock(TestimonialsSlider),
      CaseStudyCard: asBlock(CaseStudyCard),
      AwardsBar: asBlock(AwardsBar),
      TeamGrid: asBlock(TeamGrid),
      // Media blocks
      ImageGallery: asBlock(ImageGallery),
      VideoEmbed: asBlock(VideoEmbed),
      VideoHero: asBlock(VideoHero),
      PortfolioGrid: asBlock(PortfolioGrid),
      BeforeAfter: asBlock(BeforeAfter),
      // Blog blocks
      BlogGrid: asBlock(BlogGrid),
      BlogFeatured: asBlock(BlogFeatured),
      BlogRelated: asBlock(BlogRelated),
      AuthorBio: asBlock(AuthorBio),
      // Tool blocks
      ToolEmbed: asBlock(ToolEmbed),
      ToolResult: asBlock(ToolResult),
      ToolCta: asBlock(ToolCta),
      // Utility blocks
      FaqAccordion: asBlock(FaqAccordion),
      Divider: asBlock(Divider),
    },
  }
}
