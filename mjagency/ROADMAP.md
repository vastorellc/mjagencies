ROADMAP.md - MJAgency Build Roadmap

==============================================================
MILESTONE DEPENDENCY DAG
==============================================================

M001 Foundation + Infra
  |
  v
M002 Multi-tenant DB + Migration
  |
  v
M003 Auth + SSO + Edge Routing
  |
  +----> M004 Design System + Theme
  |         |
  |         v
  |      M005 CMS + Blocks + Editor -----> M006 SEO Plugin (parallel with M007)
  |         |                              M007 AI Assistant (parallel with M006)
  |         |
  |         v
  |      M008 Public Frontend (12 agencies)
  |
  +----> M009 CRM + Forms + Booking
            |
            v
          M010 Tools + Pitch + PDF + Builder
            |
            v
          M011 Analytics + Compliance + Security
            |
            v
          M012 Launch + QA + Seeds + Runbooks

Parallel safe:
  M006 + M007 (both depend only on M005)
  M009 starts after M003 (auth done), parallel to M004/M005
  M010 starts after M009
  M011 starts after M010
  Content sprint workstream: starts after M005 cms-collections slice

==============================================================
M001 - FOUNDATION + INFRA
==============================================================
Goal: Working monorepo, all infra running, CI/CD live

Slices:
  1. Turborepo monorepo scaffold + pnpm workspaces
  2. Docker Compose (Postgres x13, Redis, Mailhog, Stripe CLI)
  3. Cloudflare pipeline (Images, Stream, R2, Workers)
  4. OpenTelemetry + Prometheus + Loki + Grafana
  5. CI/CD (GitHub Actions, canary gates, test pipeline)

Success criteria:
  - pnpm dev --filter=@mjagency/web-main runs without error
  - Docker Compose starts all 13 Postgres instances
  - OTel traces appear in Grafana
  - CI passes on main branch

==============================================================
M002 - MULTI-TENANT DB + MIGRATION
==============================================================
Goal: Per-agency Postgres, migrations, seed framework, backup

Slices:
  1. Drizzle schema design (all base tables with agency_id + RLS)
  2. PgBouncer config per agency (transaction mode, pool_size=20)
  3. Migration runner (parallel, per-agency, dry-run/canary/rollback)
  4. Seed framework (per-agency, transactional, resume on fail)
  5. Backup automation (WAL + hourly snapshots + R2 upload)
  6. Permissions vault schema + audit log (hash-chained)

Success criteria:
  - Migration runs clean across all 13 DBs
  - Seed --agency=ecommerce completes without error
  - RLS blocks cross-agency query (integration test passes)
  - Backup restores to staging successfully

==============================================================
M003 - AUTH + SSO + EDGE ROUTING
==============================================================
Goal: Secure auth, Cloudflare routing, audit log working

Slices:
  1. JWT (jose) + refresh token rotation + Redis revocation store
  2. MFA (TOTP) + recovery codes
  3. SSO at accounts.brand.com
  4. Cloudflare middleware (subdomain routing, rate limits, security headers)
  5. Auth server actions pattern + middleware pattern locked in codebase
  6. Audit log (hash-chained, append-only, 7yr retention)

Success criteria:
  - Login, token refresh, logout all work
  - Expired refresh token replay = force logout + family revocation
  - Cloudflare routes agency subdomains correctly
  - Audit log row hashes verified
  - CVE-2025-29927: Next.js >=15.2.3 confirmed

==============================================================
M004 - DESIGN SYSTEM + THEME ENGINE
==============================================================
Goal: Token system, theme resolution, niche defaults, A/B

Slices:
  1. CSS variable token schema (all 6 token layers)
  2. theme.json manifest + JSON Schema validator
  3. Theme resolution stack (base -> agency -> page)
  4. 12 niche default themes (one per agency)
  5. A/B test framework + marketplace stub

Success criteria:
  - Theme switch is instant (<16ms) via CSS variable update
  - Niche default themes render correctly for all 12 agencies
  - Token validator rejects hex literals in SVG
  - Dark mode works on all 12 agencies

==============================================================
M005 - CENTRAL CMS + BLOCKS + EDITOR UX
==============================================================
Goal: Payload 3 running, 45 blocks, Lexical editor, DAM

Slices:
  1. Payload 3.82.1 setup (withPayload, collections scaffold)
  2. Core Payload collections (pages, posts, authors, categories, media)
  3. 45 block library (all categories)
  4. Lexical editor full feature config (toolbar, SEO panel, AI hooks)
  5. DAM (library UX, 3 views, search, permissions vault, brand portal)
  6. Content sprint workstream START (after slice 1+2 complete)

Content sprint (parallel workstream):
  - AI drafts all content per agency using LiteLLM
  - Writes to Payload via REST API
  - Validators run on every save
  - Covers: blog posts, service pages, FAQ, tool content, legal pages

Success criteria:
  - Payload admin loads at /admin without error
  - All 45 blocks render in editor
  - Lexical editor shows full toolbar with SEO panel
  - Content sprint: at least 1 agency fully seeded
  - DAM: upload, validate, publish flow works

==============================================================
M006 - SEO/AIO/GEO PLUGIN ENGINE
==============================================================
Goal: 3 SEO plugins, self-learning loop, algorithm watcher

Slices:
  1. Plugin runtime + parameter store
  2. seo-classic plugin
  3. aio-citations plugin
  4. geo-chunking plugin
  5. Self-learning loop (GSC/GA4 signals -> AI tuner -> suggestions)
  6. Algorithm watcher (RSS monitoring)

