/**
 * packages/analytics/src/clarity-init.tsx
 * REQ-141 + D-01/D-02: Microsoft Clarity heatmaps + session recordings.
 *
 * The CONSENT decision is computed server-side (in layout.tsx via mj_consent cookie)
 * and passed as a prop. The component only calls Clarity.init() in the browser when
 * consent allows — preventing pre-consent flash because the component does nothing
 * on first paint when consent is denied (T-11-02-04 mitigation).
 *
 * Mask Mode = 'Strict' is configured in the Clarity project DASHBOARD (NOT in code) —
 * see docs/runbooks/clarity-project-setup.md (T-11-02-01 + T-11-02-02 mitigations).
 *
 * The @microsoft/clarity NPM package handles its own script injection — no inline
 * eval is used, so the per-request CSP nonce (Plan 11-07) is honored automatically.
 */
'use client'

import { useEffect } from 'react'
import Clarity from '@microsoft/clarity'

export interface ClarityInitProps {
  /** Per-agency Clarity Project ID (NEXT_PUBLIC_* — public by design, like GA4 MID). */
  projectId: string
  /** Computed server-side from mj_consent cookie. true = D-01 default-on, false = blocked. */
  consent: boolean
  /**
   * Optional: SHA-256 of email for cross-session identification.
   * Plan 11-05 erasure flow uses this to map email → clarityUserId for the Delete API.
   */
  customId?: string
}

/**
 * Mounts Microsoft Clarity in the browser when consent allows.
 * Returns null — this is a side-effect-only component.
 */
export function ClarityInit({ projectId, consent, customId }: ClarityInitProps): null {
  useEffect(() => {
    // D-01/D-02 consent gate — the only place Clarity.init() is invoked
    if (!consent) return
    if (!projectId) return

    Clarity.init(projectId)
    // Signal Clarity's own consent layer (default-on under CCPA opt-out model — D-01)
    Clarity.consent()

    if (customId) {
      Clarity.identify(customId)
    }
  }, [consent, projectId, customId])

  return null
}

/**
 * Helper for emitting custom Clarity events with PII redaction.
 *
 * Phase 7 reuse: every tag value passes through redactPii() (REQ-084) so
 * email/phone/SSN/CC/IP cannot leak into Clarity even via developer error.
 *
 * @microsoft/clarity@1.0.2 actual API:
 *   - Clarity.event(eventName)  — fires the event (no payload argument)
 *   - Clarity.setTag(key, val)  — attaches metadata to the current session
 *
 * We use both: setTag() to record redacted metadata, then event() to flag the action.
 *
 * Lazy-imports @mjagency/ai so the full PII redactor surface does not bloat the
 * client bundle of pages that never emit custom events.
 */
export async function emitClarityEvent(
  eventName: string,
  data: Record<string, string> = {},
): Promise<void> {
  const { redactPii } = await import('@mjagency/ai')
  for (const [key, value] of Object.entries(data)) {
    const redacted = redactPii(value).redacted
    Clarity.setTag(key, redacted)
  }
  Clarity.event(eventName)
}
