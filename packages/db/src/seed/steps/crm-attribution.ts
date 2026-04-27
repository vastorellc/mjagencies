/**
 * packages/db/src/seed/steps/crm-attribution.ts
 *
 * Seed step: pre-populate 3 CRM activity records per agency as attribution
 * touch-point data (first touch, second touch, third touch).
 *
 * Idempotency: ON CONFLICT (external_id) DO NOTHING — safe to run multiple times.
 *
 * REQ-103 (activities), REQ-302 (agency isolation)
 */

import type { SeedStep } from '../types.js'
import { crmActivities } from '../../schema/crm.js'
import { agencyUuid } from '../uuid.js'

export const crmAttributionPreSeedStep: SeedStep = {
  name: 'crm-attribution-preseed',
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)

    const touchPoints = [
      {
        type: 'note',
        body: `First touch: organic search — landed on ${slug} services page`,
        externalId: `${slug}-attr-1`,
      },
      {
        type: 'email_sent',
        body: `Second touch: opened welcome email sequence step 1`,
        externalId: `${slug}-attr-2`,
      },
      {
        type: 'meeting',
        body: `Third touch: completed 30-minute discovery call`,
        externalId: `${slug}-attr-3`,
      },
    ]

    for (const touch of touchPoints) {
      await tx
        .insert(crmActivities)
        .values({
          agencyId,
          type: touch.type,
          body: touch.body,
          externalId: touch.externalId,
          status: 'logged',
        })
        .onConflictDoNothing({ target: crmActivities.externalId })
    }
  },
}
