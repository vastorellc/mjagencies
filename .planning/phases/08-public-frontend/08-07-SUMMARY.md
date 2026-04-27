---
phase: 08-public-frontend
plan: "08-07"
subsystem: ui
tags: [next.js, isr, cms, seo, wcag, jsonld, ssr, agency-pages]

# Dependency graph
requires:
  - phase: 08-03
    provides: "ISR tag-based cache purge hooks (isrPurgeHook) in pages/posts collections"
  - phase: 08-04
    provides: "MjImage component with AVIF/BlurHash support"
  - phase: 06-03
    provides: "buildFaqJsonLd + serializeFaqJsonLd from @mjagency/seo"
provides:
  - "fetchPageBySlug, fetchPagesIndex, fetchAllPageSlugs in packages/cms (unstable_cache + ISR tags)"
  - "fetchPostBySlug, fetchPostsIndex, fetchAllPostSlugs in packages/cms"
  - "11 P0 page routes for web-ecommerce (home, about, services index/slug, blog index/slug, contact, faq, privacy, terms, not-found)"
  - "Same 11 P0 page routes × 10 agency apps + web-main = 121 additional files"
  - "FAQPage JSON-LD on /faq and home pages via buildFaqJsonLd"
  - "Service schema.org JSON-LD on service [slug] pages"
  - "LocalBusiness JSON-LD on contact pages"
  - "AI disclosure banner on pages where ai_disclosure_required === true"
  - "noindex metadata on /privacy and /terms"
  - "generateStaticParams on all [slug] routes"
affects:
  - 09-contact-form
  - 11-analytics-security
  - content-sprint (AGENCY_ID constants ready for per-agency content ingestion)

# Tech tracking
tech-stack:
  added:
    - "scripts/generate-agency-pages.mjs — Node.js page generator for 11-agency × 11-page scaffold"
  patterns:
    - "AGENCY_ID constant pattern: each agency app declares const AGENCY_ID = '<slug>' at module scope"
    - "ISR fetch pattern: fetchPageBySlug wraps unstable_cache with agency:id:page:slug tags"
    - "Service JSON-LD pattern: inline const jsonLd + dangerouslySetInnerHTML with .replace(/</g, '\\u003c')"
    - "AI disclosure: conditional AiDisclosureBanner component rendered when ai_disclosure_required === true"

