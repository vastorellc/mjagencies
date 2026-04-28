'use client'
/**
 * packages/ui/src/nonce/nonce-provider.tsx
 *
 * Nonce React Context provider — Server Components in app/layout.tsx read the per-request
 * nonce from headers().get('x-nonce') and pass it to <NonceProvider nonce={nonce}>. Client
 * components consume via useNonce() to set the nonce attribute on inline <Script>/<style>
 * tags.
 *
 * REQ-145 / Plan 11-07: per-request nonce propagated through React tree for inline scripts.
 *
 * Pattern reference (Next.js 15 App Router):
 *   import { headers } from 'next/headers'
 *   const nonce = (await headers()).get('x-nonce') ?? ''
 *   return <NonceProvider nonce={nonce}>{children}</NonceProvider>
 */

import { createContext, useContext, type ReactNode } from 'react'

const NonceContext = createContext<string>('')

export interface NonceProviderProps {
  /** Per-request nonce string from middleware (x-nonce request header). */
  nonce: string
  children: ReactNode
}

export function NonceProvider({ nonce, children }: NonceProviderProps) {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>
}

/**
 * Returns the current per-request nonce string. Returns empty string if no provider
 * is mounted (test/SSR contexts that did not pass through middleware).
 */
export function useNonce(): string {
  return useContext(NonceContext)
}
