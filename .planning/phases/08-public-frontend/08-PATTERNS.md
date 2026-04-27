# Phase 8: Public Frontend + Page Tree — Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 28 new/modified files (across 7 plans)
**Analogs found:** 26 / 28

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web-{agency}/src/app/layout.tsx` (12 files) | component | request-response | `apps/web-main/src/app/layout.tsx` | exact |
| `apps/web-{agency}/src/app/(frontend)/layout.tsx` (12) | component | request-response | `apps/web-main/src/app/(frontend)/layout.tsx` | exact |
| `apps/web-{agency}/next.config.mjs` (12) | config | — | `apps/web-main/next.config.mjs` | exact |
| `apps/web-{agency}/middleware.ts` (12) | middleware | request-response | `apps/web-main/middleware.ts` | exact |
| `packages/cms/src/hooks/isr-purge.ts` | hook | event-driven | `packages/cms/src/hooks/scheduled-publish.ts` | role-match |
| `packages/cms/src/hooks/revalidate-tag.ts` | hook | event-driven | `packages/cms/src/hooks/scheduled-publish.ts` | role-match |
| `apps/web-{agency}/src/app/(frontend)/[slug]/page.tsx` | component | CRUD | `apps/web-main/src/app/(frontend)/page.tsx` | role-match |
| `apps/web-{agency}/src/app/(frontend)/blog/[slug]/page.tsx` | component | CRUD | `apps/web-main/src/app/(frontend)/page.tsx` | role-match |
| `packages/media/src/picture.tsx` | component | file-I/O | `packages/ui/src/blocks/hero/HeroSplit/index.tsx` | role-match |
| `packages/media/src/next-image-config.ts` | config | — | `apps/web-main/next.config.mjs` | role-match |
| `packages/ui/src/rum/web-vitals.tsx` | component | event-driven | `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx` | partial |
| `apps/web-{agency}/src/app/(frontend)/p0-pages/*.tsx` | component | CRUD | `apps/web-main/src/app/(frontend)/page.tsx` | role-match |
| `packages/testing/src/axe-setup.ts` | utility | — | `apps/web-main/vitest.config.ts` | role-match |
| `apps/web-{agency}/src/app/(frontend)/__tests__/axe.test.tsx` | test | — | `apps/web-main/src/__tests__/ai-editor.test.ts` | role-match |

---

## Pattern Assignments

### `apps/web-{agency}/src/app/layout.tsx` (component, request-response)

**Analog:** `apps/web-main/src/app/layout.tsx` (lines 1–37)

**Imports pattern** (lines 1–3):
```typescript
import type { ReactNode } from 'react'
import { getDataAttrs } from '@mjagency/ui'
import './globals.css'
```

**FOUC prevention script pattern** (lines 22):
```typescript
const FOUC_SCRIPT = `(function(){try{var s=localStorage.getItem('mj-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s||(d?'dark':'light'));}catch(e){}})();`
```

**Root layout core pattern** (lines 24–37):
```typescript
export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  // Replace 'brand' with the agency slug for each app
  const attrs = getDataAttrs({ agency: 'brand' })
  return (
    <html suppressHydrationWarning {...attrs}>
      <head>
        {/* FOUC prevention — FIRST in <head>, BEFORE any stylesheet links. CSP nonce in Phase 11. */}
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

**Per-agency deviation:** Replace `agency: 'brand'` with the agency slug constant (e.g. `agency: 'ecommerce'`). Each agency's root layout sets `lang="en"` on `<html>` and loads its niche font via `next/font/google` — see font pattern below.

---

### `apps/web-{agency}/src/app/(frontend)/layout.tsx` (component, request-response)

**Analog:** `apps/web-main/src/app/(frontend)/layout.tsx` (lines 1–12)

**Core pattern** (lines 1–12):
```typescript
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Phase 8: import { <FontName> } from 'next/font/google'
// const fontVar = <FontName>({ subsets: ['latin'], variable: '--font-brand', display: 'swap' })

export const metadata: Metadata = {
  title: '<Agency Name> — <Tagline>',        // real, no placeholder
  description: '<Real 155-char description>',
}

export default function FrontendLayout({ children }: { children: ReactNode }): ReactNode {
  // Apply font variable to body: className={fontVar.variable}
  return children
}
```

