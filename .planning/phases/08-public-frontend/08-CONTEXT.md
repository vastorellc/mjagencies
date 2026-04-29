# Phase 8: Public Frontend + Page Tree - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** Gap-closure re-execution (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Build the public-facing frontend for all 12 agency apps: 12 agency Next.js apps live at their subdomains with ISR, image pipeline, RUM, WCAG, all P0 pages real and complete.

**Gap closure scope (audit-identified):**
- ISR purge hooks (revalidateTag) never created in CMS afterChange hooks
- Fetch utilities (fetchPageBySlug, fetchPostsIndex, etc.) never created in packages/cms/src/lib/
- All 132 P0 page route files never created (11 pages × 12 agencies)
- "Service pages coming soon." text violation in services/page.tsx across all 12 apps
- AiPanel not registered in build-payload-config.ts afterDocControls (Phase 7 gap, 1-line fix)

</domain>

<decisions>
## Implementation Decisions

### ISR Strategy
- revalidate = 60 on all dynamic routes
- unstable_cache with agency-scoped tags: agency:<id>:page:<slug>, agency:<id>:collection:pages
- isrPurgeHook in pages afterChange, isrPurgePostHook in posts afterChange

### Fetch Utilities
- fetchPageBySlug, fetchPagesIndex, fetchAllPageSlugs in packages/cms/src/lib/fetch-pages.ts
- fetchPostBySlug, fetchPostsIndex, fetchAllPostSlugs in packages/cms/src/lib/fetch-posts.ts
- Call Payload REST API (not direct DB), cache with unstable_cache + ISR tags

### P0 Pages Structure
- 11 page files per agency: page.tsx, about/page.tsx, services/page.tsx, services/[slug]/page.tsx, blog/page.tsx, blog/[slug]/page.tsx, contact/page.tsx, faq/page.tsx, privacy/page.tsx, terms/page.tsx, not-found.tsx
- web-ecommerce: full CMS data fetch + real content
- Other 10 + web-main: same structure, correct AGENCY_ID, agency-specific metadata

### Content
- All styles: var(--mj-*) tokens only — zero hex literals
- Skip-to-main-content on every page (WCAG 2.4.1)
- Services empty state: niche-specific consultation copy (NOT "coming soon")
- Blog empty state: "No posts published yet. Check back soon." (spec-approved)
- Legal pages: robots: { index: false } (noindex)

### Claude's Discretion
- Agency-specific content for about/services/contact pages — use niche-appropriate real copy per Content-Complete Rule

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- MjImage component: packages/media/src/picture.tsx — AVIF delivery, BlurHash, priority prop
- buildFaqJsonLd + serializeFaqJsonLd: packages/seo (for FAQ pages)
- WebVitalsReporter: already in frontend layout.tsx (all 12 apps)
- Skip link pattern: sr-only focus:not-sr-only pattern

### Established Patterns
- AGENCY_ID constant at module scope per app
- fetchPageBySlug(AGENCY_ID, slug) → notFound() on null
- ISR tags: agency:<id>:page:<slug> and agency:<id>:collection:pages
- All styles via var(--mj-*) — confirmed in 132 planned page files

### Integration Points
- packages/cms/src/collections/pages.ts afterChange: needs isrPurgeHook appended
- packages/cms/src/collections/posts.ts afterChange: needs isrPurgePostHook appended
- packages/cms/src/index.ts: needs fetch utility exports added
- build-payload-config.ts: AiPanel needs to be added to afterDocControls

</code_context>

<specifics>
## Specific Ideas

- 08-07-PLAN.md has complete file content for all fetch utilities and web-ecommerce P0 pages
- 08-03-PLAN.md has complete file content for isr-purge.ts hook
- Agency ID mapping: growth, webdev, ai, branding, strategy, finance, engineering, product, video, graphic, ecommerce, brand
- web-main uses AGENCY_ID = 'brand'

</specifics>

<deferred>
## Deferred Ideas

- Payload migrations (brand_voice + brand_glossary tables) — requires live DB, cannot execute in static build
- Subdomain DNS routing, Lighthouse CI, ISR end-to-end — require live environment

</deferred>
