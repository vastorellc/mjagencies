---
milestone: v9.1.20
audited: 2026-04-28T14:30:00Z
status: gaps_found
scores:
  requirements: 15/177
  phases_verified: 5/12
  integration: 6/10
  flows_complete: 4/8
gaps:
  requirements:
    - id: "REQ-090 / REQ-091 / REQ-092"
      status: "unsatisfied"
      phase: "Phase 8"
      reason: "All 12 agency (frontend)/page.tsx files are static hardcoded HTML — no Payload CMS data is fetched anywhere in the public frontend. CMS content never reaches rendered pages."
      evidence: "apps/web-ecommerce/src/app/(frontend)/page.tsx contains hardcoded static HTML with no fetchPages, getPayload(), or REST fetch. Same pattern across all 12 apps."
    - id: "REQ-080 / REQ-081"
      status: "unsatisfied"
      phase: "Phase 7"
      reason: "AiPanel.tsx exists at apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx and correctly imports AI editor actions, but it is never registered in build-payload-config.ts afterDocControls. Only SeoPanel is registered. AI editor features are unreachable."
      evidence: "packages/cms/src/config/build-payload-config.ts afterDocControls: ['./src/app/(payload)/admin/components/SeoPanel']. AiPanel absent."
    - id: "REQ-091 / REQ-093"
      status: "unsatisfied"
      phase: "Phase 8"
      reason: "ISR cache revalidation (revalidateTag) is not called in any Payload collection afterChange hooks. packages/cms/src/collections/pages.ts and posts.ts afterChange hooks fire schedulePublishHook only. CDN cache never invalidated on content edit."
      evidence: "packages/cms/src/collections/pages.ts line 80 afterChange: schedulePublishHook only. No revalidateTag call."
    - id: "REQ-142"
      status: "unsatisfied"
      phase: "Phase 11"
      reason: "No browser-side Meta Pixel script component exists. packages/meta-capi handles server-side Conversions API only. packages/analytics/src/index.ts exports no MetaPixel component. Zero agency app layouts inject fbq initialization."
      evidence: "grep -r 'MetaPixel\\|fbq\\|connect.facebook.net' apps/ returns 0 matches."
    - id: "REQ-157"
      status: "unsatisfied"
      phase: "Phase 12"
      reason: "Seed manifest slug list does not match deployed agency apps. Manifest seeds: web-ai, web-branding, web-construction, web-dental, web-ecommerce, web-financial, web-fitness, web-homeservices, web-legal, web-realestate, web-restaurant, web-spa. Deployed apps with middleware (the real 12): web-ai, web-branding, web-ecommerce, web-engineering, web-finance, web-graphic, web-growth, web-main, web-product, web-strategy, web-video, web-webdev. Only 3 slugs overlap."
      evidence: "scripts/seed-all-agencies.mjs lines 17-20 vs apps/*/middleware.ts presence check."
    - id: "REQ-200"
      status: "unsatisfied"
      phase: "Phase 8"
      reason: "Phase 08 VERIFICATION found 'Service pages coming soon.' text in services/page.tsx across all 12 agency apps. CLAUDE.md Rule 5 explicitly prohibits 'Coming soon' text."
      evidence: "08-VERIFICATION.md gap #1: apps/web-ecommerce, web-ai, web-branding services/page.tsx line 58/29."
    - id: "REQ-080 (Payload migrations)"
      status: "unsatisfied"
      phase: "Phase 7"
      reason: "Payload migrate was never successfully run. No migrations/ directory exists in apps/web-main. brand_voice and brand_glossary tables were never created in any Postgres database."
      evidence: "07-VERIFICATION.md gap: apps/web-main/migrations/ directory does not exist. ECONNREFUSED 127.0.0.1:5432 during migrate."
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
**Status:** gaps_found  
**Score:** 15/177 requirements formally verified (documentation gap), 5/12 phases with VERIFICATION.md, 6/10 integration points connected

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
| 07 AI Assistant | ✓ Exists | human_needed | 4/5 | Payload migrate never run; AiPanel not registered |
| 08 Public Frontend | ✓ Exists | gaps_found | 9/10 | "Coming soon" text; CMS data not fetched |
| 09 CRM + Forms | ✗ Missing | Unverified | — | — |
| 10 Tools + Builder | ✗ Missing | Unverified | — | — |
| 11 Analytics + Security | ✓ Exists | human_needed | 44/45 | 7 live-env items; MetaPixel missing |
| 12 Launch + QA | ✗ Missing | Unverified | — | — |

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
| CMS data → public frontend pages | ✗ BROKEN | All `page.tsx` files static; no Payload fetch exists |
| AI panel → CMS editor | ✗ BROKEN | AiPanel not in `afterDocControls` |
| MetaPixel → agency layouts | ✗ BROKEN | No browser-side pixel component exists |
| ISR revalidation → CMS hooks | ✗ BROKEN | `revalidateTag` absent from collection `afterChange` hooks |

**Connected: 6/10 | Broken: 4/10**

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
