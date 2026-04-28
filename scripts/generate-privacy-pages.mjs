#!/usr/bin/env node
/**
 * One-shot generator for Plan 11-05 public-facing privacy pages.
 *   /privacy            — Surface 5 privacy policy with 30-day SLA published
 *   /privacy/erasure    — Surface 3 ErasureFormClient host
 *   /privacy/erasure/confirm — Surface 3 Step 2 ErasureConfirmPage host
 *
 * One file per agency app. Each agency reads NEXT_PUBLIC_AGENCY_NAME and
 * NEXT_PUBLIC_AGENCY_DOMAIN from env so copy stays per-agency without code changes.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const APPS = [
  ['web-main', 'MJ Agency', 'mjagency.com'],
  ['web-ecommerce', 'MJ Ecommerce', 'ecommerce.mjagency.com'],
  ['web-realestate', 'MJ Real Estate', 'realestate.mjagency.com'],
  ['web-healthcare', 'MJ Healthcare', 'healthcare.mjagency.com'],
  ['web-legal', 'MJ Legal', 'legal.mjagency.com'],
  ['web-homeservices', 'MJ Home Services', 'homeservices.mjagency.com'],
  ['web-fitness', 'MJ Fitness', 'fitness.mjagency.com'],
  ['web-dental', 'MJ Dental', 'dental.mjagency.com'],
  ['web-automotive', 'MJ Automotive', 'automotive.mjagency.com'],
  ['web-restaurant', 'MJ Restaurant', 'restaurant.mjagency.com'],
  ['web-education', 'MJ Education', 'education.mjagency.com'],
  ['web-financial', 'MJ Financial', 'financial.mjagency.com'],
  ['web-petcare', 'MJ Pet Care', 'petcare.mjagency.com'],
]

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

function privacyPage(slug, displayName) {
  return `/**
 * apps/${slug}/src/app/(frontend)/privacy/page.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 5 — public privacy policy.
 *
 * 30-day SLA published per D-06 — California Civil Code §1798.135 wording compliant.
 * Anchor #opt-out is the no-JS fallback target for the footer "Do Not Sell or Share"
 * link. The "Open Tracking Settings" CTA dispatches the same opt-out modal event
 * used by the footer link (Surface 4).
 *
 * Server component — pure copy + token-driven styles. Zero hex literals (Phase 4 AJV).
 */
import type { Metadata } from 'next'
import { OpenTrackingSettingsButton } from '@/components/open-tracking-settings'

const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? '${displayName}'
const AGENCY_DOMAIN = process.env['NEXT_PUBLIC_AGENCY_DOMAIN'] ?? '${slug}.mjagency.com'

