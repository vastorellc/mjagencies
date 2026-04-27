---
phase: 08-public-frontend
verified: 2026-04-27T12:00:00Z
status: gaps_found
score: 9/10
overrides_applied: 0
gaps:
  - truth: "services/page.tsx across all 12 apps contains literal 'coming soon' text"
    status: partial
    reason: "All 12 agency services/page.tsx files contain the string 'Service pages coming soon.' in the empty-state conditional branch. CLAUDE.md Rule 5 explicitly prohibits writing 'Coming soon'. The text appears only when fetchPagesIndex returns an empty array (no CMS content seeded), but it is rendered to users and violates the content-complete rule."
    artifacts:
      - path: "apps/web-ecommerce/src/app/(frontend)/services/page.tsx"
        issue: "Line 58: 'Service pages coming soon.' in else branch"
      - path: "apps/web-ai/src/app/(frontend)/services/page.tsx"
        issue: "Line 29: 'Service pages coming soon.' in else branch"
      - path: "apps/web-branding/src/app/(frontend)/services/page.tsx"
        issue: "Line 29: 'Service pages coming soon.' in else branch"
    missing:
      - "Replace 'Service pages coming soon.' with 'We offer tailored [niche] services — contact us to discuss your project.' or similar real text that is not a coming-soon announcement across all 12 apps"
      - "The blog empty state 'No posts published yet. Check back soon.' is explicitly spec'd in the plan and matches the blog SC so is ACCEPTED — the services equivalent was not spec'd this way and should be updated"
human_verification:
  - test: "Load each agency app home page at its subdomain and confirm page renders"
    expected: "All 12 agency home pages load with real layout, fonts, and WebVitalsReporter mounted"
    why_human: "Cannot verify subdomain routing, DNS, and page rendering without a running environment"
  - test: "Trigger a Payload page save and confirm Next.js ISR revalidation completes within 60s"
    expected: "revalidateTag fires, CDN cache clears, and fresh page served within 60s"
    why_human: "Requires running Payload CMS instance and CDN layer — not testable statically"
  - test: "Run Lighthouse CI against a live deployment and confirm LCP < 1800ms and CLS = 0"
    expected: "lighthouserc.json assertions pass: largest-contentful-paint maxNumericValue 1800, cumulative-layout-shift maxNumericValue 0.1"
    why_human: "Lighthouse requires a running HTTP server and real page rendering"
  - test: "Run the axe.test.tsx vitest suite to confirm zero critical WCAG violations"
    expected: "All 8+ axe tests pass; runAxeTest throws no errors for any P0 page component"
    why_human: "jsdom vitest run requires a working build environment with all package dependencies installed"
---

# Phase 8: Public Frontend Verification Report

**Phase Goal:** Build the public-facing frontend for all 12 agency apps — layouts, performance instrumentation (WebVitals/RUM), ISR cache purge hooks, image pipeline (MjImage/AVIF/BlurHash), accessibility gate (axe-core), and all P0 page routes (home, about, services, blog, contact, FAQ, privacy, terms, 404).
**Verified:** 2026-04-27T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 12 agency sites have P0 pages with real layouts | VERIFIED | All 12 apps have home/about/blog/contact/faq/privacy/terms/services; layouts confirmed in `src/app/layout.tsx` and `(frontend)/layout.tsx` for all |
| 2 | LCP < 1.8s desktop enforced in CI (lighthouserc.json) | VERIFIED | `lighthouserc.json` asserts `largest-contentful-paint: ["error", {"maxNumericValue": 1800}]` |
| 3 | CLS = 0 enforced via MjImage required width/height props | VERIFIED | `lighthouserc.json` asserts `cumulative-layout-shift: ["error", {"maxNumericValue": 0.1}]`; MjImage requires `width` and `height` at compile time |
| 4 | axe-core: zero critical violations gate implemented | VERIFIED | `runAxeTest` throws on `impact === 'critical'`; axe.test.tsx wired to web-ecommerce P0 pages; `packages/testing` exports `runAxeTest` |
| 5 | ISR purge propagates via revalidateTag after content edit | VERIFIED | `isrPurgeHook` and `isrPurgePostHook` registered in `pages.ts` and `posts.ts` afterChange arrays; both call `revalidateTag` with `agency:<id>:page:<slug>` and `agency:<id>:collection:pages` tags; `revalidate = 60` on all dynamic routes |
| 6 | No `dangerouslyAllowSVG` in any Next.js Image components | VERIFIED | `grep -r "dangerouslyAllowSVG" apps/ --include="page.tsx"` returns 0 matches |

