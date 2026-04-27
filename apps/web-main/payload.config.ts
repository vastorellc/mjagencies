// SOURCE: payloadcms.com/docs/getting-started/installation
// Pinned: payload 3.82.1 — DO NOT UPGRADE (CLAUDE.md §1, REQ-050, REQ-500)
import { buildPayloadConfig, CORE_COLLECTIONS } from '@mjagency/cms'
import { crmCollections } from '@mjagency/crm'
import { emailCollections } from '@mjagency/email'
import { bookingCollections } from '@mjagency/booking'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildPayloadConfig({
  dirname,
  databaseUrl: process.env['DATABASE_URL'] ?? '',
  secret: process.env['PAYLOAD_SECRET'] ?? '',
  collections: [...CORE_COLLECTIONS, ...crmCollections, ...emailCollections, ...bookingCollections],
})
