/**
 * apps/web-realestate/src/app/(frontend)/layout.tsx
 * Plan 11-05 / REQ-144 — public-app layout wrapped in ConsentProvider.
 * SSR-computed initial value from mj_consent cookie (D-02 — no flash).
 */
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import {
  ConsentProvider,
  CookieHintBanner,
  OptOutModal,
  type ConsentState,
} from '@mjagency/compliance'

const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? 'web-realestate'

export const metadata: Metadata = {
  title: `MJAgency — ${AGENCY_NAME}`,
  description: `MJAgency platform — ${AGENCY_NAME}.`,
}

export default async function FrontendLayout({ children }: { children: ReactNode }): Promise<React.JSX.Element> {
  const cookieJar = await cookies()
  const consent: ConsentState =
    cookieJar.get('mj_consent')?.value === 'tracking_blocked' ? 'tracking_blocked' : 'tracking_allowed'
  const hintDismissed = cookieJar.get('mj_consent_hint_dismissed')?.value === '1'

  return (
    <ConsentProvider initial={consent}>
      {children}
      <OptOutModal />
      {!hintDismissed && <CookieHintBanner />}
    </ConsentProvider>
  )
}
