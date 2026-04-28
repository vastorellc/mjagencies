/**
 * packages/cms/src/admin-views/BrandSetupView.tsx
 *
 * Plan 12-07 — Brand Setup Wizard RSC shell. Registered as a custom Payload
 * admin view at /admin/brand-setup.
 *
 * SECURITY (CLAUDE.md §3 + Plan 11-04 Pitfall 4.4):
 *   requireSession() is the FIRST runtime call. Payload custom admin views do
 *   NOT auto-authenticate — without this, any browser could load the view.
 *   Additionally, this view is restricted to super_admin role only; non-super_admin
 *   requests are redirected to /admin.
 *
 * NO INLINE STYLES (CLAUDE.md §7 CSP nonce):
 *   All styling via external CSS classes only. No style= attributes anywhere
 *   in this RSC shell.
 */
import 'server-only'
import type * as React from 'react'
import { redirect } from 'next/navigation'
import { requireSession } from '@mjagency/auth'
import { BrandSetupWizardClient } from './BrandSetupWizardClient.js'
import './brand-setup.css'

export default async function BrandSetupView(): Promise<React.ReactElement> {
  // CLAUDE.md §3 + Pitfall 4.4: requireSession FIRST. Throws/redirects for
  // unauthenticated requests.
  const session = await requireSession()
  if (session.role !== 'super_admin') {
    redirect('/admin')
  }

  return (
    <main className="brand-setup-page" aria-label="Brand Setup Wizard">
      <header className="brand-setup-page__header">
        <h1 className="brand-setup-page__title">Brand Setup</h1>
      </header>
      <BrandSetupWizardClient />
    </main>
  )
}
