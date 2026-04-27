/**
 * packages/db/src/seed/steps/crm-contacts.ts
 *
 * Seed step: pre-populate 15 niche-appropriate CRM contacts per agency.
 *
 * Idempotency: ON CONFLICT (external_id) DO NOTHING — safe to run multiple times.
 *
 * externalId pattern: ${agencySlug}-contact-${contact.email}
 *
 * REQ-100 (contacts), REQ-302 (agency isolation)
 */

import type { SeedStep } from '../types.js'
import { crmContacts } from '../../schema/crm.js'
import { agencyUuid } from '../uuid.js'

interface ContactSeed {
  firstName: string
  lastName: string
  email: string
  source: string
  status: string
}

const ECOMMERCE_CONTACTS: ContactSeed[] = [
  { firstName: 'Marcus', lastName: 'Oyelaran', email: 'marcus@threadbound.co', source: 'organic', status: 'qualified' },
  { firstName: 'Priya', lastName: 'Venkatesh', email: 'priya@cartcraft.io', source: 'referral', status: 'qualified' },
  { firstName: 'Daniel', lastName: 'Kowalski', email: 'daniel@freshskin.com', source: 'cold_outreach', status: 'new' },
  { firstName: 'Sofia', lastName: 'Negrão', email: 'sofia@lumenaccessories.com', source: 'linkedin', status: 'new' },
  { firstName: 'James', lastName: 'Whitfield', email: 'james@stackedbrands.com', source: 'referral', status: 'qualified' },
  { firstName: 'Amara', lastName: 'Diallo', email: 'amara@vibepack.co', source: 'organic', status: 'new' },
  { firstName: 'Tobias', lastName: 'Brennan', email: 'tobias@patchwork.store', source: 'paid_ad', status: 'new' },
  { firstName: 'Rachel', lastName: 'Huang', email: 'rachel@moreshelf.com', source: 'event', status: 'qualified' },
  { firstName: 'Oscar', lastName: 'Medina', email: 'oscar@cratesupply.io', source: 'organic', status: 'new' },
  { firstName: 'Leila', lastName: 'Rashidova', email: 'leila@ritualgoods.com', source: 'referral', status: 'qualified' },
  { firstName: 'Ben', lastName: 'Okafor', email: 'ben@dropshipdecks.com', source: 'cold_outreach', status: 'new' },
  { firstName: 'Claire', lastName: 'Fontaine', email: 'claire@maison-dtc.com', source: 'linkedin', status: 'qualified' },
  { firstName: 'Kwame', lastName: 'Asante', email: 'kwame@boldcart.com', source: 'referral', status: 'new' },
  { firstName: 'Nina', lastName: 'Strickland', email: 'nina@loopstore.co', source: 'organic', status: 'new' },
  { firstName: 'Hiro', lastName: 'Nakamura', email: 'hiro@purepack.jp', source: 'inbound', status: 'qualified' },
]

const FINANCE_CONTACTS: ContactSeed[] = [
  { firstName: 'Patricia', lastName: 'Goldstein', email: 'patricia@meridianholdings.com', source: 'referral', status: 'qualified' },
  { firstName: 'Robert', lastName: 'Vasquez', email: 'rvasquez@cornerstone-cfo.com', source: 'linkedin', status: 'new' },
  { firstName: 'Evelyn', lastName: 'Chen', email: 'echen@alphaledger.io', source: 'organic', status: 'qualified' },
  { firstName: 'William', lastName: 'Abara', email: 'william@scalecapital.co', source: 'referral', status: 'new' },
  { firstName: 'Sandra', lastName: 'Petrov', email: 's.petrov@bridgefinance.net', source: 'cold_outreach', status: 'new' },
  { firstName: 'Michael', lastName: 'Torres', email: 'mtorres@clearpath-accounting.com', source: 'paid_ad', status: 'qualified' },
  { firstName: 'Diane', lastName: 'Kwan', email: 'diane@vaultanalytix.com', source: 'organic', status: 'new' },
  { firstName: 'Kevin', lastName: 'Okonkwo', email: 'kevin@profitrack.io', source: 'linkedin', status: 'qualified' },
  { firstName: 'Laura', lastName: 'Bjornstad', email: 'l.bjornstad@nordicasset.com', source: 'referral', status: 'new' },
  { firstName: 'Jason', lastName: 'Mehta', email: 'jason@finstack.ventures', source: 'event', status: 'qualified' },
  { firstName: 'Yolanda', lastName: 'Ferreira', email: 'yolanda@bluecrestcfo.com', source: 'organic', status: 'new' },
  { firstName: 'Thomas', lastName: 'Nakagawa', email: 'thomas@quantumledger.co', source: 'referral', status: 'qualified' },
  { firstName: 'Angela', lastName: 'Roux', email: 'angela@capitalmaine.fr', source: 'inbound', status: 'new' },
  { firstName: 'Derek', lastName: 'Achebe', email: 'derek@arborfinancials.com', source: 'cold_outreach', status: 'new' },
  { firstName: 'Monica', lastName: 'Hashimoto', email: 'monica@streamcfo.io', source: 'linkedin', status: 'qualified' },
]

