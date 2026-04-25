MILESTONE M008 - PUBLIC FRONTEND + PAGE TREE
Branch: milestone/M008-public-frontend
Model: claude-sonnet-4-6
Depends on: M005 + M006 + M007 complete
Read: specs/media.md (image pipeline), specs/architecture.md (ISR section)

GOAL: All 12 agency Next.js apps fully functional with real content,
      ISR, RUM, WCAG, and the complete image pipeline.

SLICES:

SLICE 1: Base Next.js App Template
  Task 1.1: shared layout in packages/ui
    - Root layout with: font preloads, nonce injection, OTel headers
    - Per-agency theme token CSS variables loaded from DB on request
    - Admin bar injection (Puck) when session = admin/super_admin
    - Web Vitals RUM script (async, non-blocking, <5KB)
    - GA4 + GTM snippet (server-side if possible)
  Task 1.2: Global components
    - Header: nav, logo, CTA button (per agency theme)
    - Footer: links, copyright, legal (per agency)
    - Cookie consent banner (Cloudflare Analytics compliant)
    - Error boundary (catches Lexical/Puck crashes gracefully)
    - 404 page (niche illustration + helpful links)
    - 500 page (niche illustration + status info)

SLICE 2: Image Pipeline
  Task 2.1: Art-directed picture component
    - <picture> element with:
        mobile portrait AVIF/WebP/JPEG (srcset)
        desktop landscape AVIF/WebP/JPEG (srcset)
    - fetchpriority="high" on LCP image
    - loading="eager" on above-fold, loading="lazy" below-fold
    - decoding="async" always
    - style="background-color: var(--hero-dominant-color)" on img
    - BlurHash placeholder (CSS, no JS required)
    - width + height attributes always (CLS = 0)
  Task 2.2: LCP preload (single per page)
    - <link rel="preload" as="image" imagesrcset imagesizes fetchpriority="high">
    - Separate mobile + desktop preloads with media queries
    - AVIF only in preload (progressive enhancement)
  Task 2.3: NEVER dangerouslyAllowSVG on Next.js Image
    - SVG illustrations served via <img> tag with sanitized source
    - Next.js Image only for AVIF/WebP/JPEG raster files
    - ESLint rule: warn if dangerouslyAllowSVG found in config

SLICE 3: ISR + Cache Tag Purge
  Task 3.1: ISR setup per agency
    - Each page: revalidate = false (on-demand ISR only)
    - Cache tags: agency:<id>:page:<slug>
    - Payload afterChange hook -> POST /api/revalidate
    - /api/revalidate: verifies REVALIDATE_SECRET, calls revalidateTag()
  Task 3.2: Fanout for shared assets
    - Super_admin changes shared media asset
    - BullMQ job fans out revalidation to all 12 agencies
    - Each agency receives webhook on /api/revalidate
    - Max propagation: <60 seconds

SLICE 4: 12 Agency Apps (all P0 pages per agency)
  Task 4.1: Each agency renders all P0 pages:
    / (home), /about, /services, /services/[slug], /tools/[slug],
    /blog, /blog/[slug], /contact, /faq, /pricing,
    /privacy-policy, /terms-of-service, /cookie-policy
  Task 4.2: Niche theme applied
    - Niche default theme loaded from packages/ui/themes/
    - Agency overrides applied from DB settings
    - All 12 agencies render visually distinct (niche typography + colors)

SLICE 5: RUM + Performance
  Task 5.1: web-vitals RUM script
    - Installed in root layout (async, non-blocking)
    - Collects LCP, INP, CLS, FCP, TTFB
    - Sends to GA4 via Measurement Protocol
    - Sends to internal rum_events table
  Task 5.2: Lighthouse CI
    - GitHub Action: Lighthouse CI on all P0 pages
    - Budgets: LCP <2.5s, CLS <0.1, TBT <600ms
    - Fail CI if budget exceeded

