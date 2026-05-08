---
milestone: v9.1.20
audited: 2026-04-28T14:30:00Z
gap_closure: 2026-04-28T16:00:00Z
status: gaps_closed
scores:
  requirements: 15/177
  phases_verified: 5/12
  integration: 10/10
  flows_complete: 4/8
gaps:
  requirements:
    - id: "REQ-090 / REQ-091 / REQ-092"
      status: "closed"
      closed_by: "commit e67d2b4 — cherry-picked 132 P0 pages from worktree-agent-accfc500ad0137dde; all 12 agency home/about/services/blog/faq/privacy/terms pages now call fetchPageBySlug/fetchPostsIndex"
    - id: "REQ-080 / REQ-081"
      status: "closed"
      closed_by: "commit e67d2b4 — AiPanel added to afterDocControls in packages/cms/src/config/build-payload-config.ts line 85"
    - id: "REQ-091 / REQ-093"
      status: "closed"
      closed_by: "commit e67d2b4 — isrPurgeHook added to pages.ts afterChange; isrPurgePostHook added to posts.ts afterChange; packages/cms/src/hooks/isr-purge.ts cherry-picked from worktree"
    - id: "REQ-142"
      status: "closed"
      closed_by: "commit f3063b1 — packages/analytics/src/meta-pixel.tsx created; MetaPixelScript exported from analytics index; injected in all 12 agency (frontend)/layout.tsx files"
    - id: "REQ-157"
      status: "closed"
      closed_by: "commit f3063b1 — AGENCY_SLUGS in scripts/seed-all-agencies.mjs corrected to match 12 deployed apps (web-ai, web-branding, web-ecommerce, web-engineering, web-finance, web-graphic, web-growth, web-main, web-product, web-strategy, web-video, web-webdev)"
    - id: "REQ-200"
      status: "closed"
      closed_by: "commit e67d2b4 — services/page.tsx 'Service pages coming soon.' replaced with real agency-specific copy across all 12 apps"
    - id: "REQ-080 (Payload migrations)"
      status: "deferred"
      phase: "Phase 7"
      reason: "Requires live Postgres connection — run CI=true PAYLOAD_MIGRATING=true DATABASE_URL=<db> npx payload migrate to create brand_voice and brand_glossary tables."
  integration:
    - from: "Phase 05 (CMS)"
      to: "Phase 08 (Public Frontend)"
      issue: "CMS data layer is fully built but zero pages fetch from it. All public pages are static HTML."
    - from: "Phase 07 (AI Assistant)"
      to: "Phase 05 (CMS editor)"
      issue: "AiPanel not in afterDocControls — AI features unreachable in editor"
    - from: "Phase 11 (Analytics)"
      to: "Phase 08 (Layouts)"
      issue: "MetaPixel browser-side component does not exist — browser-side Meta tracking absent"
    - from: "Phase 05 (CMS)"
      to: "Phase 08 (ISR)"
      issue: "revalidateTag not called in collection afterChange hooks — CDN cache never invalidated"
tech_debt:
  - phase: "06-seo-plugin-engine"
    items:
      - "3 live-environment items deferred: real-time SeoPanel score updates, LLM TL;DR auto-generation, role-based collection sidebar visibility"
  - phase: "07-ai-assistant"
    items:
      - "2 live-environment items deferred: AI editor toolbar UI test, brand_voice admin UI visibility"
      - "1 item deferred: stat-without-citation publish block (requires Payload server)"
  - phase: "08-public-frontend"
    items:
      - "4 live-environment items deferred: subdomain DNS routing, ISR revalidation timing, Lighthouse CI against live deploy, axe-core full test suite"
  - phase: "11-analytics-security"
    items:
      - "7 items deferred: 7-system CCPA erasure E2E, Payload migration, receipt PDF delivery, OWASP ZAP live scan, GA4 via sGTM live test, RUM dashboard with real traffic, CCPA form E2E"
  - phase: "01-04, 09-10, 12"
    items:
      - "No VERIFICATION.md files exist for 7 phases — verification was not run during execution"
  - phase: "requirements"
    items:
      - "REQUIREMENTS.md: 162/177 requirements unchecked (documentation not backfilled during execution). 15 checked: REQ-070 to REQ-076, REQ-140 to REQ-143, REQ-146, REQ-153 to REQ-155."
nyquist:
  compliant_phases: []
  partial_phases: []
  missing_phases: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
  overall: MISSING
---

# Milestone v9.1.20 — Audit Report

