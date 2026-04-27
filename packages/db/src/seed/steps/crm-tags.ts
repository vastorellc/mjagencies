/**
 * packages/db/src/seed/steps/crm-tags.ts
 *
 * Seed step: pre-populate 30 niche-appropriate tags per agency.
 *
 * Idempotency: ON CONFLICT (agency_id, name) DO NOTHING — safe to run multiple times.
 *
 * Uses raw SQL because `tags` is a Payload-managed collection table — no Drizzle
 * schema binding is available for it in this package.
 *
 * REQ-106 (tags), REQ-302 (agency isolation)
 */

import type { SeedStep } from '../types.js'
import { agencyUuid } from '../uuid.js'
import { sql } from 'drizzle-orm'

const NICHE_TAGS: Record<string, string[]> = {
  ecommerce: [
    'dtc', 'shopify', 'woocommerce', 'subscription-box', 'high-aov', 'low-aov',
    'repeat-buyer', 'lapsed-customer', 'cart-abandoner', 'email-subscriber',
    'sms-subscriber', 'influencer-partner', 'wholesale', 'b2b-ecommerce',
    'marketplace-seller', 'amazon-fba', 'international-shipping', 'product-launch',
    'seasonal-promo', 'loyalty-program',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  finance: [
    'cfo-advisory', 'fractional-cfo', 'cash-flow-crisis', 'series-a', 'series-b',
    'bootstrapped', 'pe-backed', 'vc-backed', 'audit-prep', 'tax-planning',
    'payroll-issues', 'accounting-cleanup', 'financial-modeling', 'fundraising',
    'exit-planning', 'budget-overrun', 'controller-needed', 'erp-implementation',
    'rd-credit', 'revenue-recognition',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  ai: [
    'llm-integration', 'rag-pipeline', 'fine-tuning', 'vector-search', 'agent-framework',
    'openai-user', 'anthropic-user', 'open-source-llm', 'computer-vision', 'nlp-project',
    'mlops', 'data-labeling', 'inference-optimization', 'ai-governance', 'ai-strategy',
    'chatbot', 'recommendation-engine', 'predictive-analytics', 'ai-content', 'automation',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  growth: [
    'b2b-saas', 'b2c', 'product-led', 'sales-led', 'paid-acquisition',
    'seo-growth', 'content-marketing', 'email-marketing', 'lifecycle-cro', 'retention',
    'activation', 'revenue-expansion', 'churn-reduction', 'referral-program', 'viral-loop',
    'cold-email', 'linkedin-outreach', 'webinar', 'community', 'partnership',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  webdev: [
    'next-js', 'react', 'node-js', 'full-stack', 'frontend-only',
    'backend-api', 'mobile-web', 'performance-audit', 'accessibility', 'headless-cms',
    'e-commerce-build', 'saas-mvp', 'api-integration', 'legacy-migration', 'devops',
    'ci-cd', 'typescript', 'monorepo', 'jamstack', 'web3',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  branding: [
    'logo-design', 'brand-identity', 'rebrand', 'startup-brand', 'enterprise-brand',
    'visual-system', 'typography', 'color-palette', 'brand-guidelines', 'packaging',
    'print-design', 'brand-voice', 'naming', 'tagline', 'pitch-deck-design',
    'brand-refresh', 'sub-brand', 'co-branding', 'brand-audit', 'employer-brand',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  strategy: [
    'market-entry', 'competitive-analysis', 'business-model', 'go-to-market',
    'pricing-strategy', 'partnership-strategy', 'growth-strategy', 'digital-transformation',
    'ops-efficiency', 'team-scaling', 'board-advisory', 'pivot-planning', 'exit-strategy',
    'investor-relations', 'okrs', 'strategic-planning', 'market-research', 'swot',
    'blue-ocean', 'scenario-planning',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  engineering: [
    'cloud-infra', 'aws', 'gcp', 'azure', 'kubernetes',
    'microservices', 'platform-engineering', 'data-pipeline', 'realtime-systems',
    'security-audit', 'api-design', 'database-optimization', 'observability', 'incident-response',
    'tech-debt', 'engineering-leadership', 'staff-aug', 'architecture-review', 'scalability', 'devops-maturity',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  product: [
    'product-strategy', 'roadmap-planning', 'user-research', 'ux-audit', 'prototyping',
    'product-market-fit', 'feature-prioritization', 'a-b-testing', 'metrics-framework',
    'discovery-sprint', 'mvp-build', 'beta-launch', 'product-ops', 'customer-feedback',
    'jobs-to-be-done', 'north-star-metric', 'growth-product', 'platform-product',
    'api-product', 'b2b-product',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  video: [
    'brand-video', 'explainer', 'testimonial', 'social-content', 'youtube',
    'tiktok', 'reels', 'documentary', 'product-demo', 'event-coverage',
    'animation', 'motion-graphics', 'live-stream', 'podcast-video', 'case-study-video',
    'recruitment-video', 'internal-comms', 'training-video', 'ad-creative', 'series',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  graphic: [
    'print-design', 'digital-design', 'infographic', 'social-media-design', 'presentation-design',
    'illustration', 'icon-set', 'packaging-design', 'banner-ads', 'signage',
    'trade-show', 'annual-report', 'editorial', 'book-cover', 'magazine-layout',
    'brochure', 'flyer', 'poster', 'brand-collateral', 'ux-illustration',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
  brand: [
    'brand-positioning', 'brand-architecture', 'brand-launch', 'brand-campaign', 'brand-activation',
    'experiential', 'brand-storytelling', 'brand-partnerships', 'community-brand', 'culture-brand',
    'purpose-driven', 'brand-equity', 'brand-perception', 'brand-awareness', 'brand-ambassador',
    'event-branding', 'sponsorship', 'brand-pr', 'challenger-brand', 'luxury-brand',
    'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
    'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
  ],
}

/** Standard CRM pipeline tags added to all agencies not fully specified above */
const STANDARD_CRM_TAGS = [
  'new-lead', 'qualified-lead', 'hot-lead', 'cold-lead', 'demo-requested',
  'proposal-sent', 'retainer-client', 'upsell-opportunity', 'referral-source', 'churn-risk',
]

export const crmTagsPreSeedStep: SeedStep = {
  name: 'crm-tags-preseed',
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)
    const tags = NICHE_TAGS[slug] ?? STANDARD_CRM_TAGS

    for (const tagName of tags) {
      await tx.execute(
        sql`INSERT INTO tags (id, agency_id, name)
            VALUES (gen_random_uuid(), ${agencyId}::uuid, ${tagName})
            ON CONFLICT (agency_id, name) DO NOTHING`
      )
    }
  },
}