SLICE 6: WCAG 2.2 AA + Accessibility
  Task 6.1: axe-core CI scan
    - Playwright + axe-core tests on all P0 pages
    - Zero critical violations required to pass CI
    - Zero serious violations required to pass CI
  Task 6.2: Manual checklist (document for QA)
    - Keyboard navigation: all interactive elements reachable
    - Screen reader: all icons labeled, all images have alt
    - Focus ring: visible on all interactive elements
    - Color contrast: 4.5:1 for small text, 3:1 for large
    - Reduced motion: all animations respect prefers-reduced-motion

SUCCESS CRITERIA:
  All 12 agencies load at their local subdomain (dev)
  Lighthouse CI: LCP <2.5s on all P0 pages
  Lighthouse CI: CLS = 0 on all P0 pages
  axe-core: zero critical/serious violations on all P0 pages
  ISR purge: edit in Payload -> live within 60s (timed test)
  No dangerouslyAllowSVG in any next.config.mjs
  BlurHash visible before image loads (visual test)
  RUM events visible in GA4 debug mode

SLICE 7: Full Per-Agency Page Tree + UI Implementation
  Task 7.1: Implement all page types per agency (read specs/website-ui.md):
    - Homepage: all 13 sections (hero -> trust bar -> problem -> solution ->
      process -> tool CTA -> case studies -> testimonials -> why us ->
      pricing teaser -> FAQ preview -> final CTA -> footer)
    - Service pages: all 12 sections per page
    - Blog list + post layout with sidebar
    - Tools list page + individual tool pages
    - About page: all 8 sections
    - Contact page: two-column form + info
    - Pricing page: tiered or project-based per agency
    - FAQ page: tabbed accordion + schema
    - Legal pages: ToC + last updated date
    - 404 + 500 pages: niche illustration + helpful links
  Task 7.2: Navigation implementation
    - Sticky header (glassmorphism) for all 12 agencies
    - Mega menu for Services nav item
    - Mobile: full-screen overlay menu
    - Footer: 4-column desktop / 2-column mobile / 1-column small
  Task 7.3: Agency-specific visual differentiation
    - Apply niche design language per agency (read specs/website-ui.md)
    - Typography: different font pairing per agency niche
    - Hero treatment: unique per agency (video for video, dashboard for growth, etc.)
    - Unique homepage section per agency (see agency-specific UI section)

SLICE 8: Advanced UI Functionality
  Task 8.1: Scroll animations (CSS IntersectionObserver, no heavy libs)
  Task 8.2: Counter animations on stats sections
  Task 8.3: Logo marquee (CSS-only, no JS)
  Task 8.4: Dark mode (token swap, no flash, localStorage)
  Task 8.5: Mega menu keyboard navigation (ARIA compliant)
  Task 8.6: Blog TOC scroll-spy (IntersectionObserver)
  Task 8.7: Video facade pattern (lite-youtube-embed)
  Task 8.8: Floating mobile CTA (appears at 50% scroll)
  Task 8.9: Cookie banner (minimal, bottom bar)
  Task 8.10: BlurHash fade-in on all images

SLICE 9: Admin Panel UI (read specs/admin-ui.md)
  Task 9.1: Custom Payload admin dashboard (per-agency + super_admin)
  Task 9.2: All admin navigation sections wired to collections
  Task 9.3: Admin notifications (bell icon, alert types)
  Task 9.4: Cmd+K global search in admin
  Task 9.5: Brand Setup Wizard (6 steps, first-login UX)
  Task 9.6: Theme editor with live preview iframe
  Task 9.7: Admin keyboard shortcuts
  Task 9.8: Mobile-responsive admin (tablet+)

Updated SUCCESS CRITERIA:
  All homepage sections render correctly for all 12 agencies
  Mega menu: keyboard navigable, accessible (axe-core pass)
  Dark mode: token swap works, no flash on page load
  Counter animations: count up fires once on viewport enter
  Logo marquee: pauses on hover, no JS, smooth loop
  Video facade: no YouTube JS loads until play clicked
  Admin dashboard: agency health grid visible to super_admin
  Brand Setup Wizard: completes in <30 min (timed test)
  Cmd+K search: returns results in <300ms
  All 12 agencies: visually distinct (screenshot comparison QA)
