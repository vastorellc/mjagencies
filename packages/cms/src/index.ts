/**
 * @mjagency/cms — Payload CMS 3.82.1 config builder and access control helpers.
 * Filled by Phase 5 (Plans 05-01 through 05-04).
 */
export { buildPayloadConfig } from './config/build-payload-config.js'
export type { BuildPayloadConfigOptions } from './config/build-payload-config.js'

export {
  collectionAccess,
  deleteAccess,
  fieldImmutable,
  superAdminOnly,
} from './access/collection-access.js'