const AI_CONTACTS: ContactSeed[] = [
  { firstName: 'Aisha', lastName: 'Okonjo', email: 'aisha@neuralstack.io', source: 'organic', status: 'qualified' },
  { firstName: 'Lucas', lastName: 'Berger', email: 'l.berger@deepframe.ai', source: 'referral', status: 'new' },
  { firstName: 'Mei', lastName: 'Zhou', email: 'mei@promptlayer.com', source: 'event', status: 'qualified' },
  { firstName: 'Raj', lastName: 'Subramaniam', email: 'raj@modelforge.ai', source: 'organic', status: 'new' },
  { firstName: 'Elena', lastName: 'Moroz', email: 'elena@vectordb.co', source: 'linkedin', status: 'qualified' },
  { firstName: 'Finn', lastName: 'Andersen', email: 'finn@embediq.io', source: 'referral', status: 'new' },
  { firstName: 'Yasmin', lastName: 'Khalid', email: 'yasmin@aigateway.co', source: 'cold_outreach', status: 'new' },
  { firstName: 'Carlos', lastName: 'Esteves', email: 'carlos@llmops.io', source: 'organic', status: 'qualified' },
  { firstName: 'Zara', lastName: 'Osei', email: 'zara@synthcraft.ai', source: 'linkedin', status: 'new' },
  { firstName: 'Anton', lastName: 'Volkov', email: 'anton@inferencebase.com', source: 'referral', status: 'qualified' },
  { firstName: 'Hiroshi', lastName: 'Tanaka', email: 'h.tanaka@agentflow.ai', source: 'inbound', status: 'new' },
  { firstName: 'Fatima', lastName: 'Al-Rashid', email: 'fatima@contextai.io', source: 'organic', status: 'qualified' },
  { firstName: 'Evan', lastName: 'MacLeod', email: 'evan@pipelineml.com', source: 'paid_ad', status: 'new' },
  { firstName: 'Nneka', lastName: 'Eze', email: 'nneka@ragstack.io', source: 'referral', status: 'new' },
  { firstName: 'Pavel', lastName: 'Dvorak', email: 'pavel@embeddingops.com', source: 'cold_outreach', status: 'new' },
]

/** First/last name roster for the fallback contact generator */
const FALLBACK_NAMES: Array<{ firstName: string; lastName: string }> = [
  { firstName: 'Alexandra', lastName: 'Andrade' },
  { firstName: 'Benjamin', lastName: 'Brooks' },
  { firstName: 'Carmen', lastName: 'Castillo' },
  { firstName: 'David', lastName: 'Delacroix' },
  { firstName: 'Elena', lastName: 'Eklund' },
  { firstName: 'Felix', lastName: 'Flores' },
  { firstName: 'Gina', lastName: 'Guerrero' },
  { firstName: 'Hector', lastName: 'Halloway' },
  { firstName: 'Irene', lastName: 'Inoue' },
  { firstName: 'Jack', lastName: 'Jensen' },
  { firstName: 'Kira', lastName: 'Kamau' },
  { firstName: 'Luca', lastName: 'Laurent' },
  { firstName: 'Maya', lastName: 'Montenegro' },
  { firstName: 'Nate', lastName: 'Nwosu' },
  { firstName: 'Olivia', lastName: 'Ortiz' },
]

const FALLBACK_DOMAINS: Record<string, string[]> = {
  growth: ['growthco.io', 'scalelab.com', 'funnelstack.co', 'boostly.io', 'velocityhq.com'],
  webdev: ['codestack.dev', 'buildlabs.io', 'sprintcraft.dev', 'launchpad.dev', 'devloop.io'],
  branding: ['chromestudio.co', 'rebrandco.io', 'palettehq.com', 'markcraft.co', 'logolab.io'],
  strategy: ['nexusstrategy.com', 'pivotco.io', 'clarityhq.com', 'strategyworks.co', 'northstar-advisory.com'],
  engineering: ['infracraft.io', 'platformhq.dev', 'stackbuilt.com', 'enginehq.io', 'devpilot.com'],
  product: ['productcraft.io', 'roadmaphq.com', 'pmlabs.co', 'pivotproduct.io', 'sprintco.com'],
  video: ['framecollective.co', 'cutroom.io', 'studiohq.com', 'rendercraft.co', 'montagelab.io'],
  graphic: ['pixellab.design', 'composestudio.io', 'vectorhq.co', 'artboardco.com', 'layercollective.design'],
  brand: ['brandlab.co', 'markstudio.io', 'identityhq.com', 'brandcraft.co', 'signaturebrand.io'],
}

const SOURCES = ['organic', 'referral', 'linkedin', 'cold_outreach', 'paid_ad', 'event', 'inbound']
const STATUSES = ['new', 'new', 'new', 'qualified', 'qualified', 'new', 'qualified', 'new', 'new', 'qualified', 'new', 'qualified', 'new', 'new', 'qualified']

/**
 * Build 15 fallback contacts for agencies without niche-specific data.
 * Uses real names and real company domains per niche.
 */
function getFallbackContacts(slug: string): ContactSeed[] {
  const domains = FALLBACK_DOMAINS[slug] ?? ['clientco.com', 'partnerco.io', 'businesshq.com', 'launchco.io', 'growthco.com']
  return FALLBACK_NAMES.map((name, i) => {
    const domain = domains[i % domains.length]
    const localPart = name.firstName.toLowerCase()
    return {
      firstName: name.firstName,
      lastName: name.lastName,
      email: `${localPart}@${domain}`,
      source: SOURCES[i % SOURCES.length],
      status: STATUSES[i] ?? 'new',
    }
  })
}

const NICHE_CONTACTS: Record<string, ContactSeed[]> = {
  ecommerce: ECOMMERCE_CONTACTS,
  finance: FINANCE_CONTACTS,
  ai: AI_CONTACTS,
}

export const crmContactsPreSeedStep: SeedStep = {
  name: 'crm-contacts-preseed',
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)
    const contacts = NICHE_CONTACTS[slug] ?? getFallbackContacts(slug)

    for (const contact of contacts) {
      const externalId = `${slug}-contact-${contact.email}`
      await tx
        .insert(crmContacts)
        .values({
          agencyId,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          source: contact.source,
          status: contact.status,
          externalId,
        })
        .onConflictDoNothing({ target: crmContacts.externalId })
    }
  },
}
