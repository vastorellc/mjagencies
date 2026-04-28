/**
 * packages/compliance/src/index.ts
 *
 * Barrel export for @mjagency/compliance — Plan 11-05.
 *
 * REQ-144 (CCPA / ADA compliance) deliverables:
 *   1. ConsentProvider / useConsent / CookieHintBanner — D-01 / D-02 consent infra
 *   2. OptOutFooterLink / OptOutModal + opt-out fan-out worker — D-03 opt-out flow
 *   3. ErasureFormClient / ErasureConfirmPage + erasure worker (7-system fan-out) — D-04 / D-05
 *   4. Hash-chain audit (writeAuditRow) — D-07
 *   5. Receipt PDF (generateErasureReceiptPdf, R2 vault) — D-06
 *   6. Payload collections — ccpa_erasure_records, consent_log
 */

// Payload collections
export { ccpaErasureRecordsCollection } from './collections/ccpa-erasure-records.js'
export { consentLogCollection } from './collections/consent-log.js'

import type { CollectionConfig } from 'payload'
import { ccpaErasureRecordsCollection } from './collections/ccpa-erasure-records.js'
import { consentLogCollection } from './collections/consent-log.js'

/** Aggregate exported for buildPayloadConfig consumers. */
export const complianceCollections: CollectionConfig[] = [
  ccpaErasureRecordsCollection,
  consentLogCollection,
]

// Access helpers (re-exported for downstream packages that need the same role/agency model)
export {
  collectionAccess,
  deleteAccess,
  fieldImmutable,
  superAdminOnly,
} from './access/collection-access.js'

// Consent infrastructure (Surface 6 + provider)
export { ConsentProvider, useConsent } from './consent/consent-provider.js'
export type { ConsentState } from './consent/consent-provider.js'
export { CookieHintBanner } from './consent/cookie-hint-banner.js'

// Opt-out (Surface 4)
export { OptOutFooterLink } from './opt-out/opt-out-footer-link.js'
export { OptOutModal } from './opt-out/opt-out-modal.js'
export { startOptOutFanoutWorker } from './opt-out/opt-out-fanout-worker.js'

// Erasure (Surface 3 + Surface 5 + worker + audit)
export { ErasureFormClient } from './erasure/erasure-form-client.js'
export { ErasureConfirmPage } from './erasure/erasure-confirm-page.js'
export { createErasureToken, verifyErasureToken } from './erasure/token.js'
export type { ErasureTokenPayload } from './erasure/token.js'
export { writeAuditRow } from './erasure/audit.js'
export { startErasureWorker } from './erasure/worker.js'
export { generateErasureReceiptPdf } from './erasure/generate-pdf.js'
export type { GenerateErasureReceiptPdfInput } from './erasure/generate-pdf.js'
export { shouldHonorLegalHold } from './erasure/legal-hold.js'
export type { LegalHoldRules } from './erasure/legal-hold.js'