**Font loading pattern** (from `packages/ui/src/theme/font-stacks.ts`): Each agency loads its `NICHE_FONTS[slug].heading` + `body` via `next/font/google`. The CSS variable `--font-brand` is injected into the `<html>` element via `className`, and the Layer-3 token `--mj-font-brand: var(--font-brand, fallback)` reads it.

---

### `apps/web-{agency}/next.config.mjs` (config)

**Analog:** `apps/web-main/next.config.mjs` (lines 1–19)

**Core pattern** (full file):
```javascript
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // SEC-N4: Never dangerouslyAllowSVG — use DOMPurify+SVGO instead
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
    ],
    formats: ['image/avif', 'image/webp'],  // Phase 8 addition — AVIF first
  },
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty', '@opentelemetry/sdk-node'],
  },
}

export default withPayload(nextConfig)
```

**Key constraint:** `dangerouslyAllowSVG` must NEVER appear anywhere (REQ-096, SC-6).

---

### `apps/web-{agency}/middleware.ts` (middleware, request-response)

**Analog:** `apps/web-main/middleware.ts` (lines 1–3)

**Core pattern** (full file — 2 lines):
```typescript
import { createAuthMiddleware } from '@mjagency/auth/middleware'
export default createAuthMiddleware()
export { config } from '@mjagency/auth/middleware'
```

The shared matcher in `packages/auth/src/middleware.ts` (lines 134–138) handles all exclusions:
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|api/|\\(payload\\)/admin).*)',
  ],
}
```

**Note:** Public frontend pages (home, blog, contact) for Phase 8 should bypass auth. Add `path === '/'` style checks or use a public matcher. The existing middleware redirects all protected routes to `/login` — P0 public pages need an exclusion in the matcher or a public-routes bypass list.

---

### `packages/cms/src/hooks/isr-purge.ts` / `revalidate-tag.ts` (hook, event-driven)

**Analog:** `packages/cms/src/hooks/scheduled-publish.ts` (lines 1–72)

**Imports pattern** (lines 17–20):
```typescript
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'
import type { CollectionAfterChangeHook } from 'payload'
```

**afterChange hook core pattern** (lines 29–35):
```typescript
export const schedulePublishHook: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  // Guard: only act when relevant state change occurred
  if (doc['status'] !== 'scheduled') return
  if (previousDoc?.['status'] === 'scheduled') return

  const agencyId = (doc['agency_id'] as string | undefined) ?? ''
  // ... enqueue action
}
```

**ISR purge adaptation** — the `afterChange` hook for ISR will call `revalidateTag` from `next/cache` instead of enqueuing a BullMQ job. Cache tag convention from `packages/media/src/cache-tags.ts`:
```typescript
// packages/media/src/cache-tags.ts (line 2-4)
export function agencyAssetCacheTag(agencyId: string, assetId: string): string {
  return `agency:${agencyId}:asset:${assetId}`
}
```

**Phase 8 hook pattern:**
```typescript
import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook } from 'payload'

export const isrPurgeHook: CollectionAfterChangeHook = async ({ doc, collection }) => {
  const agencyId = doc['agency_id'] as string
  const slug     = doc['slug']      as string
  if (!agencyId || !slug) return
  // Tag format: agency:<id>:page:<slug> (mirrors cache-tags.ts convention)
  revalidateTag(`agency:${agencyId}:page:${slug}`)
  revalidateTag(`agency:${agencyId}:collection:${collection.slug}`)
}
```

---

### `apps/web-{agency}/src/app/(frontend)/[slug]/page.tsx` (component, CRUD)

**Analog:** `apps/web-main/src/app/(frontend)/page.tsx` + `packages/cms/src/collections/pages.ts`

**ISR + fetch pattern** (no existing ISR analog — use Next.js 15 conventions):
```typescript
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'

// ISR revalidation via cache tags (REQ-092 — purge propagates within 60s)
export const revalidate = 60

interface PageProps { params: Promise<{ slug: string }> }

export default async function DynamicPage({ params }: PageProps): Promise<React.ReactElement> {
  const { slug } = await params
  const page = await fetchPageBySlug(slug)
  if (!page) notFound()
  // render blocks from page.content
}

