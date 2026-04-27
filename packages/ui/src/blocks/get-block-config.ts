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

// React import required for JSX in consuming components — kept here for the type
import type React from 'react'

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
      HeroImage: { render: HeroImage as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: { headline: '', imageUrl: '', imageAlt: '' } },
      HeroVideo: { render: HeroVideo as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: { headline: '', videoUrl: '' } },
      HeroSplit: { render: HeroSplit as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: { headline: '' } },
      HeroMinimal: { render: HeroMinimal as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: { headline: '' } },
      // Content blocks
      RichText: { render: RichText as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      TwoColumn: { render: TwoColumn as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      ThreeColumn: { render: ThreeColumn as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      ImageText: { render: ImageText as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      TextImage: { render: TextImage as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      StatsBar: { render: StatsBar as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      QuoteBlock: { render: QuoteBlock as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      Timeline: { render: Timeline as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      // CTA blocks
      CtaFull: { render: CtaFull as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      CtaInline: { render: CtaInline as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      CtaCard: { render: CtaCard as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      CtaFloating: { render: CtaFloating as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      NewsletterCta: { render: NewsletterCta as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      // Service blocks
      ServiceGrid: { render: ServiceGrid as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      ServiceDetail: { render: ServiceDetail as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      ProcessSteps: { render: ProcessSteps as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      FeatureList: { render: FeatureList as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      ComparisonTable: { render: ComparisonTable as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      PricingTable: { render: PricingTable as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      // Trust blocks
      ClientLogos: { render: ClientLogos as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      TestimonialsGrid: { render: TestimonialsGrid as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      TestimonialsSlider: { render: TestimonialsSlider as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      CaseStudyCard: { render: CaseStudyCard as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      AwardsBar: { render: AwardsBar as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      TeamGrid: { render: TeamGrid as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      // Media blocks
      ImageGallery: { render: ImageGallery as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      VideoEmbed: { render: VideoEmbed as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      VideoHero: { render: VideoHero as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      PortfolioGrid: { render: PortfolioGrid as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      BeforeAfter: { render: BeforeAfter as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      // Blog blocks
      BlogGrid: { render: BlogGrid as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      BlogFeatured: { render: BlogFeatured as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      BlogRelated: { render: BlogRelated as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      AuthorBio: { render: AuthorBio as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      // Tool blocks
      ToolEmbed: { render: ToolEmbed as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      ToolResult: { render: ToolResult as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      ToolCta: { render: ToolCta as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      // Utility blocks
      FaqAccordion: { render: FaqAccordion as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
      Divider: { render: Divider as React.ComponentType<Record<string, unknown>>, fields: {}, defaultProps: {} },
    },
  }
}
