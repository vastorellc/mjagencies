/**
 * packages/cms/src/blocks/payload-blocks.ts
 * Payload 3.82.1 Block configurations for all 45 CMS blocks (REQ-052).
 * Used by Plan 05-04's buildPayloadConfig() via BlocksFeature({ blocks: PAYLOAD_BLOCKS }).
 *
 * Rule 3 fix (07-04): Payload 3.82.1 requires richText fields nested inside blocks to
 * explicitly set an `editor` prop — otherwise sanitizeConfig throws MissingEditorProp.
 * Added `lexicalEditor({})` (default features) to all nested richText fields.
 */
import type { Block } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

/** Minimal lexical editor for richText fields inside blocks. Uses Payload default features. */
const blockEditor = lexicalEditor({})

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
const richTextBlock: Block = { slug: 'rich-text', labels: { singular: 'Rich Text', plural: 'Rich Text' }, fields: [{ name: 'content', type: 'richText', required: true, editor: blockEditor }] }
const twoColumnBlock: Block = { slug: 'two-column', labels: { singular: 'Two Column', plural: 'Two Columns' }, fields: [{ name: 'left_content', type: 'richText', required: true, editor: blockEditor }, { name: 'right_content', type: 'richText', required: true, editor: blockEditor }] }
const threeColumnBlock: Block = { slug: 'three-column', labels: { singular: 'Three Column', plural: 'Three Columns' }, fields: [{ name: 'columns', type: 'array', fields: [{ name: 'content', type: 'richText', required: true, editor: blockEditor }], minRows: 3, maxRows: 3 }] }
const imageTextBlock: Block = { slug: 'image-text', labels: { singular: 'Image + Text', plural: 'Image + Text' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'body', type: 'richText', required: true, editor: blockEditor }, { name: 'image', type: 'upload', relationTo: 'media_assets', required: true }, { name: 'image_position', type: 'select', defaultValue: 'left', options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }] }] }
const textImageBlock: Block = { slug: 'text-image', labels: { singular: 'Text + Image', plural: 'Text + Image' }, fields: [{ name: 'headline', type: 'text', required: true }, { name: 'body', type: 'richText', required: true, editor: blockEditor }, { name: 'image', type: 'upload', relationTo: 'media_assets', required: true }] }
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
const serviceDetailBlock: Block = { slug: 'service-detail', labels: { singular: 'Service Detail', plural: 'Service Details' }, fields: [{ name: 'title', type: 'text', required: true }, { name: 'description', type: 'richText', required: true, editor: blockEditor }, { name: 'features', type: 'array', fields: [{ name: 'feature', type: 'text', required: true }] }, { name: 'cta_text', type: 'text' }, { name: 'cta_href', type: 'text' }, { name: 'icon', type: 'upload', relationTo: 'media_assets' }] }
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