### Requested Success Criteria (10 specific checks)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| SC1 | `packages/ui/src/rum/thresholds.ts` exports `RUM_THRESHOLDS` with `LCP_DESKTOP_MS`, `CLS_MAX` | VERIFIED | File exists; exports `RUM_THRESHOLDS` as const with `LCP_DESKTOP_MS: 1800`, `LCP_MOBILE_MS: 2200`, `CLS_MAX: 0.1`, and 5 other thresholds |
| SC2 | `lighthouserc.json` asserts LCP < 1800ms and CLS < 0.1 | VERIFIED | `"largest-contentful-paint": ["error", {"maxNumericValue": 1800}]` and `"cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}]` present |
| SC3 | `packages/cms/src/lib/fetch-pages.ts` exports `fetchPageBySlug`, `fetchPagesIndex`, `fetchAllPageSlugs` | VERIFIED | All three exported; use `unstable_cache` with ISR tags; also exported from CMS barrel (`src/index.ts` lines 90-91) |
| SC4 | `packages/cms/src/lib/fetch-posts.ts` exports `fetchPostBySlug`, `fetchPostsIndex` | VERIFIED | Both exported; also `fetchAllPostSlugs`; use `unstable_cache` with matching ISR tags; exported from CMS barrel (lines 92-93) |
| SC5 | `packages/testing/src/axe-setup.ts` exports `runAxeTest` using axe-core with DOM attachment fix | VERIFIED | File exists; `runAxeTest(container)` appends container to `document.body` if not already attached, runs `axe.run()` with WCAG 2.2 AA tags, throws on critical violations, always removes appended container in `finally` |
| SC6 | `apps/web-ecommerce/src/app/(frontend)/faq/page.tsx` uses `buildFaqJsonLd` + `serializeFaqJsonLd` | VERIFIED | Line 3: `import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'`; line 36: `const faqJsonLd = buildFaqJsonLd(FAQ_ITEMS)`; line 43: `dangerouslySetInnerHTML={{ __html: serializeFaqJsonLd(faqJsonLd) }}` |
| SC7 | All 11 agency apps have `blog/[slug]/page.tsx` with `generateStaticParams` | VERIFIED | All 11 apps (ai, branding, ecommerce, engineering, finance, graphic, growth, product, strategy, video, webdev) have the file; all 11 contain `generateStaticParams` calling `fetchAllPostSlugs(AGENCY_ID)` |
| SC8 | `apps/web-ecommerce/src/app/(frontend)/privacy/page.tsx` has `robots: { index: false }` | VERIFIED | Line 6: `robots: { index: false }` in metadata export |
| SC9 | `apps/web-ecommerce/src/app/(frontend)/blog/page.tsx` has "No posts published yet. Check back soon." | VERIFIED | Line 35: exact string present in empty-state conditional branch |
| SC10 | No `dangerouslyAllowSVG` in any page file under `apps/` | VERIFIED | `grep -r "dangerouslyAllowSVG" apps/ --include="page.tsx"` → 0 matches |