// Tag-based cache for ISR purge via isrPurgeHook
const fetchPageBySlug = unstable_cache(
  async (slug: string) => {
    // Payload REST call: GET /api/pages?where[slug][equals]=${slug}&where[status][equals]=published
    // Always filter by agency_id via JWT claims / headers context (CLAUDE.md Rule 8)
  },
  ['page-by-slug'],
  { tags: ['agency:<id>:page:<slug>', 'agency:<id>:collection:pages'] }
)
```

**Fields to consume from CMS** (from `packages/cms/src/collections/pages.ts` lines 82–238):
- `title`, `slug`, `page_type`, `content` (Lexical JSON), `excerpt`
- `meta_title`, `meta_description`, `canonical_url`, `aio_tldr`
- `faqs` (relationship → FAQPage JSON-LD via `packages/seo/src/plugins/faq-jsonld.ts`)
- `featured_image` (upload → Cloudflare Images delivery URL)
- `ai_disclosure_required` (triggers disclosure banner when `true`)

**FAQPage JSON-LD injection** (from `packages/seo/src/plugins/faq-jsonld.ts` lines 21–46):
```typescript
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'
// In <head>:
{faqJsonLd && (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: serializeFaqJsonLd(faqJsonLd) }}
  />
)}
```

---

### `apps/web-{agency}/src/app/(frontend)/blog/[slug]/page.tsx` (component, CRUD)

**Analog:** Same as dynamic page above + `packages/cms/src/collections/posts.ts`

**Post-specific fields** (from `packages/cms/src/collections/posts.ts` lines 78–186):
- `category`, `author` (relationships)
- `featured_image`, `excerpt`, `aio_tldr`
- Blocks in `content` rendered same as pages

**generateStaticParams pattern:**
```typescript
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Payload REST: GET /api/posts?where[status][equals]=published&limit=1000
  // Return [{ slug: post.slug }]
}
```

---

### `packages/media/src/picture.tsx` (component, file-I/O)

**Analog:** `packages/ui/src/blocks/hero/HeroSplit/index.tsx` (lines 79–89) + `apps/web-main/next.config.mjs`

**Pattern constraints:**
- No `<img src="">` with SVG — `dangerouslyAllowSVG` banned (REQ-096)
- Cloudflare Images delivers AVIF via variant suffix: `imagedelivery.net/<account>/<id>/avif`
- BlurHash from `packages/media/src/blurhash.ts` provides placeholder

**Art-directed picture element pattern:**
```typescript
import Image from 'next/image'
import type { BlurHashResult } from '@mjagency/media'

interface MjImageProps {
  cloudflareImageId: string
  alt: string
  width: number
  height: number
  blurHash?: BlurHashResult
  priority?: boolean
  sizes?: string
}

export function MjImage({ cloudflareImageId, alt, width, height, blurHash, priority, sizes }: MjImageProps) {
  const accountId = process.env.CLOUDFLARE_IMAGES_ACCOUNT_ID
  const src = `https://imagedelivery.net/${accountId}/${cloudflareImageId}/public`

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      placeholder={blurHash ? 'blur' : 'empty'}
      blurDataURL={blurHash ? decodeBlurHash(blurHash.hash, 32, 32) : undefined}
      priority={priority}
      sizes={sizes ?? '100vw'}
      // No dangerouslyAllowSVG — SVG always goes through DOMPurify+SVGO (CLAUDE.md Rule 7)
    />
  )
}
```

**Cloudflare delivery URL** (from `packages/media/src/cloudflare-images.ts` line 36):
```typescript
deliveryUrl(imageId: string, variant: string): string {
  return `https://imagedelivery.net/${accountId}/${imageId}/${variant}`
}
// Variants: 'public' (original), 'avif', 'webp', 'thumbnail', 'og'
```

---

### `packages/ui/src/rum/web-vitals.tsx` (component, event-driven)

**Analog:** No close analog. Closest: `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx` (client component pattern with `'use client'` + effect hooks)

**No-analog note:** Refer to RESEARCH.md `web-vitals` npm package patterns. The component is a client-side `'use client'` component that imports `onLCP`, `onINP`, `onCLS` from `web-vitals` and fires GA4 `gtag('event', ...)` calls.

**Client component shell pattern** (from SeoPanel.tsx lines 1–2):
```typescript
'use client'
import React, { useEffect } from 'react'
```

**RUM component pattern:**
```typescript
'use client'
import { useEffect } from 'react'
import type { Metric } from 'web-vitals'

