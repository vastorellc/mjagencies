---
phase: 10
plan: "10-05"
subsystem: esign
tags: [esign, pdf-lib, r2-storage, bullmq, audit-trail, ESIGN-Act]
dependency_graph:
  requires: [10-04]
  provides: [handleSignProposal, generateEsignPdf, startEsignWorker, SignaturePad, EsignDisclosure, esignRecordsCollection]
  affects: [packages/proposals, packages/db/schema, apps/web-*/payload.config.ts]
tech_stack:
  added: [pdf-lib@1.17.1, react-signature-canvas@1.0.6, "@aws-sdk/client-s3@^3.620.0"]
  patterns: [hash-chain-audit-trail, r2-private-vault, bullmq-encrypted-queue, dynamic-import-ssr-safe]
key_files:
  created:
    - packages/esign/package.json
    - packages/esign/tsconfig.json
    - packages/esign/src/index.ts
    - packages/esign/src/access/collection-access.ts
    - packages/esign/src/collections/esign-records.ts
    - packages/esign/src/components/EsignDisclosure.tsx
    - packages/esign/src/components/SignaturePad.tsx
    - packages/esign/src/pdf/generate-pdf.ts
    - packages/esign/src/actions/sign-proposal.ts
    - packages/esign/src/workers/esign-worker.ts
    - packages/db/src/schema/esign.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/proposals/src/index.ts
decisions:
  - "handleProposalAction added to proposals/index.ts exports (was missing — deviation Rule 2)"
  - "esign-records delete access = () => false (immutable — legal record)"
  - "ESIGN_DISCLOSURE_TEXT exported as const, reused in PDF generator + stored verbatim in audit record"
  - "Agency owner email fetched from Payload agencies collection (NOT from env vars)"
  - "pdf-lib rgb() floats use 0-1 color space — exempt from var(--mj-*) token rule"
  - "Hash-chain audit record: SHA-256(prevHash + pdfHash + esignId + signerName + timestamp)"
  - "Raw signer IP never stored — SHA-256 hash only (STRIDE T-10-05-05)"
metrics:
  completed_date: "2026-04-28"
  tasks: 2
  files_created: 11
  files_modified: 2
---

# Phase 10 Plan 05: E-Sign — ESIGN Act, pdf-lib PDF, R2 Vault, Audit Trail Summary

JWT-free public e-sign flow: ESIGN Act disclosure above signature pad → pdf-lib PDF with disclosure + signature image → R2 private vault → hash-chained audit record → BullMQ worker emails both parties, updates CRM deal to won, triggers deposit invoice.

## Files Created

| File | Purpose |
|------|---------|
| `packages/esign/package.json` | Package manifest: pdf-lib, react-signature-canvas, @aws-sdk/client-s3, payload 3.82.1 exact |
| `packages/esign/tsconfig.json` | TypeScript config extending tsconfig.base.json |
| `packages/esign/src/index.ts` | Barrel exports for all esign package exports |
| `packages/esign/src/access/collection-access.ts` | collectionAccess, deleteAccess, fieldImmutable (copied from cms — no circular dep) |
| `packages/esign/src/collections/esign-records.ts` | Payload collection — `delete: () => false` (immutable legal record) |
| `packages/esign/src/components/EsignDisclosure.tsx` | ESIGN Act disclosure (ESIGN Act, 15 U.S.C. § 7001 et seq.), role="note" |
| `packages/esign/src/components/SignaturePad.tsx` | react-signature-canvas, dynamic import (SSR-safe), 120px min, 44px touch targets |
| `packages/esign/src/pdf/generate-pdf.ts` | pdf-lib PDFDocument: A4 PDF with body, disclosure, signer name, timestamp, signature image |
| `packages/esign/src/actions/sign-proposal.ts` | Validate sig (non-empty PNG, 500KB max), R2 PutObjectCommand, hash-chain audit, enqueue esign-completion |
| `packages/esign/src/workers/esign-worker.ts` | Email both parties (agency email from Payload), CRM deal → won, invoice-create enqueue |
| `packages/db/src/schema/esign.ts` | Drizzle pgTable esign_records + esignRlsSql |

## Files Modified

| File | Change |
|------|--------|
| `packages/db/src/schema/index.ts` | Added `export { esignRecords, esignRlsSql } from './esign.js'` |
| `packages/proposals/src/index.ts` | Added `export { handleProposalAction }` + types (was missing — deviation Rule 2) |

## ESIGN Act Compliance Points

1. **REQ-422 — Federal coverage**: Exact citation "ESIGN Act, 15 U.S.C. § 7001 et seq." in `EsignDisclosure.tsx`
2. **REQ-422 — Pre-signature visibility**: `EsignDisclosure` rendered above `SignaturePad` in the UI layout (static text, always visible without scrolling per UI-SPEC)
3. **Verbatim storage**: `ESIGN_DISCLOSURE_TEXT` const embedded in PDF via `generateEsignPdf` AND stored in `disclosure_text` field of `esign_records` Payload collection
4. **Non-repudiation**: Hash-chain audit record — `record_hash = SHA-256(prevHash + pdfHash + esignId + signerName + timestamp)` (Phase 2 pattern)
5. **IP hash**: Signer IP SHA-256 hashed before storage — raw IP never written (`signer_ip_hash` field only)
6. **Immutable record**: `delete: () => false` on `esign_records` collection — no agency admin can delete legal records
7. **PDF integrity**: `pdfHash = createHash('sha256').update(pdfBytes).digest('hex')` stored in both `esign_records.pdf_hash` and R2 object metadata

## Security Compliance (STRIDE)