**Audited:** 2026-04-28  
**Status:** gaps_closed (2026-04-28)  
**Original Audit:** 2026-04-28 — gaps_found (7 critical, 4 broken integrations)  
**Gap Closure Commits:** e67d2b4 (Phase 8: ISR hooks, fetch utils, 132 P0 pages, AiPanel), f3063b1 (MetaPixel + seed slugs)  
**Score:** 15/177 requirements formally verified (documentation gap), 5/12 phases with VERIFICATION.md, 10/10 integration points connected  
**Remaining deferred:** Gap 7 (Payload migrations) requires live Postgres — run `doppler login` then `npx payload migrate`

---

## Phase Verification Summary

| Phase | VERIFICATION.md | Status | Score | Critical Gaps |
|-------|-----------------|--------|-------|---------------|
| 01 Foundation + Infra | ✗ Missing | Unverified | — | — |
| 02 Multi-tenant DB | ✗ Missing | Unverified | — | — |
| 03 Auth + SSO | ✗ Missing | Unverified | — | — |
| 04 Design System | ✗ Missing | Unverified | — | — |
| 05 Central CMS | ✓ Exists | approved | 6/6 | None |
| 06 SEO Plugin Engine | ✓ Exists | human_needed | 7/7 | 3 live-env items deferred |
| 07 AI Assistant | ✓ Exists | human_needed | 5/5 | AiPanel now registered (e67d2b4); Payload migrate deferred (needs live DB) |
| 08 Public Frontend | ✓ Exists | **passed** | 10/10 | All gaps closed (e67d2b4 + f3063b1) |
| 09 CRM + Forms | ✗ Missing | Unverified | — | — |
| 10 Tools + Builder | ✗ Missing | Unverified | — | — |
| 11 Analytics + Security | ✓ Exists | human_needed | 45/45 | MetaPixel gap closed (f3063b1); 7 live-env items remain deferred |
| 12 Launch + QA | ✗ Missing | Unverified | — | Seed slugs corrected (f3063b1) |

---

## Critical Gaps (Blockers)

### Gap 1 — CMS content never reaches public frontend (REQ-090/091/092)
**Severity:** P0 blocker  
**Phase:** 08  
All 12 agency `(frontend)/page.tsx` files contain hardcoded static HTML. No Payload queries, REST fetches, or `getPayload()` calls exist anywhere in the public frontend route handlers. The CMS is built but the frontend never reads from it.

**Fix:** Add `getPayload()` or `fetch('/api/pages?slug=home&agency=...')` calls to each agency's home, services, blog, and tool pages. Wire data into page components.

---

### Gap 2 — AiPanel not registered in Payload admin (REQ-080/081)
**Severity:** P0 blocker  
**Phase:** 07  
`AiPanel.tsx` is implemented and imports all AI editor actions correctly, but `packages/cms/src/config/build-payload-config.ts` only registers `SeoPanel` in `afterDocControls`. AiPanel is never mounted in the editor.

**Fix:** Add `'./src/app/(payload)/admin/components/AiPanel'` to `afterDocControls` array in `build-payload-config.ts` (line ~84).

---

### Gap 3 — ISR revalidateTag absent from collection hooks (REQ-091/093)
**Severity:** P0 blocker  
**Phase:** 08  
`packages/cms/src/collections/pages.ts` and `posts.ts` `afterChange` hooks only call `schedulePublishHook` (BullMQ). No `revalidateTag` or `revalidatePath` call exists. CDN cache is never invalidated when editors save content.

**Fix:** Import `revalidateTag` from `next/cache` and call it in the `afterChange` hook with the agency-scoped tag (e.g., `agency:<id>:page:<slug>`).

---

### Gap 4 — MetaPixel browser-side script missing (REQ-142)
**Severity:** P1  
**Phase:** 11  
`packages/analytics` exports GA4 and Clarity scripts but no MetaPixel component. No agency layout injects the Meta Pixel browser script. Server-side CAPI works but browser-side attribution (view events, page views via pixel) is absent.

**Fix:** Create `packages/analytics/src/meta-pixel.tsx` exporting `<MetaPixelScript pixelId={id} />` and inject into all 12 agency root layouts.

---

### Gap 5 — Seed manifest slugs don't match deployed apps (REQ-157)
**Severity:** P1  
**Phase:** 12  
`scripts/seed-all-agencies.mjs` targets `web-construction, web-dental, web-financial, web-fitness, web-homeservices, web-legal, web-realestate, web-restaurant, web-spa` — none of which have `middleware.ts` in `apps/`. The deployed agency apps are `web-engineering, web-finance, web-graphic, web-growth, web-product, web-strategy, web-video, web-webdev` — none of which are in the manifest. Only `web-ai, web-branding, web-ecommerce` are in both.

