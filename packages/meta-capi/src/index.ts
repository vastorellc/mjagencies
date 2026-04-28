/**
 * @mjagency/meta-capi — server-side Meta Conversions API client.
 *
 * D-10: Server-side ONLY. NO browser pixel.
 * REQ-142: Lead + Purchase emission paths via BullMQ encrypted queue.
 *
 * Public surface:
 *   sendCapiEvent       — direct fetch to graph.facebook.com (sync send)
 *   enqueueCapiEvent    — BullMQ-mediated retry-safe send (preferred call site)
 *   startCapiWorker     — drains the meta-capi-events queue per agency
 *   getAgencySecret     — per-agency env lookup (re-exported for callers that
 *                          need to validate META_PIXEL_ID_* presence)
 */

export { sendCapiEvent } from './meta-capi.js'
export type { CapiEvent, CapiUserData } from './meta-capi.js'
export { enqueueCapiEvent, startCapiWorker } from './meta-capi-queue.js'
export { getAgencySecret, getAgencySecretOptional } from './per-agency-env.js'
