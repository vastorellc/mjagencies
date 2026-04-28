/**
 * packages/compliance/src/consent/consent-provider.tsx
 * Plan 11-05 / REQ-144 D-01 / D-02:
 * ConsentProvider Context + useConsent() hook.
 *
 * Initial value (`initial` prop) is computed server-side from the mj_consent cookie
 * inside each app's layout.tsx — this prevents a pre-consent flash when scripts
 * decide whether to fire (D-02).
 *
 * Cookie semantics (CCPA opt-out model — US v1):
 *   absent or 'tracking_allowed' → tracking enabled (default-on)
 *   'tracking_blocked'           → tracking disabled
 *
 * The cookie is httpOnly:false so browser code can read it via document.cookie if
 * needed (e.g. modal already-opted-out detection); however the canonical state in
 * React lives in this provider and flows down through useConsent().
 */
'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type ConsentState = 'tracking_allowed' | 'tracking_blocked'

interface ConsentContextValue {
  state: ConsentState
  setState: (s: ConsentState) => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export interface ConsentProviderProps {
  /** Server-computed value from `cookies().get('mj_consent')` in layout.tsx */
  initial: ConsentState
  children: ReactNode
}

export function ConsentProvider({ initial, children }: ConsentProviderProps) {
  const [state, setState] = useState<ConsentState>(initial)
  return (
    <ConsentContext.Provider value={{ state, setState }}>
      {children}
    </ConsentContext.Provider>
  )
}

/**
 * Returns current consent state ('tracking_allowed' | 'tracking_blocked')
 * and a setter (e.g. when the OptOutModal confirms a change before the page
 * reloads). Throws if used outside ConsentProvider.
 */
export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) {
    throw new Error('useConsent must be used inside <ConsentProvider>')
  }
  return ctx
}
