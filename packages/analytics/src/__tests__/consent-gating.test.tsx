/**
 * packages/analytics/src/__tests__/consent-gating.test.tsx
 *
 * Tier 2 unit tests for the CCPA enforcement boundary in browser-side
 * analytics scripts. These three Next.js server components MUST short-circuit
 * to `null` whenever the user's `mj_consent` cookie is `tracking_blocked`.
 *
 * Why this matters: the OptOutModal sets the cookie, but if any of these
 * scripts ignore it, the entire opt-out flow is decorative. A regression
 * here means continued tracking after opt-out — a CCPA §1798.135 violation.
 *
 * Strategy:
 *   - Mock `next/headers` to control the cookie value AND the per-request
 *     CSP nonce (REQ-146).
 *   - Mock `next/script` to a minimal stub so vitest doesn't need the Next.js
 *     runtime to import these server components.
 *   - Invoke the async server component as a plain function and inspect its
 *     return value:
 *         consent='tracking_blocked' → null
 *         consent='tracking_allowed' → JSX tree containing the script tags
 *         consent absent             → JSX tree (default-on, D-01/D-02)
 *
 * No DOM is needed because we never render — we only check the element tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

// ── Hoisted mock state ─────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  nonce: 'nonce-test-1234',
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'mj_consent' && mocks.cookieValue !== undefined
        ? { value: mocks.cookieValue }
        : undefined,
  }),
  headers: async () => ({
    get: (name: string) => (name === 'x-nonce' ? mocks.nonce : null),
  }),
}))

// next/script is a server-driven component. We replace it with a *string*
// component type — React.createElement treats strings as host element names,
// so the resulting JSX element tree has `type === 'next-script-stub'` and
// is trivially walkable without needing a Next.js runtime or React renderer.
vi.mock('next/script', () => ({
  default: 'next-script-stub',
}))

// Same trick for ClarityInit — its 'use client' transitive deps would otherwise
// drag in browser-only code under the node test environment.
vi.mock('../clarity-init.js', () => ({
  ClarityInit: 'clarity-init-stub',
}))

// ── Helpers ────────────────────────────────────────────────────────────────

function setCookie(value: string | undefined): void {
  mocks.cookieValue = value
}

/**
 * Walk an arbitrary React element tree (or fragment / array) and collect
 * every leaf element so we can assert "the GA4 script appears" without
 * depending on DOM serialisation.
 */
function flatten(node: unknown): unknown[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  const el = node as ReactElement & { props?: Record<string, unknown> }
  const children = el.props?.['children']
  return [el, ...flatten(children)]
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GA4InjectScript — consent gating (REQ-140 / D-01 / D-02)', () => {
  beforeEach(() => {
    setCookie(undefined)
  })

  it('Test 1: consent=tracking_blocked → returns null (no script injected)', async () => {
    setCookie('tracking_blocked')
    const { GA4InjectScript } = await import('../ga4-script.js')
    const result = await GA4InjectScript({ measurementId: 'G-TEST-1' })
    expect(result).toBeNull()
  })

  it('Test 2: consent=tracking_allowed → returns a non-null element tree', async () => {
    setCookie('tracking_allowed')
    const { GA4InjectScript } = await import('../ga4-script.js')
    const result = await GA4InjectScript({ measurementId: 'G-TEST-2' })
    expect(result).not.toBeNull()
  })

  it('Test 3: cookie absent → default-on tracking (returns element tree)', async () => {
    setCookie(undefined) // cookie not set yet — first visit
    const { GA4InjectScript } = await import('../ga4-script.js')
    const result = await GA4InjectScript({ measurementId: 'G-TEST-3' })
    expect(result).not.toBeNull()
  })

  it('Test 4: rendered tree includes a Script tag pointing at gtag.js with the measurementId', async () => {
    setCookie('tracking_allowed')
    const { GA4InjectScript } = await import('../ga4-script.js')
    const result = await GA4InjectScript({ measurementId: 'G-FOO-BAR-9' })
    const all = flatten(result)
    const scripts = all.filter((n) => (n as { type?: string }).type === 'next-script-stub')
    const srcScript = scripts.find((s) =>
      String((s as { props: { src?: string } }).props.src ?? '').includes('gtag/js?id=G-FOO-BAR-9'),
    )
    expect(srcScript).toBeDefined()
  })

  it('Test 5: per-request nonce from x-nonce header is propagated to all <Script> tags (REQ-146)', async () => {
    setCookie('tracking_allowed')
    mocks.nonce = 'nonce-fixture-abc'
    const { GA4InjectScript } = await import('../ga4-script.js')
    const result = await GA4InjectScript({ measurementId: 'G-X' })
    const scripts = flatten(result).filter(
      (n) => (n as { type?: string }).type === 'next-script-stub',
    )
    expect(scripts.length).toBeGreaterThan(0)
    for (const s of scripts) {
      expect((s as { props: { nonce?: string } }).props.nonce).toBe('nonce-fixture-abc')
    }
  })
})

