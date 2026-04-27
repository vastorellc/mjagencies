/**
 * packages/cms/src/collections/pages.ts
 *
 * Payload 3.82.1 CollectionConfig for the `pages` collection.
 * Website pages (home, about, services, landing pages, legal, FAQ, etc.)
 *
 * REQ-052: pages collection
 * REQ-056: Draft/Review/Scheduled/Published workflow
 * REQ-057: Scheduled publishing via BullMQ
 * REQ-058: 20 rolling revisions
 * REQ-412: is_composite_playbook toggle
 * REQ-201, REQ-203, REQ-205, REQ-207, REQ-410, REQ-421: content validators
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'
import {
  validateWordCount,
  validateInternalLinks,
  validatePlaybookNumbers,
  validateFtcDisclaimer,
  validateFtcTestimonial,
  validateAioTldr,
} from '../hooks/content-validators.js'
import { validateStatSources, validateQuoteSources, validateNoPlaceholders } from '../hooks/anti-fab-validators.js'
import { computeAiContentRatio } from '../hooks/ai-disclosure.js'
import { schedulePublishHook } from '../hooks/scheduled-publish.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

const STATUS_FIELD: Field = {
  name: 'status',
  type: 'select',
  defaultValue: 'draft',
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Review', value: 'review' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' },
  ],
  admin: { position: 'sidebar' },
}

export const pagesCollection: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'page_type', 'agency_id', 'updatedAt'],
    group: 'Content',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  versions: {
    maxPerDoc: 20,
    drafts: { autosave: { interval: 30000 } },
  },
  hooks: {
    beforeOperation: [
      validateWordCount,
      validateInternalLinks,
      validatePlaybookNumbers,
      validateFtcDisclaimer,
      validateFtcTestimonial,
      validateAioTldr,          // Phase 6 — REQ-075
      validateStatSources,      // Phase 7 — REQ-082
      validateQuoteSources,     // Phase 7 — REQ-082
      validateNoPlaceholders,   // Phase 7 — REQ-082
      computeAiContentRatio,    // Phase 7 — REQ-086, REQ-409
    ],
    afterChange: [schedulePublishHook],
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    STATUS_FIELD,
    {
      name: 'visibility',
      type: 'select',
      defaultValue: 'public',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Private', value: 'private' },
        { label: 'Password Protected', value: 'password' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'publish_at',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'Set this along with status=Scheduled to auto-publish via BullMQ (REQ-057).',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'page_type',
      type: 'select',
      options: [
        { label: 'Home', value: 'home' },
        { label: 'About', value: 'about' },
        { label: 'Services', value: 'services' },
        { label: 'Blog', value: 'blog' },
        { label: 'Contact', value: 'contact' },
        { label: 'Tool', value: 'tool' },
        { label: 'Landing', value: 'landing' },
        { label: 'Legal', value: 'legal' },
        { label: 'Cornerstone', value: 'cornerstone' },
        { label: 'FAQ', value: 'faq' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'is_composite_playbook',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Composite playbook pages require an FTC disclaimer and must use percentage ranges (not exact figures) (REQ-412).',
      },
    },
    {
      name: 'content',
      type: 'richText',
      // Plan 05-04 fills the full Lexical feature config
    },
    {
      name: 'excerpt',
      type: 'textarea',
      maxLength: 160,
    },
    {
      name: 'meta_title',
      type: 'text',
      maxLength: 60,
      admin: { position: 'sidebar' },
    },
    {
      name: 'meta_description',
      type: 'text',
      maxLength: 160,
      admin: { position: 'sidebar' },
    },
    {
      name: 'aio_tldr',
      type: 'text',
      maxLength: 120,
      admin: {
        position: 'sidebar',
        description: 'AIO TL;DR — required on all indexable pages (REQ-055).',
      },
    },
    {
      name: 'focus_keyword',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Focus keyword for SEO scoring — seo-classic keyword density analysis (REQ-070).',
      },
    },
    {
      name: 'faqs',
      type: 'relationship',
      relationTo: 'faqs',
      hasMany: true,
      admin: {
        description:
          'FAQ items for FAQPage JSON-LD structured data (REQ-076, D-07). buildFaqJsonLd() in Phase 8 SSR reads these.',
      },
    },
    {
      name: 'canonical_url',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'schema_type',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'featured_image',
      type: 'upload',
      relationTo: 'media_assets',
    },
    {
      name: 'ai_content_ratio',
      type: 'number',
      min: 0,
      max: 1,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Auto-computed AI content ratio (REQ-409). Set by computeAiContentRatio hook.',
      },
    },
    {
      name: 'ai_disclosure_required',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Auto-set when ai_content_ratio > 0.70 (REQ-086). Triggers disclosure UI on public page.',
      },
    },
    {
      name: 'ai_generated_fields',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Array of field names produced by AI (e.g. ["title","content"]). Used to compute ai_content_ratio.',
      },
    },
  ],
}
