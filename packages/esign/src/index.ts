/**
 * packages/esign/src/index.ts
 * Barrel export for @mjagency/esign.
 *
 * Exports:
 * - esignRecordsCollection  — Payload collection (register in apps/web-*/src/payload.config.ts)
 * - esignCollections        — CollectionConfig[] convenience array
 * - handleSignProposal      — sign flow: validate → PDF → R2 → audit record → proposal status
 * - generateEsignPdf        — PDF generation (pdf-lib)
 * - startEsignWorker        — BullMQ worker: email both parties → CRM won → invoice
 * - SignaturePad             — React component: signature canvas (dynamic import, SSR-safe)
 * - EsignDisclosure          — React component: ESIGN Act disclosure text
 * - ESIGN_DISCLOSURE_TEXT   — string constant (also embedded in PDF + audit record)
 */
export { esignRecordsCollection } from './collections/esign-records.js'
export { handleSignProposal } from './actions/sign-proposal.js'
export type {
  SignProposalInput,
  SignProposalOutput,
  EsignCompletionJobData,
} from './actions/sign-proposal.js'
export { generateEsignPdf } from './pdf/generate-pdf.js'
export type { GenerateEsignPdfInput, GenerateEsignPdfOutput } from './pdf/generate-pdf.js'
export { startEsignWorker } from './workers/esign-worker.js'
export { SignaturePad } from './components/SignaturePad.js'
export type { SignaturePadProps } from './components/SignaturePad.js'
export { EsignDisclosure, ESIGN_DISCLOSURE_TEXT } from './components/EsignDisclosure.js'

import type { CollectionConfig } from 'payload'
import { esignRecordsCollection } from './collections/esign-records.js'
export const esignCollections: CollectionConfig[] = [esignRecordsCollection]