describe('MetaPixelScript — consent gating (REQ-142)', () => {
  beforeEach(() => {
    setCookie(undefined)
  })

  it('Test 6: consent=tracking_blocked → returns null', async () => {
    setCookie('tracking_blocked')
    const { MetaPixelScript } = await import('../meta-pixel.js')
    const result = await MetaPixelScript({ pixelId: '12345' })
    expect(result).toBeNull()
  })

  it('Test 7: consent=tracking_allowed → returns element tree', async () => {
    setCookie('tracking_allowed')
    const { MetaPixelScript } = await import('../meta-pixel.js')
    const result = await MetaPixelScript({ pixelId: '67890' })
    expect(result).not.toBeNull()
  })

  it('Test 8: rendered tree contains the pixelId in the init script body', async () => {
    setCookie('tracking_allowed')
    const { MetaPixelScript } = await import('../meta-pixel.js')
    const result = await MetaPixelScript({ pixelId: 'PIXEL-99-Z' })
    const all = flatten(result)
    const scripts = all.filter((n) => (n as { type?: string }).type === 'next-script-stub')
    const initScript = scripts.find((s) =>
      String((s as { props: { children?: string } }).props.children ?? '').includes(
        "fbq('init', 'PIXEL-99-Z')",
      ),
    )
    expect(initScript).toBeDefined()
  })
})

describe('ClarityInjectScript — consent gating (REQ-141)', () => {
  beforeEach(() => {
    setCookie(undefined)
  })

  it('Test 9: consent=tracking_blocked → returns null (ClarityInit never mounts)', async () => {
    setCookie('tracking_blocked')
    const { ClarityInjectScript } = await import('../clarity-script.js')
    const result = await ClarityInjectScript({ projectId: 'clarity-1' })
    expect(result).toBeNull()
  })

  it('Test 10: empty projectId → returns null even when consent allowed', async () => {
    setCookie('tracking_allowed')
    const { ClarityInjectScript } = await import('../clarity-script.js')
    const result = await ClarityInjectScript({ projectId: '' })
    expect(result).toBeNull()
  })

  it('Test 11: consent=tracking_allowed + valid projectId → mounts ClarityInit with consent=true', async () => {
    setCookie('tracking_allowed')
    const { ClarityInjectScript } = await import('../clarity-script.js')
    const result = await ClarityInjectScript({ projectId: 'clarity-xyz', customId: 'sha256-hash' })
    expect(result).not.toBeNull()
    const el = result as { type: string; props: Record<string, unknown> }
    expect(el.type).toBe('clarity-init-stub')
    expect(el.props.projectId).toBe('clarity-xyz')
    expect(el.props.customId).toBe('sha256-hash')
    expect(el.props.consent).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Cross-cutting safety check: the three components share the same gating
// behaviour. If the CCPA cookie value drifts from 'tracking_blocked', this
// test catches the mismatch in any one of them.
// ──────────────────────────────────────────────────────────────────────────

describe('All three scripts agree on the same opt-out cookie value', () => {
  it('Test 12: only the literal "tracking_blocked" suppresses; other values pass', async () => {
    const { GA4InjectScript } = await import('../ga4-script.js')
    const { MetaPixelScript } = await import('../meta-pixel.js')
    const { ClarityInjectScript } = await import('../clarity-script.js')

    // Anything OTHER than 'tracking_blocked' (including a typo or older variant)
    // must NOT suppress — better to over-track and let the cookie banner +
    // modal correct any inconsistency, than to silently drop tracking on a
    // typo'd cookie value.
    for (const value of ['tracking_allowed', 'unknown_value', 'TRACKING_BLOCKED', '']) {
      setCookie(value)
      expect(await GA4InjectScript({ measurementId: 'G' })).not.toBeNull()
      expect(await MetaPixelScript({ pixelId: 'P' })).not.toBeNull()
      expect(await ClarityInjectScript({ projectId: 'C' })).not.toBeNull()
    }

    setCookie('tracking_blocked')
    expect(await GA4InjectScript({ measurementId: 'G' })).toBeNull()
    expect(await MetaPixelScript({ pixelId: 'P' })).toBeNull()
    expect(await ClarityInjectScript({ projectId: 'C' })).toBeNull()
  })
})