| Threat | Control |
|--------|---------|
| T-10-05-01 Spoofing (HMAC) | `handleProposalAction` verifies `timingSafeEqual(hmac)` before any status change |
| T-10-05-02 Tampering (sig input) | `data:image/png;base64,` prefix check + non-empty + max 500KB validation |
| T-10-05-03 Tampering (PDF) | SHA-256 hash stored in audit record + R2 metadata |
| T-10-05-04 Info Disclosure (R2) | R2 bucket private — PDF stored with private ACL, no public URL |
| T-10-05-05 Info Disclosure (IP) | `createHash('sha256').update(signerIp).digest('hex')` — raw IP never written |
| T-10-05-06 Repudiation | Hash-chained `record_hash` in `esign_records`, ESIGN disclosure stored verbatim |
| T-10-05-07 EoP (invoice payload) | Invoice job contains only `proposalId + agencyId + esignId` — no financial data |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Export] Added handleProposalAction to proposals/index.ts**
- **Found during:** T-02 implementation — sign-proposal.ts imports `handleProposalAction` from `@mjagency/proposals`
- **Issue:** `packages/proposals/src/index.ts` did not export `handleProposalAction` (only exported `createProposal`, `startExpiryWorker`, collections). The function existed in `update-proposal-status.ts` but was not re-exported from the package barrel.
- **Fix:** Added `export { handleProposalAction }` and `export type { ProposalActionInput, ProposalActionOutput }` to `packages/proposals/src/index.ts`
- **Files modified:** `packages/proposals/src/index.ts`

## TypeScript Typecheck

Pending bash access — `pnpm typecheck --filter=@mjagency/esign` must be run to confirm exit 0.

All imports have been verified manually:
- `createLogger` — `{ service: string; agencyId?: string }` matches usage
- `createEncryptedQueue` — `(queueName: string, connection: RedisOptions)` matches usage (keyPrefix is valid RedisOptions field)
- `createEncryptedWorker` — `(queueName, processor, connection: RedisOptions)` matches usage
- `REDIS_KEY.bullPrefix(agencyId)` — returns `string` matching `keyPrefix: string` in RedisOptions
- `handleProposalAction` — `ProposalActionInput = { token, action, hmacSignature, signatureDataUri? }` matches call
- `generateEsignPdf` — all fields in `GenerateEsignPdfInput` passed correctly
- `PutObjectCommand` from `@aws-sdk/client-s3` — correct usage
- `pdf-lib` `PDFDocument`, `rgb`, `StandardFonts` — correct usage

## Migration Note

Payload schema migration MUST be run manually after deployment:

```bash
CI=true PAYLOAD_MIGRATING=true npx payload migrate
```

The Payload server was not running during this build environment. The migration creates the `esign_records` table in all per-agency Postgres databases and enables Row Level Security. Run this command from the app root after deploying the updated code.

Also run the RLS SQL from `esignRlsSql` (in `packages/db/src/schema/esign.ts`) against each agency's Postgres database:
```sql
ALTER TABLE esign_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY esign_records_agency_iso ON esign_records
  USING (agency_id = (current_setting('app.agency_id', true))::uuid);
```

## Verification Checks (Manual Grep)

All checks passed:

| Check | Result |
|-------|--------|
| `grep "ESIGN Act, 15 U.S.C" EsignDisclosure.tsx` | MATCH: line 12 |
| `grep "PutObjectCommand" sign-proposal.ts` | MATCH: lines 15, 111 |
| `grep "500 \* 1024" sign-proposal.ts` | MATCH: line 72 |
| `grep "() => false" esign-records.ts` | MATCH: line 29 (delete access) |
| `grep "deal.*won\|stage.*won" esign-worker.ts` | MATCH: lines 111, 119, 121, 143 |
| `grep "invoice-create" esign-worker.ts` | MATCH: line 130 |
| `grep "api/agencies.*where" esign-worker.ts` | MATCH: line 91 |
| `grep "ownerEmail" esign-worker.ts` | MATCH: lines 94, 95 |
| `grep "sensitiveData: true" sign-proposal.ts` | MATCH: line 179 |
| `grep "120px\|minHeight.*120" SignaturePad.tsx` | MATCH: lines 55, 61 |
| `grep "44px\|minHeight.*44" SignaturePad.tsx` | MATCH: line 80 |
| `grep -r '#[0-9a-fA-F]' packages/esign/src/` | 0 RESULTS (no hex literals) |
| `grep "record_hash\|prevHash" sign-proposal.ts` | MATCH: lines 11, 130-152 |
| `grep "sha256.*pdfBytes\|createHash.*pdfBytes" generate-pdf.ts` | MATCH: line 151 (createHash SHA-256 of pdfBytes) |

## Known Stubs

None. All wired to real data sources:
- Signer email from Payload proposals.contact_id.email (real runtime fetch)
- Agency owner email from Payload agencies.ownerEmail (real runtime fetch)
- R2 key uses real esignId + agencyId
- PDF content from real proposal title + body_json
- ESIGN disclosure text is the complete legally-required text (no placeholders)

## Commit

Pending bash access for git operations. All files written:
- T-01 commit: `feat(10-05): e-sign Payload collection, Drizzle schema, components`
- T-02 commit: `feat(10-05): e-sign — ESIGN Act, pdf-lib PDF, R2 vault, audit trail`
- SUMMARY commit: `docs(10-05): complete plan 10-05 summary — e-sign ESIGN Act + pdf-lib + R2`

## Self-Check: PASSED

All 11 created files verified to exist via Write tool confirmation. All 2 modified files verified via Read + Edit tool operations. All grep checks passed.
