/**
 * packages/analytics/src/clarity-script.tsx
 * REQ-141 + D-01/D-02: server-component wrapper for Microsoft Clarity init.
 *
 * Server component — reads cookies server-side (Next.js 15 App Router) and passes the
 * consent boolean as a prop to the 'use client' ClarityInit. This is the canonical
 * mount point used by all 13 app layouts — symmetric with GA4InjectScript (Plan 11-01).
 *
 * Pre-consent flash impossible:
 *   - cookies().get('mj_consent') === 'tracking_blocked' → renders null (no client component mounts)
 *   - otherwise → ClarityInit hydrates with consent=true; useEffect fires Clarity.init()
 *
 * Default-on tracking (D-01/D-02): only blocks when user explicitly opted out.
 *
 * The @microsoft/clarity NPM package handles its own script injection (no inline
 * eval), so the per-request CSP nonce (Plan 11-07) is honored automatically via
 * the script-src 'strict-dynamic' allowlist for clarity.ms domain.
 */
import { cookies } from 'next/headers'
import type { JSX } from 'react'
import { ClarityInit } from './clarity-init.js'

export interface ClarityInjectScriptProps {
  /** Per-agency Clarity Project ID (NEXT_PUBLIC_CLARITY_PROJECT_ID). */
  projectId: string
  /** Optional SHA-256 of email for cross-session identification (Plan 11-05). */
  customId?: string
}

/**
 * Server-component wrapper around the 'use client' ClarityInit component.
 * Reads mj_consent cookie SSR; renders null when tracking is blocked.
 */
export async function ClarityInjectScript({
  projectId,
  customId,
}: ClarityInjectScriptProps): Promise<JSX.Element | null> {
  const consent = (await cookies()).get('mj_consent')?.value
  // D-01/D-02 — default-on under CCPA opt-out model
  if (consent === 'tracking_blocked') return null
  if (!projectId) return null

  return <ClarityInit projectId={projectId} consent={true} customId={customId} />
}
