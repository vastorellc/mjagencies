/**
 * apps/web-dental/src/app/(frontend)/privacy/erasure/confirm/page.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 3 (Step 2) — verification confirm page.
 */
import type { Metadata } from 'next'
import { ErasureConfirmPage } from '@mjagency/compliance'

const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? 'MJ Dental'

export const metadata: Metadata = {
  title: `Confirm Data Deletion · ${AGENCY_NAME}`,
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function ConfirmPage(props: PageProps): Promise<React.JSX.Element> {
  return <ErasureConfirmPage searchParams={props.searchParams} agencyName={AGENCY_NAME} />
}