key-files:
  created:
    - packages/cms/src/lib/fetch-pages.ts
    - packages/cms/src/lib/fetch-posts.ts
    - apps/web-ecommerce/src/app/(frontend)/page.tsx
    - apps/web-ecommerce/src/app/(frontend)/blog/[slug]/page.tsx
    - apps/web-ecommerce/src/app/(frontend)/services/[slug]/page.tsx
    - apps/web-ecommerce/src/app/(frontend)/faq/page.tsx
    - "apps/web-{growth,webdev,ai,branding,strategy,finance,engineering,product,video,graphic}/src/app/(frontend)/**"
    - apps/web-main/src/app/(frontend)/**
    - scripts/generate-agency-pages.mjs
  modified:
    - packages/cms/src/index.ts

key-decisions:
  - "All 3 tasks collapsed into one commit — tasks 1+2 were staged from previous session, task 3 added on resume"
  - "Used Node.js ESM script (generate-agency-pages.mjs) instead of Python — Python not available in bash environment"
  - "All 11 agency apps + web-main get identical page structure with only AGENCY_ID and metadata.title varying"
  - "No FaqAccordion component used (not yet built) — rendered as plain <dl> list matching UI-SPEC fallback"

patterns-established:
  - "AGENCY_ID = '<slug>' at module top: copy pattern for all 12 agency apps"
  - "fetchPageBySlug(AGENCY_ID, 'home') + if (!page) notFound(): standard page data pattern"
  - "ISR tags agency:id:page:slug and agency:id:collection:pages: purged by isrPurgeHook from 08-03"

requirements-completed:
  - REQ-076
  - REQ-090
  - REQ-091
  - REQ-092
  - REQ-093
  - REQ-094
  - REQ-095
  - REQ-096
  - REQ-097
  - REQ-098

# Metrics
duration: ~90min (across two sessions)
completed: 2026-04-27
---

# Plan 08-07: All P0 pages per agency — Summary

**Typed Payload REST fetch utilities + 132 P0 page routes across all 12 agency apps with ISR, FAQPage JSON-LD, AI disclosure, and WCAG skip links**

## Performance

- **Duration:** ~90 min (split across two sessions)
- **Started:** 2026-04-27
- **Completed:** 2026-04-27
- **Tasks:** 3
- **Files modified:** 134 (2 packages/cms + 11 web-ecommerce + 121 agency stubs + 1 generator script)

## Accomplishments

- Created `packages/cms/src/lib/fetch-pages.ts` and `fetch-posts.ts` — fully typed Payload REST API fetch utilities using `unstable_cache` with ISR tags that match the 08-03 purge hooks
- Built all 11 P0 pages for `apps/web-ecommerce` with real content, FAQ JSON-LD, Service JSON-LD, LocalBusiness JSON-LD, AI disclosure banner, skip links, and `noindex` on legal pages
- Scaffolded identical 11-page structure for all 10 named agency apps + web-main (121 files) using a Node.js generator script — each app declares its own `AGENCY_ID` constant

## Task Commits

Tasks 1+2 were staged in session 1, task 3 executed on session resume, all committed together:

1. **Task 1: CMS fetch utilities** — `90c01a9` (feat)
2. **Task 2: web-ecommerce P0 pages** — `90c01a9` (feat)
3. **Task 3: 11 agency app scaffolds** — `90c01a9` (feat)

## Files Created/Modified

- `packages/cms/src/lib/fetch-pages.ts` — fetchPageBySlug, fetchPagesIndex, fetchAllPageSlugs with unstable_cache
- `packages/cms/src/lib/fetch-posts.ts` — fetchPostBySlug, fetchPostsIndex, fetchAllPostSlugs
- `packages/cms/src/index.ts` — added exports for all fetch utilities
- `apps/web-ecommerce/src/app/(frontend)/page.tsx` — home with FAQ JSON-LD + AI disclosure
- `apps/web-ecommerce/src/app/(frontend)/blog/[slug]/page.tsx` — blog post with generateStaticParams + AI disclosure
- `apps/web-ecommerce/src/app/(frontend)/services/[slug]/page.tsx` — service with Service JSON-LD + generateStaticParams
- `apps/web-ecommerce/src/app/(frontend)/contact/page.tsx` — contact form with LocalBusiness JSON-LD
- `apps/web-ecommerce/src/app/(frontend)/faq/page.tsx` — FAQ with buildFaqJsonLd + serializeFaqJsonLd
- `apps/web-ecommerce/src/app/(frontend)/privacy/page.tsx` — robots: { index: false }
- `apps/web-ecommerce/src/app/(frontend)/terms/page.tsx` — robots: { index: false }
- `apps/web-ecommerce/src/app/(frontend)/not-found.tsx` — 404
- `apps/web-ecommerce/src/app/(frontend)/about/page.tsx` — about
- `apps/web-ecommerce/src/app/(frontend)/services/page.tsx` — services index
- `apps/web-ecommerce/src/app/(frontend)/blog/page.tsx` — blog index with empty state
- 121 page files across `apps/web-{growth,webdev,ai,branding,strategy,finance,engineering,product,video,graphic}` and `apps/web-main`
- `scripts/generate-agency-pages.mjs` — Node.js ESM generator script

## Decisions Made

- Used Node.js ESM script instead of Python — Python3 not available in the bash environment on this Windows machine
- All agency stubs use `fetchPageBySlug(AGENCY_ID, 'home')` + `if (!page) notFound()` — dynamic rendering from CMS, no hardcoded content
- FAQ pages for agency stubs include 3 real generic questions instead of hardcoded domain-specific content — actual FAQs will come from CMS at runtime
- No `FaqAccordion` component — plain `<dl>` list used because the accordion component hasn't been built yet; schema.org JSON-LD still injected correctly

## Deviations from Plan

### Auto-fixed Issues

**1. Python not available — switched to Node.js generator**
- **Found during:** Task 3 (scaffold generation)
- **Issue:** `python3`, `python`, and `py` commands all returned 127 (not found) in the bash environment
- **Fix:** Rewrote the generation script as `scripts/generate-agency-pages.mjs` using Node.js ESM `fs` module
- **Files modified:** scripts/generate-agency-pages.mjs (new, replaces .py)
- **Verification:** `node scripts/generate-agency-pages.mjs` → "Total: 121 page files generated"
- **Committed in:** 90c01a9

---

**Total deviations:** 1 auto-fixed (environment constraint)
**Impact on plan:** Zero functional impact — identical output, different generation tool.

## Issues Encountered

None beyond the Python unavailability above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 12 agency apps have their P0 page routes ready for content ingestion
- `fetchPageBySlug` / `fetchPostBySlug` will return `null` (→ `notFound()`) until CMS content is seeded — this is expected behavior for dev/staging
- Contact form `action="/api/contact"` wires to Phase 9 (contact form API)
- Analytics events on CTAs wire to Phase 11 (analytics-security)

---
*Phase: 08-public-frontend*
*Completed: 2026-04-27*