Success criteria:
  - SEO score updates in real-time in Lexical editor sidebar
  - All 3 plugins configurable from admin without code
  - Per-agency plugin overrides work

==============================================================
M007 - AI ASSISTANT + ANTI-FABRICATION
==============================================================
Goal: LiteLLM gateway, 20 AI features, guards, brand voice

Slices:
  1. LiteLLM gateway (per-agency cost caps, model routing)
  2. 20 editor AI features (draft, rewrite, shorten, expand, etc)
  3. Anti-fabrication guards (stat detector, quote detector, placeholder lint)
  4. Brand voice + glossary + banned phrases per agency
  5. PII redactor before LLM calls
  6. Prompt injection protection (XML wrapping, jailbreak classifier)

Success criteria:
  - AI rewrite works in Lexical editor
  - Stat without source is blocked
  - Cost cap per agency enforced via LiteLLM budget manager
  - PII stripped from all LiteLLM calls

==============================================================
M008 - PUBLIC FRONTEND + PAGE TREE
==============================================================
Goal: 12 agency Next.js apps, ISR, RUM, WCAG, image pipeline

Slices:
  1. Base Next.js app template (shared across all 12 agencies)
  2. Per-agency app scaffold (12 apps, each with niche theme)
  3. ISR + tag-based cache purge (Payload afterChange -> revalidateTag)
  4. Image pipeline (AVIF, WebP, BlurHash, art-directed picture)
  5. RUM script (web-vitals, LCP/INP/CLS, GA4 events)
  6. WCAG 2.2 AA + axe-core CI tests
  7. All P0 pages per agency (home, about, services, blog, contact, etc)

Success criteria:
  - All 12 agency sites load at their subdomain
  - LCP <2.5s on all P0 pages (Lighthouse CI)
  - CLS = 0 on all P0 pages
  - axe-core: zero critical violations
  - ISR purge works within 60s after content edit

==============================================================
M009 - CRM + FORMS + BOOKING + LEAD ROUTING
==============================================================
Goal: Full CRM, forms, Cal.com, email engine, sequences

Slices:
  1. CRM core (contacts, accounts, deals, activities, tasks)
  2. Lead scoring + tagging + automation workflows
  3. Form builder (all form types, spam protection, UTM capture)
  4. Email engine (DKIM/SPF/DMARC, sequences, BullMQ)
  5. Cal.com self-hosted integration + CRM sync
  6. Twilio SMS (TCPA compliant, opt-in enforced)
  7. Per-niche pre-seeded CRM data (pipelines, templates, sequences)

Success criteria:
  - Form submit -> contact created in CRM (test)
  - 4h SLA timer starts on new lead
  - Booking -> CRM activity logged (Cal.com webhook)
  - Email DKIM/SPF/DMARC validates in setup wizard
  - All 12 agencies have pre-seeded CRM data

==============================================================
M010 - TOOLS + PITCH + PDF + BUILDER
==============================================================
Goal: 36 tools, proposal builder, e-sign, invoicing, Puck builder

Slices:
  1. Tool engine (calculator, benchmark datasets, result renderer)
  2. 36 tools built (3 per agency x 12)
  3. Tool content (full page per tool, 2200+ words, SEO complete)
  4. Proposal builder (hosted page, view tracking, expiry)
  5. E-sign (ESIGN Act compliant, PDF generation, vault storage)
  6. Stripe + PayPal invoicing (dunning, partial payments, refunds)
  7. Puck visual builder (admin bar, meta panel, SEO score widget)

Success criteria:
  - All 36 tools calculate correctly (math test vs spreadsheet)
  - Tool result PDF generates and emails
  - Proposal sign -> CRM Won -> deposit invoice auto-sent
  - Puck builder: auth-gated, scoped per agency
  - Invoice partial payment tracked in CRM

==============================================================
M011 - ANALYTICS + COMPLIANCE + SECURITY
==============================================================
Goal: GA4, Clarity, RUM dashboards, CCPA, WAF, hardening

Slices:
  1. GA4 + GTM server-side container setup
  2. Microsoft Clarity + heatmaps
  3. Meta CAPI server-side
  4. Analytics dashboards (per-agency + platform overview)
  5. CCPA/ADA compliance tooling
  6. WAF + Cloudflare security rules
  7. Security hardening (CSP nonce, OWASP ZAP scan, pen test)

Success criteria:
  - GA4 events flow for all P0 actions
  - RUM shows LCP/INP/CLS per page in dashboard
  - OWASP ZAP scan: zero high-severity findings
  - CSP headers present on all pages
  - CCPA erasure flow works end-to-end

==============================================================
M012 - LAUNCH + QA + SEEDS + RUNBOOKS + SLA
==============================================================
Goal: Full QA pass, all agencies seeded, canary deploy, handoff

Slices:
  1. Full QA matrix (automated, all 12 agencies)
  2. Complete seed run (all 12 agencies, all content)
  3. Pre-launch CI gate (gsd headless, exit 0 = pass)
  4. Canary deploy pipeline (5% -> health check -> 100%)
  5. All runbooks written (13 runbooks)
  6. SLA documentation
  7. Brand Setup Wizard ready (only user task post-generate)

Success criteria:
  - All QA checks pass for all 12 agencies
  - All 12 agencies have 100% content coverage
  - gsd headless exits 0 (pre-launch gate)
  - Canary deploy executes without rollback
  - Brand Setup Wizard documented and functional

SLA commitments:
  Public site uptime: 99.9%/month
  Admin uptime: 99.5%/month
  RPO: 1 hour
  RTO: 4 hours
  First response (CRM leads): 4 hours business hours
  Cache purge after publish: <60 seconds