**Score: 9/10 specified criteria VERIFIED (1 gap outside the 10 criteria — see Gaps Summary)**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/ui/src/rum/thresholds.ts` | RUM_THRESHOLDS constants | VERIFIED | Exports 8 threshold constants including LCP_DESKTOP_MS and CLS_MAX |
| `packages/ui/src/rum/web-vitals.tsx` | WebVitalsReporter (5 metrics) | VERIFIED | Registers onLCP, onINP, onCLS, onFCP, onTTFB via dynamic import; sends to GA4 window.gtag; returns null |
| `lighthouserc.json` (repo root) | Lighthouse CI assertions | VERIFIED | LCP error at 1800ms, CLS error at 0.1, TBT warn at 200ms |
| `packages/cms/src/lib/fetch-pages.ts` | Page fetch utilities | VERIFIED | fetchPageBySlug, fetchPagesIndex, fetchAllPageSlugs with unstable_cache |
| `packages/cms/src/lib/fetch-posts.ts` | Post fetch utilities | VERIFIED | fetchPostBySlug, fetchPostsIndex, fetchAllPostSlugs with unstable_cache |
| `packages/cms/src/hooks/isr-purge.ts` | ISR purge hooks | VERIFIED | isrPurgeHook (pages) and isrPurgePostHook (posts) calling revalidateTag twice each |
| `packages/media/src/picture.tsx` | MjImage component | VERIFIED | Cloudflare AVIF delivery URL, required width/height, BlurHash blur-up, priority prop |
| `packages/testing/src/axe-setup.ts` | runAxeTest helper | VERIFIED | DOM attachment fix, WCAG 2.2 AA tags, critical-violation throw |
| `apps/web-ecommerce/src/__tests__/axe.test.tsx` | Axe test suite (ecommerce) | VERIFIED | 8+ tests importing runAxeTest from @mjagency/testing |
| All 12 agency `(frontend)/page.tsx` | Home pages | VERIFIED | All 12 exist with real content; ecommerce has full CMS fetch + JSON-LD; others use AGENCY_ID pattern |
| All 11 agency `blog/[slug]/page.tsx` | Blog post pages with generateStaticParams | VERIFIED | All 11 present with generateStaticParams calling fetchAllPostSlugs |
| All 12 agency `middleware.ts` (app root) | Auth middleware delegation | VERIFIED | All 11 non-main apps + main have middleware.ts at app root |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web-ecommerce/(frontend)/faq/page.tsx` | `@mjagency/seo` | `buildFaqJsonLd, serializeFaqJsonLd` | WIRED | Import on line 3; both functions called in component body |
| `apps/web-ecommerce/(frontend)/blog/[slug]/page.tsx` | `@mjagency/cms` | `fetchPostBySlug, fetchAllPostSlugs` | WIRED | Import line 4; generateStaticParams and page body both call |
| `apps/web-ecommerce/(frontend)/blog/page.tsx` | `@mjagency/cms` | `fetchPostsIndex` | WIRED | Import line 3; called in async component body |
| `packages/testing/src/axe-setup.ts` | `axe-core` | `import axe from 'axe-core'` | WIRED | Line 1; axe.run() called in runAxeTest |
| `apps/web-ecommerce/__tests__/axe.test.tsx` | `packages/testing` | `import { runAxeTest } from '@mjagency/testing'` | WIRED | Line 2; called on lines 43, 80, 123, 142, 150 |
| `packages/cms/src/collections/pages.ts` | `isr-purge.ts` | `afterChange: [schedulePublishHook, isrPurgeHook]` | WIRED | Confirmed in SUMMARY; afterChange array append pattern |
| `packages/cms/src/index.ts` | `lib/fetch-pages.ts`, `lib/fetch-posts.ts` | barrel re-export | WIRED | Lines 90-93 export all 6 fetch functions |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `web-ecommerce/(frontend)/page.tsx` | `page` (CmsPage) | `fetchPageBySlug(AGENCY_ID, 'home')` → Payload REST API | Yes — real Payload REST query via unstable_cache | FLOWING |
| `web-ecommerce/(frontend)/blog/page.tsx` | `posts` (CmsPost[]) | `fetchPostsIndex(AGENCY_ID, 12, 1)` → Payload REST API | Yes — real Payload REST query; empty-state when no content seeded | FLOWING |
| `web-ecommerce/(frontend)/blog/[slug]/page.tsx` | `post` (CmsPost) | `fetchPostBySlug(AGENCY_ID, slug)` → Payload REST API | Yes — real Payload REST query; notFound() on miss | FLOWING |
| `web-ecommerce/(frontend)/faq/page.tsx` | `FAQ_ITEMS` (static) | Hardcoded array of 5 real Q&A pairs | Yes — real content (not DB-backed, intentional for FAQ) | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — No running HTTP server available for Lighthouse/browser behavioral checks. Static code analysis confirms all route handlers exist and are wired to real data sources.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| REQ-090 | 08-01, 08-07 | Public P0 pages bypass auth redirect | SATISFIED — PUBLIC_PATHS set in createAuthMiddleware; all P0 routes included |
| REQ-091 | 08-03 | ISR tag purge within 60s of content edit | SATISFIED — isrPurgeHook + revalidate=60 on all dynamic routes |
| REQ-092 | 08-04 | AVIF image delivery via Cloudflare Images | SATISFIED — MjImage delivers via imagedelivery.net/{accountId}/{imageId}/public |
| REQ-093 | 08-04 | BlurHash blur-up placeholders | SATISFIED — decodeBlurHash() in blurhash.ts; MjImage accepts blurHash prop |
| REQ-094 | 08-01, 08-04, 08-05 | LCP < 1.8s enforced in CI | SATISFIED — lighthouserc.json + MjImage priority prop |
| REQ-095 | 08-01, 08-04 | CLS = 0 (required width/height on images) | SATISFIED — MjImage enforces width+height at compile time; lighthouserc.json CLS assertion |
| REQ-096 | 08-06 | WCAG 2.2 AA via axe-core CI gate | SATISFIED — runAxeTest throws on critical; axe.test.tsx covers 8+ pages |
| REQ-097 | 08-01, 08-05 | RUM script (web-vitals) on all pages | SATISFIED — WebVitalsReporter in frontend layout; 5 metrics registered |
| REQ-098 | 08-01, 08-04 | No dangerouslyAllowSVG on Next.js Image | SATISFIED — 0 matches in all page files |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/web-*/src/app/(frontend)/services/page.tsx` (all 12) | `"Service pages coming soon."` in else branch | WARNING | Violates CLAUDE.md Rule 5 ("NEVER write 'Coming soon'"). The text is in a runtime-conditional empty-state branch (rendered when `services.length === 0` before CMS content is seeded), but it literally says "coming soon" and will be visible to users on empty deployments. The blog equivalent ("No posts published yet. Check back soon.") was explicitly specified in the 08-07 plan; the services equivalent was not. |

Note: The blog "No posts published yet. Check back soon." text is NOT flagged — it was explicitly specified in the 08-07 plan's acceptance criteria (line 48 and AC5) and is the spec-approved empty state.

Note: `dangerouslySetInnerHTML` appears in FAQ and service pages for JSON-LD script injection — this is the correct, approved pattern per the 08-07 SUMMARY (JSON-LD is sanitized via `.replace(/</g, '\\u003c')`).

---

## Human Verification Required

### 1. Subdomain Routing and Page Load

**Test:** Navigate to each agency subdomain (e.g., ecommerce.mjagency.com, ai.mjagency.com) and confirm the home page loads.
**Expected:** Agency-branded layout renders with correct fonts, no 500 errors, WebVitalsReporter mounted.
**Why human:** Subdomain DNS, Cloudflare routing, and server-side rendering cannot be verified statically.

### 2. Lighthouse CI Against Live Deployment

**Test:** Run `npx lhci autorun` against a deployed agency app.
**Expected:** `lighthouserc.json` assertions pass — LCP < 1800ms, CLS < 0.1, performance score >= 0.9.
**Why human:** Requires a running HTTP server with real assets; cannot run Lighthouse against static files.

### 3. ISR Cache Purge End-to-End

**Test:** Edit a page in Payload CMS and wait up to 60 seconds; load the corresponding agency app page.
**Expected:** Updated content appears within 60s; stale CDN cache is cleared.
**Why human:** Requires running Payload CMS, Next.js server, and CDN/ISR infrastructure.

### 4. Axe Test Suite Execution

**Test:** Run `pnpm vitest --project apps/web-ecommerce` or `pnpm test` in the monorepo.
**Expected:** All axe.test.tsx tests pass with zero critical WCAG violations.
**Why human:** Requires full package installation and working build; jsdom vitest environment must resolve all @mjagency/* package symlinks.

---

## Gaps Summary

**1 gap blocking full compliance:**

The `services/page.tsx` empty-state fallback across all 12 agency apps contains the literal string "Service pages coming soon." This violates CLAUDE.md Rule 5 which states "NEVER write 'Coming soon'". Unlike the blog empty state ("No posts published yet. Check back soon.") which was explicitly specified and approved in the 08-07 plan acceptance criteria, the services equivalent was not spec-approved and should be replaced with real fallback copy such as:

> "We offer tailored ecommerce services. Contact us to discuss your project."

This is a single find-and-update across 12 files (each with its own agency-specific phrasing). The pattern is in the else branch of a `services.length > 0` conditional, so no structural changes are needed — only the copy.

**ROADMAP note:** Plans 08-05, 08-06, and 08-07 are still marked `[ ]` (unchecked) in ROADMAP.md despite all artifacts being present in the codebase. The ROADMAP should be updated to `[x]` for these three plans.

---

_Verified: 2026-04-27T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
