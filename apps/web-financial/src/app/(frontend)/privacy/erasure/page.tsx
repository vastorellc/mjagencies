/**
 * apps/web-financial/src/app/(frontend)/privacy/erasure/page.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 3 (Step 1) — public CCPA erasure form.
 */
import type { Metadata } from 'next'
import { ErasureFormClient } from '@mjagency/compliance'

const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? 'MJ Financial'
const AGENCY_DOMAIN = process.env['NEXT_PUBLIC_AGENCY_DOMAIN'] ?? 'web-financial.mjagency.com'

export const metadata: Metadata = {
  title: `Request Data Deletion · ${AGENCY_NAME}`,
  description: 'Request deletion of your personal data under the CCPA.',
  robots: { index: true, follow: true },
}

export default function ErasurePage(): React.JSX.Element {
  return <ErasureFormClient agencyName={AGENCY_NAME} agencyDomain={AGENCY_DOMAIN} />
}
