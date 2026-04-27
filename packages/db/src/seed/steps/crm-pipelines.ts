/**
 * packages/db/src/seed/steps/crm-pipelines.ts
 *
 * Seed step: pre-populate 3 niche-appropriate deal pipeline entries per agency.
 *
 * Idempotency: ON CONFLICT (external_id) DO NOTHING — safe to run multiple times.
 *
 * externalId pattern: ${agencySlug}-deal-pipeline-${index}
 *
 * REQ-102 (deals), REQ-302 (agency isolation)
 */

import type { SeedStep } from '../types.js'
import { crmDeals } from '../../schema/crm.js'
import { agencyUuid } from '../uuid.js'

interface PipelineSeed {
  title: string
  stage: string
  value: string
}

const NICHE_PIPELINES: Record<string, PipelineSeed[]> = {
  ecommerce: [
    { title: 'Storefront Audit & Roadmap', stage: 'lead', value: '2500.00' },
    { title: 'Platform Integration Scoping', stage: 'proposal', value: '8500.00' },
    { title: 'Growth Retainer Agreement', stage: 'negotiation', value: '4500.00' },
  ],
  finance: [
    { title: 'CFO Advisory Assessment', stage: 'lead', value: '3000.00' },
    { title: 'Financial Systems Overhaul', stage: 'proposal', value: '15000.00' },
    { title: 'Fractional CFO Engagement', stage: 'negotiation', value: '6000.00' },
  ],
  ai: [
    { title: 'AI Readiness Assessment', stage: 'lead', value: '4000.00' },
    { title: 'LLM Integration Scoping', stage: 'proposal', value: '18000.00' },
    { title: 'AI Pipeline Build Retainer', stage: 'negotiation', value: '8000.00' },
  ],
  growth: [
    { title: 'Funnel Audit', stage: 'lead', value: '2000.00' },
    { title: 'Acquisition Strategy Proposal', stage: 'proposal', value: '7500.00' },
    { title: 'Growth Sprint Agreement', stage: 'negotiation', value: '5000.00' },
  ],
  webdev: [
    { title: 'Technical Discovery', stage: 'lead', value: '1500.00' },
    { title: 'Development Proposal', stage: 'proposal', value: '12000.00' },
    { title: 'Retainer Agreement', stage: 'negotiation', value: '4000.00' },
  ],
  branding: [
    { title: 'Brand Audit', stage: 'lead', value: '2500.00' },
    { title: 'Identity Redesign Proposal', stage: 'proposal', value: '9000.00' },
    { title: 'Brand System Buildout', stage: 'negotiation', value: '5500.00' },
  ],
  strategy: [
    { title: 'Strategy Session', stage: 'lead', value: '2000.00' },
    { title: 'Strategic Plan Proposal', stage: 'proposal', value: '10000.00' },
    { title: 'Engagement Agreement', stage: 'negotiation', value: '6000.00' },
  ],
  engineering: [
    { title: 'Architecture Review', stage: 'lead', value: '3500.00' },
    { title: 'Platform Build Proposal', stage: 'proposal', value: '20000.00' },
    { title: 'Engineering Retainer', stage: 'negotiation', value: '7500.00' },
  ],
  product: [
    { title: 'Product Discovery', stage: 'lead', value: '3000.00' },
    { title: 'Roadmap Build Proposal', stage: 'proposal', value: '9500.00' },
    { title: 'Product Sprint Agreement', stage: 'negotiation', value: '5000.00' },
  ],
  video: [
    { title: 'Video Brief Workshop', stage: 'lead', value: '1500.00' },
    { title: 'Production Proposal', stage: 'proposal', value: '7000.00' },
    { title: 'Content Retainer', stage: 'negotiation', value: '3500.00' },
  ],
  graphic: [
    { title: 'Design Audit', stage: 'lead', value: '1500.00' },
    { title: 'Visual Identity Proposal', stage: 'proposal', value: '6500.00' },
    { title: 'Design Retainer', stage: 'negotiation', value: '3000.00' },
  ],
  brand: [
    { title: 'Brand Positioning Workshop', stage: 'lead', value: '2500.00' },
    { title: 'Brand Architecture Proposal', stage: 'proposal', value: '10000.00' },
    { title: 'Brand Launch Engagement', stage: 'negotiation', value: '5500.00' },
  ],
}

/** Fallback pipeline for any slug not listed above */
const DEFAULT_PIPELINES: PipelineSeed[] = [
  { title: 'Discovery Consultation', stage: 'lead', value: '2000.00' },
  { title: 'Service Proposal', stage: 'proposal', value: '8000.00' },
  { title: 'Engagement Agreement', stage: 'negotiation', value: '4500.00' },
]

export const crmPipelinesPreSeedStep: SeedStep = {
  name: 'crm-pipelines-preseed',
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)
    const pipelines = NICHE_PIPELINES[slug] ?? DEFAULT_PIPELINES

    for (let i = 0; i < pipelines.length; i++) {
      const deal = pipelines[i]
      const externalId = `${slug}-deal-pipeline-${i}`
      await tx
        .insert(crmDeals)
        .values({
          agencyId,
          title: deal.title,
          stage: deal.stage,
          value: deal.value,
          externalId,
        })
        .onConflictDoNothing({ target: crmDeals.externalId })
    }
  },
}