export function WebVitalsReporter({ ga4MeasurementId }: { ga4MeasurementId: string }): null {
  useEffect(() => {
    void import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const send = (metric: Metric) => {
        window.gtag?.('event', metric.name, {
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          event_category: 'Web Vitals',
          event_label: metric.id,
          non_interaction: true,
          send_to: ga4MeasurementId,
        })
      }
      onLCP(send); onINP(send); onCLS(send); onFCP(send); onTTFB(send)
    })
  }, [ga4MeasurementId])
  return null
}
```

---

### `apps/web-{agency}/src/app/(frontend)/__tests__/axe.test.tsx` (test, event-driven)

**Analog:** `apps/web-main/src/__tests__/ai-editor.test.ts` (lines 1–28)

**Test file structure pattern** (lines 1–18 of ai-editor.test.ts):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
// Phase 8: also import @axe-core/react or jest-axe + @testing-library/react

// Mock external dependencies before import
vi.mock('@mjagency/auth', () => ({ requireSession: vi.fn() }))
```

**vitest config pattern** (`apps/web-main/vitest.config.ts` full file):
```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',    // Phase 8 axe tests: use 'jsdom'
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    include: ['src/**/*.test.ts', '**/__tests__/**/*.test.ts'],
  },
})
```

**axe-core test pattern** (no existing analog — use axe-core/playwright or vitest-axe):
```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import axe from 'axe-core'

describe('WCAG 2.2 AA — HomePage', () => {
  it('has zero critical axe violations', async () => {
    const { container } = render(<HomePage />)
    const results = await axe.run(container)
    const critical = results.violations.filter(v => v.impact === 'critical')
    expect(critical).toHaveLength(0)
  })
})
```

---

### P0 Page Components (home, about, services, blog index, contact)

**Analog:** `apps/web-main/src/app/(frontend)/page.tsx` + 45-block library in `packages/ui/src/blocks/`

**Block rendering pattern** — pages consume blocks from Payload Lexical JSON and map to UI components:
```typescript
// Blocks available from packages/ui (exported via packages/ui/src/index.ts line 45):
export * from './blocks/index.js'
// Includes: HeroCentered, HeroSplit, HeroVideo, HeroMinimal (hero)
//           BlogFeatured, BlogGrid, BlogRelated, AuthorBio (blog)
//           ContactForm (form)
//           ServiceGrid, ServiceDetail, FeatureList, ProcessSteps, PricingTable, ComparisonTable (service)
//           TestimonialsGrid, TestimonialsSlider, ClientLogos, TeamGrid, CaseStudyCard, AwardsBar (trust)
//           FaqAccordion, Divider (utility)
```

**Block token rule** (from `packages/ui/src/blocks/hero/HeroSplit/index.tsx` lines 5–89):
All block components use ONLY `var(--mj-*)` CSS tokens — zero hex literals. Example:
```typescript
style={{
  fontFamily: 'var(--mj-font-heading)',
  fontSize: 'var(--mj-text-4xl)',
  color: 'var(--mj-color-text-primary)',
  backgroundColor: 'var(--mj-color-bg)',
}}
```

**Contact page** — use `packages/ui/src/blocks/form/ContactForm/index.tsx` directly. The `formId` prop maps to the Payload `forms` collection. Server action wired in Phase 9.

---

## Shared Patterns

### 1. Agency Data Attribute Injection

**Source:** `packages/ui/src/theme/data-attrs.ts` (full file, 22 lines)
**Apply to:** All 12 agency root layouts `apps/web-{agency}/src/app/layout.tsx`

```typescript
import { getDataAttrs } from '@mjagency/ui'
// In layout:
const attrs = getDataAttrs({ agency: 'ecommerce' })  // slug per app
return <html suppressHydrationWarning {...attrs}>
```

### 2. FOUC Prevention Script

**Source:** `apps/web-main/src/app/layout.tsx` (line 22)
**Apply to:** All 12 agency root layouts

