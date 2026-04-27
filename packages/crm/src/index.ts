/**
 * packages/crm/src/index.ts
 * Barrel export for @mjagency/crm.
 * REQ-100, REQ-101, REQ-102, REQ-103, REQ-302
 */
import type { CollectionConfig } from 'payload'
export { contactsCollection } from './collections/contacts.js'
export { accountsCollection } from './collections/accounts.js'
export { dealsCollection } from './collections/deals.js'
export { activitiesCollection } from './collections/activities.js'
export { tasksCollection } from './collections/tasks.js'

import { contactsCollection } from './collections/contacts.js'
import { accountsCollection } from './collections/accounts.js'
import { dealsCollection } from './collections/deals.js'
import { activitiesCollection } from './collections/activities.js'
import { tasksCollection } from './collections/tasks.js'

/** Array passed directly to Payload config collections[]. */
export const crmCollections: CollectionConfig[] = [
  contactsCollection,
  accountsCollection,
  dealsCollection,
  activitiesCollection,
  tasksCollection,
]