**Fix:** Reconcile `AGENCY_SLUGS` in `seed-all-agencies.mjs` to match the actual deployed apps, or align app directory names with the 12-agency design.

---

### Gap 6 — "Service pages coming soon." content violation (REQ-200)
**Severity:** P1  
**Phase:** 08  
Phase 08 VERIFICATION found `Service pages coming soon.` literal text in `services/page.tsx` across all 12 agency apps. CLAUDE.md Rule 5 prohibits any "Coming soon" text.

**Fix:** Replace with real empty-state content: e.g., `"Our [niche] services are available for consultation — contact us to discuss your project."`

---

### Gap 7 — Payload migrations never run (REQ-080)
**Severity:** P1  
**Phase:** 07  
`brand_voice` and `brand_glossary` Payload collections exist in code but Payload migrate was never successfully executed against a live database. The `apps/web-main/migrations/` directory does not exist.

**Fix:** Run `CI=true PAYLOAD_MIGRATING=true DATABASE_URL=<db> npx payload migrate` against a live Postgres instance. Verify tables exist.

---

## Integration Check Results

| Integration Point | Status | Notes |
|---|---|---|
| Auth → all 12 app middlewares | ✓ CONNECTED | `@mjagency/auth` imported in all 12 `middleware.ts` files; `requireSession` in 28 locations |
| DB → features (packages/crm, compliance, analytics) | ✓ CONNECTED | Drizzle schema imported; agencyId filter patterns present |
| SEO plugins → CMS settings | ✓ CONNECTED | `seo_classic/aio_citations/geo_chunking` configured in settings collection |
| CRM forms → lead capture | ✓ PARTIAL | Forms worker calls Payload REST `/api/contacts` (not direct Drizzle); architecturally sound but not via `@mjagency/crm` package |
| Seed → orchestration | ✓ CONNECTED | `seed-all-agencies.mjs` → `seed-payload-collections.ts` → Payload REST |
| Canary + CI gates | ✓ CONNECTED | `canary-deploy.yml` and `pre-launch-gate.yml` present and valid |
| CMS data → public frontend pages | ✓ CONNECTED | All 132 P0 page routes call fetchPageBySlug/fetchPostsIndex (commit e67d2b4) |
| AI panel → CMS editor | ✓ CONNECTED | AiPanel added to afterDocControls (commit e67d2b4) |
| MetaPixel → agency layouts | ✓ CONNECTED | MetaPixelScript injected in all 12 (frontend)/layout.tsx (commit f3063b1) |
| ISR revalidation → CMS hooks | ✓ CONNECTED | isrPurgeHook/isrPurgePostHook in pages/posts afterChange (commit e67d2b4) |

**Connected: 10/10 | Broken: 0/10**

---

## Requirements Coverage

| Phase | Requirements | Formally Verified | Documentation State |
|-------|-------------|-------------------|---------------------|
| 06 SEO | REQ-070–076 | ✓ (VERIFICATION.md) | [x] in REQUIREMENTS.md |
| 11 Analytics | REQ-140–143, REQ-146 | ✓ (VERIFICATION.md) | [x] in REQUIREMENTS.md |
| 12 Canary/Runbooks | REQ-153–155 | ✓ (SUMMARY.md) | [x] in REQUIREMENTS.md |
| 05 CMS | REQ-050–063+ | ✓ (VERIFICATION.md) | [ ] (documentation gap) |
| 01–04, 07–12 | REQ-001–049, REQ-080–134, REQ-144–157+ | Unverified or partial | [ ] (not backfilled) |

**Formally verified: 15/177 per documentation. Functionally delivered: estimated 120+/177 based on SUMMARY.md evidence — but 7 critical gaps exist.**

---

## Nyquist Compliance

No `*-VALIDATION.md` files exist for any phase. Nyquist auditor was never run across this milestone. All 12 phases are `MISSING`.

---

## Recommended Resolution

**Priority 1 — Fix before any deployment:**
1. Wire CMS data into public frontend pages (Gap 1)
2. Add AiPanel to `afterDocControls` (Gap 2) — 1-line fix
3. Add `revalidateTag` to CMS collection hooks (Gap 3)

**Priority 2 — Fix before launch claim:**
4. Create MetaPixel browser-side component (Gap 4)
5. Reconcile seed manifest slugs with deployed apps (Gap 5)
6. Replace "coming soon" text (Gap 6)

**Priority 3 — Requires live environment:**
7. Run Payload migrations (Gap 7)
8. Validate 7 deferred Phase 11 live-environment items

**Documentation (not blocking):**
9. Backfill REQUIREMENTS.md checkboxes for delivered requirements
10. Run VERIFICATION for phases 01–04, 09–10, 12