export const metadata: Metadata = {
  title: \`Privacy · \${AGENCY_NAME}\`,
  description: \`Privacy policy for \${AGENCY_NAME}. CCPA opt-out and erasure rights, 30-day deletion SLA.\`,
  robots: { index: true, follow: true },
}

const pageStyle: React.CSSProperties = {
  maxWidth: 'var(--mj-container-md)',
  margin: '0 auto',
  padding: 'var(--mj-space-16) var(--mj-space-6) var(--mj-space-12)',
  color: 'var(--mj-color-text-primary)',
}

const h1Style: React.CSSProperties = { fontSize: '36px', fontWeight: 700, margin: 0 }
const updatedStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--mj-color-text-secondary)',
  margin: 0,
  marginBottom: 'var(--mj-space-8)',
}
const tocStyle: React.CSSProperties = {
  background: 'var(--mj-color-bg-secondary)',
  borderRadius: 'var(--mj-radius-lg)',
  padding: 'var(--mj-space-6)',
  marginBottom: 'var(--mj-space-12)',
}
const h2Style: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  margin: 0,
  marginTop: 'var(--mj-space-12)',
  marginBottom: 'var(--mj-space-3)',
  scrollMarginTop: 'var(--mj-space-16)',
}
const bodyStyle: React.CSSProperties = { fontSize: '16px', lineHeight: 1.5, margin: 0, marginBottom: 'var(--mj-space-3)' }
const listStyle: React.CSSProperties = { paddingLeft: 'var(--mj-space-6)', margin: 0, marginBottom: 'var(--mj-space-4)' }
const ctaPrimary: React.CSSProperties = {
  display: 'inline-block',
  background: 'var(--mj-color-brand-500)',
  color: 'var(--mj-color-text-on-brand)',
  borderRadius: 'var(--mj-radius-md)',
  padding: 'var(--mj-space-3) var(--mj-space-6)',
  minHeight: '44px',
  fontSize: '16px',
  fontWeight: 700,
  textDecoration: 'none',
  marginTop: 'var(--mj-space-3)',
}

export default function PrivacyPage(): React.JSX.Element {
  const lastUpdated = 'April 28, 2026'

  return (
    <main id="main-content" style={pageStyle}>
      <h1 style={h1Style}>Privacy</h1>
      <p style={updatedStyle}>Last updated: {lastUpdated}</p>

      <nav aria-label="On this page" style={tocStyle}>
        <strong>On this page</strong>
        <ol style={listStyle}>
          <li><a href="#what-we-collect">What we collect</a></li>
          <li><a href="#how-we-use">How we use your data</a></li>
          <li><a href="#data-systems">Data systems we use</a></li>
          <li><a href="#your-rights">Your rights under CCPA</a></li>
          <li><a href="#opt-out">Stop tracking (opt out)</a></li>
          <li><a href="#erasure">Request data deletion</a></li>
          <li><a href="#contact">Contact us</a></li>
        </ol>
      </nav>

      <h2 id="what-we-collect" style={h2Style}>What we collect</h2>
      <p style={bodyStyle}>
        We collect information you give us directly (names, emails, form submissions) and information
        gathered automatically as you browse our site (page views, cookies, anonymized device data).
      </p>

      <h2 id="how-we-use" style={h2Style}>How we use your data</h2>
      <p style={bodyStyle}>
        We use your data to provide our services, respond to your requests, and improve our site.
        We do not sell your data to third parties for advertising purposes outside of the systems
        listed below.
      </p>

      <h2 id="data-systems" style={h2Style}>Data systems we use</h2>
      <p style={bodyStyle}>We share data with the following third-party systems:</p>
      <ul style={listStyle}>
        <li><strong>Google Analytics 4</strong> — site usage and conversion tracking</li>
        <li><strong>Microsoft Clarity</strong> — session recordings with personal data masked by default</li>
        <li><strong>Meta (Facebook/Instagram)</strong> — ad measurement; server-side only, no browser pixel</li>
        <li><strong>Stripe / PayPal</strong> — payment processing for invoices and tools</li>
        <li><strong>Cloudflare</strong> — performance, security, and bot protection</li>
      </ul>

      <h2 id="your-rights" style={h2Style}>Your rights under CCPA</h2>
      <p style={bodyStyle}>
        California residents have the right to know what personal information we collect, request
        deletion of that information, and opt out of its sale or sharing. You can exercise any of
        these rights at no cost. We will respond to verified requests within 30 days.
      </p>

      <h2 id="opt-out" style={h2Style}>Stop tracking</h2>
      <p style={bodyStyle}>
        You can stop us from sharing your personal information at any time. Use the button below or
        the &quot;Do Not Sell or Share My Personal Information&quot; link in the footer of any page on this site.
      </p>
      <OpenTrackingSettingsButton />

      <h2 id="erasure" style={h2Style}>Request data deletion</h2>
      <p style={bodyStyle}>
        California residents can request deletion of all personal data we hold. We complete deletion
        requests within <strong>30 days</strong> — most requests complete the same day. You&apos;ll
        receive a signed completion receipt by email.
      </p>
      <a href="/privacy/erasure" style={ctaPrimary}>Request Data Deletion</a>

      <h2 id="contact" style={h2Style}>Contact us</h2>
      <p style={bodyStyle}>Questions about this policy or your data? Email privacy@{AGENCY_DOMAIN}.</p>
    </main>
  )
}
`
}