```typescript
const FOUC_SCRIPT = `(function(){try{var s=localStorage.getItem('mj-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s||(d?'dark':'light'));}catch(e){}})();`
// Place as FIRST script in <head> via dangerouslySetInnerHTML
```

### 3. CSS Token System Import

**Source:** `apps/web-main/src/app/globals.css` (line 5)
**Apply to:** All 12 agency `globals.css` files

```css
@import "@mjagency/ui/styles/theme.css";
```

This pulls in the 6 token layers, dark mode override, all 12 agency overrides, and the Tailwind v4 `@theme inline` bridge.

### 4. Next.js Config — Image Safety

**Source:** `apps/web-main/next.config.mjs` (lines 6–11)
**Apply to:** All 12 `next.config.mjs` files

```javascript
images: {
  // SEC-N4: never dangerouslyAllowSVG
  remotePatterns: [
    { protocol: 'https', hostname: '*.cloudflare.com' },
    { protocol: 'https', hostname: 'imagedelivery.net' },
  ],
  formats: ['image/avif', 'image/webp'],
},
```

### 5. Middleware — Shared Auth Factory

**Source:** `apps/web-main/middleware.ts` (lines 1–3) + `packages/auth/src/middleware.ts` (lines 59–138)
**Apply to:** All 12 agency `middleware.ts` files

```typescript
import { createAuthMiddleware } from '@mjagency/auth/middleware'
export default createAuthMiddleware()
export { config } from '@mjagency/auth/middleware'
```

Public pages (home, blog, services, about, contact) must be excluded from the auth redirect. Add these paths to the matcher negation or add a `PUBLIC_PATHS` set check in the middleware factory.

### 6. Payload Config — All Agency Apps

**Source:** `apps/web-main/payload.config.ts` (lines 1–17)
**Apply to:** All 12 agency `payload.config.ts` files

```typescript
import { buildPayloadConfig, CORE_COLLECTIONS } from '@mjagency/cms'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildPayloadConfig({
  dirname,
  databaseUrl: process.env['DATABASE_URL'] ?? '',
  secret: process.env['PAYLOAD_SECRET'] ?? '',
  collections: CORE_COLLECTIONS,
})
```

### 7. Cache Tag Convention

**Source:** `packages/media/src/cache-tags.ts` (lines 2–4)
**Apply to:** All ISR purge hooks, all `fetch()` calls with `next: { tags: [...] }` in page components

Format: `agency:<agencyId>:<resource-type>:<identifier>`
```typescript
// Pages: agency:<id>:page:<slug>
// Posts: agency:<id>:post:<slug>
// Collections: agency:<id>:collection:<collectionSlug>
// Assets: agency:<id>:asset:<assetId>  (existing in cache-tags.ts)
```

### 8. Server Action Auth Check

**Source:** `apps/web-main/src/actions/seo-score.ts` (lines 28–29)
**Apply to:** Any Phase 8 server actions (ISR revalidation calls, contact form submissions)

```typescript
'use server'
import { requireSession } from '@mjagency/auth'

export async function myAction(input: { agencyId: string }) {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  // proceed
}
```

### 9. CSS Variable Token Rule — Block Components

**Source:** `packages/ui/src/blocks/hero/HeroSplit/index.tsx` (lines 21–88)
**Apply to:** ALL new React components in Phase 8

Zero hex literals. All colors, spacing, typography, radius, shadow must use `var(--mj-*)` tokens. Example token names:
- Colors: `var(--mj-color-bg)`, `var(--mj-color-text-primary)`, `var(--mj-color-brand-primary)`, `var(--mj-color-border)`
- Spacing: `var(--mj-space-1)` through `var(--mj-space-16)`, `var(--mj-space-12)`
- Typography: `var(--mj-font-heading)`, `var(--mj-font-body)`, `var(--mj-text-sm)` through `var(--mj-text-4xl)`
- Radius: `var(--mj-radius-sm)`, `var(--mj-radius-md)`, `var(--mj-radius-lg)`

### 10. Theme Resolution (NICHE_FONTS + NICHE_PALETTES)

**Source:** `packages/ui/src/theme/font-stacks.ts` (full, 28 lines) + `packages/ui/src/theme/niche-palettes.ts` (full, 31 lines)
**Apply to:** Per-agency `(frontend)/layout.tsx` font loading

Each agency's heading/body font from `NICHE_FONTS[slug]` is loaded via `next/font/google`. The CSS variable `--font-brand` is injected into `<html>` via `className`, consumed by the Layer-3 typography token.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/ui/src/rum/web-vitals.tsx` | component | event-driven | No RUM/analytics client component exists yet; first event-driven measurement component |
| `apps/web-{agency}/src/app/(frontend)/[slug]/page.tsx` ISR fetch pattern | component | CRUD | No existing ISR (`unstable_cache` / `revalidateTag`) usage in codebase yet — phase 8 introduces it |

---

## Metadata

**Analog search scope:** `apps/web-main/`, `apps/web-branding/`, `packages/ui/`, `packages/cms/`, `packages/media/`, `packages/auth/`, `packages/seo/`
**Files scanned:** ~60
**Pattern extraction date:** 2026-04-27