function erasurePage(slug, displayName) {
  return `/**
 * apps/${slug}/src/app/(frontend)/privacy/erasure/page.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 3 (Step 1) — public CCPA erasure form.
 */
import type { Metadata } from 'next'
import { ErasureFormClient } from '@mjagency/compliance'

const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? '${displayName}'
const AGENCY_DOMAIN = process.env['NEXT_PUBLIC_AGENCY_DOMAIN'] ?? '${slug}.mjagency.com'

export const metadata: Metadata = {
  title: \`Request Data Deletion · \${AGENCY_NAME}\`,
  description: 'Request deletion of your personal data under the CCPA.',
  robots: { index: true, follow: true },
}

export default function ErasurePage(): React.JSX.Element {
  return <ErasureFormClient agencyName={AGENCY_NAME} agencyDomain={AGENCY_DOMAIN} />
}
`
}

function erasureConfirmPage(slug, displayName) {
  return `/**
 * apps/${slug}/src/app/(frontend)/privacy/erasure/confirm/page.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 3 (Step 2) — verification confirm page.
 */
import type { Metadata } from 'next'
import { ErasureConfirmPage } from '@mjagency/compliance'

const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? '${displayName}'

export const metadata: Metadata = {
  title: \`Confirm Data Deletion · \${AGENCY_NAME}\`,
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function ConfirmPage(props: PageProps): Promise<React.JSX.Element> {
  return <ErasureConfirmPage searchParams={props.searchParams} agencyName={AGENCY_NAME} />
}
`
}

function openTrackingSettingsButton(slug) {
  return `/**
 * apps/${slug}/src/components/open-tracking-settings.tsx
 * Plan 11-05 / UI-SPEC Surface 5 — privacy page CTA that opens the Surface 4 modal.
 */
'use client'
import { type CSSProperties } from 'react'

const OPT_OUT_OPEN_EVENT = 'mjagency:open-opt-out-modal'

const style: CSSProperties = {
  background: 'var(--mj-color-brand-500)',
  color: 'var(--mj-color-text-on-brand)',
  border: 'none',
  borderRadius: 'var(--mj-radius-md)',
  padding: 'var(--mj-space-3) var(--mj-space-6)',
  minHeight: '44px',
  fontSize: '16px',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 'var(--mj-space-3)',
}

export function OpenTrackingSettingsButton(): React.JSX.Element {
  function handleClick(): void {
    window.dispatchEvent(new CustomEvent(OPT_OUT_OPEN_EVENT))
  }
  return (
    <button type="button" onClick={handleClick} style={style}>
      Open Tracking Settings
    </button>
  )
}
`
}

for (const [slug, displayName] of APPS) {
  const fe = join(repoRoot, 'apps', slug, 'src', 'app', '(frontend)')
  const privacyDir = join(fe, 'privacy')
  const erasureDir = join(privacyDir, 'erasure')
  const confirmDir = join(erasureDir, 'confirm')
  const compsDir = join(repoRoot, 'apps', slug, 'src', 'components')
  mkdirSync(privacyDir, { recursive: true })
  mkdirSync(erasureDir, { recursive: true })
  mkdirSync(confirmDir, { recursive: true })
  mkdirSync(compsDir, { recursive: true })

  writeFileSync(join(privacyDir, 'page.tsx'), privacyPage(slug, displayName))
  writeFileSync(join(erasureDir, 'page.tsx'), erasurePage(slug, displayName))
  writeFileSync(join(confirmDir, 'page.tsx'), erasureConfirmPage(slug, displayName))
  writeFileSync(join(compsDir, 'open-tracking-settings.tsx'), openTrackingSettingsButton(slug))
  console.log(`generated ${slug} privacy pages`)
}
console.log('done')
