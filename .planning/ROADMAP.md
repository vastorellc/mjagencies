# Roadmap: MJAgency Multi-Agency Platform

## Overview

12 milestones (M001…M012) → 12 phases. Foundation → multi-tenant DB → auth → design system → CMS → SEO/AI plugins → public frontend → CRM → tools/builder → analytics/security → launch. M001–M003 are architectural (Opus model). M004–M012 execution (Sonnet). Per-milestone branch (`milestone/M00N-name`), squash to main on complete.

Source spec: `mjagency/specs/milestone-M00N.md` per phase. Dependency DAG below permits some parallelism after M003.

```
M001 → M002 → M003 → M004 → M005 → ┬→ M006 ┐
                                   └→ M007 ┘
                          M005 → M008
M003 → M009 → M010 → M011 → M012
```

Parallel-safe: M006+M007 (both depend on M005 only); M009 starts after M003 (parallel to M004/M005); content sprint workstream starts mid-M005.

## Phases

- [ ] **Phase 1: Foundation + Infra** — Working monorepo, Docker Compose, Cloudflare pipeline, OTel, CI/CD, Doppler secrets
- [ ] **Phase 2: Multi-tenant DB + Migration** — Per-agency Postgres, PgBouncer, Drizzle schema, RLS, migration runner, backups, audit log
- [ ] **Phase 3: Auth + SSO + Edge Routing** — JWT (jose), MFA, SSO, Cloudflare middleware, audit log, server-action auth pattern
- [ ] **Phase 4: Design System + Theme Engine** — CSS variable tokens, theme.json validator, 12 niche themes, A/B framework
- [ ] **Phase 5: Central CMS + Block Library + Editor UX** — Payload 3.82.1, 45 blocks, Lexical editor, DAM, content sprint kickoff
- [ ] **Phase 6: SEO/AIO/GEO Plugin Engine** — 3 plugins, real-time scoring, self-learning loop, algorithm watcher
- [ ] **Phase 7: AI Assistant + Anti-Fabrication** — LiteLLM gateway, 20 editor AI features, anti-fab guards, brand voice, PII redaction
- [ ] **Phase 8: Public Frontend + Page Tree** — 12 agency apps, ISR + tag purge, image pipeline, RUM, WCAG 2.2 AA, P0 pages
- [ ] **Phase 9: CRM + Forms + Booking** — CRM core, lead scoring, forms, email engine, Cal.com, Twilio SMS, niche pre-seeds
- [ ] **Phase 10: Tools + Pitch + PDF + Builder** — 36 tools, proposal builder, e-sign, Stripe/PayPal invoicing, Puck builder
- [ ] **Phase 11: Analytics + Compliance + Security** — GA4, Clarity, Meta CAPI, dashboards, CCPA, WAF, CSP, OWASP scan
- [ ] **Phase 12: Launch + QA + Seeds + Runbooks** — Full QA matrix, complete seeds, canary deploy, 13 runbooks, Brand Setup Wizard

## Phase Details

### Phase 1: Foundation + Infra
**Goal**: Working monorepo with all 13 apps scaffolded, Docker Compose for local dev, Cloudflare pipeline connected, CI/CD with test gates, OTel traces flowing to Grafana, all secrets in Doppler.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-304, REQ-307, REQ-426, REQ-427, REQ-428, REQ-501, REQ-502, REQ-503
**Success Criteria** (what must be TRUE):
  1. `pnpm dev --filter=@mjagency/web-main` starts without error
  2. Docker Compose: all services healthy (13 Postgres DBs, Redis, Mailhog, Stripe CLI, PgAdmin)
  3. CF Images test upload returns AVIF URL
  4. OTel trace visible in Grafana Tempo end-to-end
  5. CI passes on main branch (lint + typecheck + tests + version-pin checks + secret-pattern checks)
  6. `pnpm list payload` shows exactly 3.82.1 across all apps
**Plans**: 6 plans (one per slice)

Plans:
- [x] 01-01-PLAN.md (Wave 1) — Turborepo + pnpm workspaces + Next.js 15 + Payload 3.82.1 base template (web-main + scaffolds for 11 agency apps)
- [x] 01-02-PLAN.md (Wave 2) — Docker Compose (Postgres x13 in shared instance, Redis, Mailhog, Stripe CLI, PgAdmin) + PgBouncer per agency
- [x] 01-03-PLAN.md (Wave 2) — Cloudflare pipeline — Images, Stream, R2 SDKs in `packages/media`; `packages/builder` + `packages/tools` scaffolds (types-only at M001)
- [x] 01-04-PLAN.md (Wave 3) — OpenTelemetry (sdk-node, traceparent, Pino + redact, DB query trace_id injection) + Prometheus/Loki/Grafana/Tempo dashboards
- [ ] 01-05-PLAN.md (Wave 4) — GitHub Actions CI — install/build/test, ESLint, typecheck, bundle-size, version-pin checks, npm audit, secret-pattern grep
- [ ] 01-06-PLAN.md (Wave 3) — Doppler workspace setup — per-agency project + shared project, CLI injection at build, secret-rotation runbook

### Phase 2: Multi-tenant DB + Migration
**Goal**: Per-agency Postgres with migrations, seed framework, backup automation, permissions vault, hash-chained audit log.
**Depends on**: Phase 1
**Requirements**: REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-306, REQ-407, REQ-425
**Success Criteria** (what must be TRUE):
  1. Migration runs clean across all 13 DBs (parallel, dry-run, canary, rollback verified)
  2. `seed --agency=ecommerce` completes without error and is resumable on failure
  3. RLS blocks cross-agency queries (integration test)
  4. Backup restore to staging completes successfully (quarterly DR runbook)
  5. Audit log row hashes verify (hash chain intact, append-only enforced)
  6. BullMQ payloads with sensitive data are AES-GCM-256 encrypted before Redis write
**Plans**: 6 plans

Plans:
- [ ] 02-01: Drizzle schema design — all base tables with `agency_id` + RLS + `agency_id` immutable access rule
- [ ] 02-02: PgBouncer per-agency config (transaction mode, pool_size=20, ports 6432–6444) + PM2 supervision
- [ ] 02-03: Migration runner — parallel, per-agency, dry-run, canary stage, rollback path
- [ ] 02-04: Seed framework — per-agency, transactional, resume on fail
- [ ] 02-05: Backup automation — WAL streaming, hourly snapshots, R2 upload, quarterly DR drill
- [ ] 02-06: Permissions vault schema (encrypted, 7yr retention) + audit log (hash-chained, append-only)

### Phase 3: Auth + SSO + Edge Routing
**Goal**: Secure auth, Cloudflare routing, MFA, audit log, server-action auth pattern locked into the codebase.
**Depends on**: Phase 2
**Requirements**: REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-300, REQ-308, REQ-309, REQ-310, REQ-400, REQ-408, REQ-424
**Success Criteria** (what must be TRUE):
  1. Login, token refresh, logout all work with `jose`-only JWTs
  2. Expired refresh token replay forces logout + family revocation
  3. Cloudflare routes agency subdomains correctly; `/(payload)/admin` and `/api/*` are excluded from middleware matcher
  4. Audit log row hashes verified
  5. Next.js >= 15.2.3 confirmed (CVE-2025-29927 patch); CI gate active
  6. MFA enforced for super_admin + admin; recovery codes stored bcrypt; agency owner cannot self-delete
**Plans**: 6 plans

Plans:
- [ ] 03-01: JWT (jose) — access 15min, refresh 7d one-time-use with family revocation, Redis revocation store, httpOnly+SameSite=Strict+Secure cookies
- [ ] 03-02: MFA (TOTP) + 8 one-time bcrypt-stored recovery codes
- [ ] 03-03: SSO at accounts.brand.com
- [ ] 03-04: Cloudflare middleware — subdomain routing, rate limits, security headers, exclude Payload admin + API
- [ ] 03-05: Server-action auth pattern locked in codebase (session check as first line) + middleware pattern
- [ ] 03-06: Audit log (hash-chained, append-only, 7yr retention) + open-redirect prevention + agency-owner self-delete block

### Phase 4: Design System + Theme Engine
**Goal**: 6-layer CSS variable tokens, theme.json validator, 12 niche default themes, dark mode via token swap, A/B framework.
**Depends on**: Phase 3
**Requirements**: REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-048
**Success Criteria** (what must be TRUE):
  1. Theme switch is instant (<16ms) via CSS variable update
  2. All 12 niche default themes render correctly (one per agency)
  3. Token validator rejects hex literals in SVG illustrations
  4. Dark mode works on all 12 agencies via token swap (no asset reload)
  5. Storybook visual regression CI passes for 45 blocks × 12 themes
**Plans**: 5 plans

Plans:
- [ ] 04-01: CSS variable token schema — all 6 layers
- [ ] 04-02: `theme.json` manifest + JSON Schema validator (rejects hex literals)
- [ ] 04-03: Theme resolution stack — base → agency → page (20 customization scopes per agency)
- [ ] 04-04: 12 niche default themes pre-built (one per agency)
- [ ] 04-05: A/B test framework + marketplace stub + Storybook visual-regression CI

### Phase 5: Central CMS + Block Library + Editor UX
**Goal**: Payload 3.82.1 admin running, 45 blocks, Lexical editor with full toolbar + SEO panel, DAM, content sprint workstream kickoff.
**Depends on**: Phase 4
**Requirements**: REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061, REQ-062, REQ-063, REQ-201, REQ-203, REQ-205, REQ-207, REQ-305, REQ-410, REQ-411, REQ-412, REQ-421, REQ-505
**Success Criteria** (what must be TRUE):
  1. Payload admin loads at `/admin` without error (embedded via `withPayload`)
  2. All 45 blocks render in editor across 11 categories
  3. Lexical editor shows full fixed + inline toolbar with SEO/AIO/GEO sidebar (real-time scoring)
  4. DAM upload→validate→publish flow works (3 views, multi-search modes)
  5. Content sprint workstream produces at least 1 fully seeded agency
  6. SVG uploads sanitized via DOMPurify + SVGO; word-count floors and FTC playbook disclaimer enforced
**Plans**: 6 plans

Plans:
- [ ] 05-01: Payload 3.82.1 setup (`withPayload`, collections scaffold)
- [ ] 05-02: Core Payload collections — pages, posts, authors, categories, media (kicks off content sprint workstream)
- [ ] 05-03: 45-block library across 11 categories
- [ ] 05-04: Lexical editor — full toolbar, fixed+inline, SEO panel, AI hooks
- [ ] 05-05: DAM — library UX, 3 views, text/semantic/visual/color search, permissions vault, brand portal, living brand book
- [ ] 05-06: Content sprint workstream — LiteLLM drafts content per agency, REST API writes, validators on every save

### Phase 6: SEO/AIO/GEO Plugin Engine
**Goal**: 3 SEO plugins runtime-configurable from admin, self-learning loop, algorithm watcher, AIO TL;DR + FAQ schema.
**Depends on**: Phase 5
**Requirements**: REQ-070, REQ-071, REQ-072, REQ-073, REQ-074, REQ-075, REQ-076
**Success Criteria** (what must be TRUE):
  1. SEO score updates in real-time in Lexical editor sidebar
  2. All 3 plugins (seo-classic, aio-citations, geo-chunking) configurable from admin without code
  3. Per-agency plugin overrides work
  4. AIO TL;DR (≤120 chars) required on all indexable pages
  5. FAQ schema auto-generated on all FAQ-eligible pages
**Plans**: 6 plans

Plans:
- [ ] 06-01: Plugin runtime + parameter store
- [ ] 06-02: seo-classic plugin
- [ ] 06-03: aio-citations plugin
- [ ] 06-04: geo-chunking plugin
- [ ] 06-05: Self-learning loop — GSC/GA4 signals → AI tuner → suggestions
- [ ] 06-06: Algorithm watcher (RSS monitoring of Google Search Central)

### Phase 7: AI Assistant + Anti-Fabrication
**Goal**: LiteLLM gateway with per-agency cost caps, 20 editor AI features, anti-fab guards, brand voice + glossary, PII redactor, prompt-injection protection.
**Depends on**: Phase 5 (parallel-safe with Phase 6)
**Requirements**: REQ-080, REQ-081, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-409
**Success Criteria** (what must be TRUE):
  1. AI rewrite/draft/shorten/expand work in Lexical editor
  2. Stat without source is blocked at publish
  3. Cost cap per agency enforced via LiteLLM budget manager
  4. PII stripped from all LiteLLM calls
  5. AI content >70% triggers disclosure metadata; ratio computed per field with page-level sum
**Plans**: 6 plans

Plans:
- [ ] 07-01: LiteLLM gateway — per-agency cost caps, model routing
- [ ] 07-02: 20 editor AI features (draft, rewrite, shorten, expand, etc.)
- [ ] 07-03: Anti-fabrication guards — stat detector, quote detector, placeholder lint
- [ ] 07-04: Brand voice + glossary + banned phrases per agency
- [ ] 07-05: PII redactor before LLM calls
- [ ] 07-06: Prompt-injection protection — XML wrapping + jailbreak classifier

### Phase 8: Public Frontend + Page Tree
**Goal**: 12 agency Next.js apps live at their subdomains with ISR, image pipeline, RUM, WCAG, all P0 pages real and complete.
**Depends on**: Phase 5
**Requirements**: REQ-090, REQ-091, REQ-092, REQ-093, REQ-094, REQ-095, REQ-096, REQ-097, REQ-098
**Success Criteria** (what must be TRUE):
  1. All 12 agency sites load at their subdomains
  2. LCP < 1.8s desktop / < 2.2s mobile on all P0 pages (Lighthouse CI)
  3. CLS = 0 on all P0 pages
  4. axe-core: zero critical violations
  5. ISR purge propagates within 60s after content edit
  6. No `dangerouslyAllowSVG` anywhere on Next.js Image components
**Plans**: 7 plans

Plans:
- [ ] 08-01: Base Next.js app template (shared across all 12 agencies)
- [ ] 08-02: Per-agency app scaffold (12 apps, each with niche theme)
- [ ] 08-03: ISR + tag-based cache purge (Payload `afterChange` → `revalidateTag`)
- [ ] 08-04: Image pipeline — AVIF, WebP, BlurHash, art-directed `<picture>`
- [ ] 08-05: RUM script — web-vitals (LCP/INP/CLS), GA4 events
- [ ] 08-06: WCAG 2.2 AA + axe-core CI tests
- [ ] 08-07: All P0 pages per agency — home, about, services, blog, contact, etc.

### Phase 9: CRM + Forms + Booking + Lead Routing
**Goal**: Per-agency CRM, lead scoring, form builder, email engine (DKIM/SPF/DMARC), Cal.com self-hosted, Twilio SMS, niche pre-seeds.
**Depends on**: Phase 3 (parallel-safe with Phase 4–8 dataflow)
**Requirements**: REQ-100, REQ-101, REQ-102, REQ-103, REQ-104, REQ-105, REQ-106, REQ-107, REQ-108, REQ-109, REQ-110, REQ-111, REQ-112, REQ-113, REQ-114, REQ-302, REQ-303, REQ-403, REQ-404, REQ-405, REQ-414, REQ-417, REQ-420, REQ-423
**Success Criteria** (what must be TRUE):
  1. Form submit creates contact in CRM (test passes)
  2. 4h SLA timer starts on new lead (business hours)
  3. Booking creates CRM activity (Cal.com webhook)
  4. Email DKIM/SPF/DMARC validates in setup wizard
  5. All 12 agencies have pre-seeded CRM data (pipelines, templates, sequences)
  6. Stripe webhook idempotency holds (Redis event-ID dedupe)
**Plans**: 7 plans

Plans:
- [ ] 09-01: CRM core — contacts, accounts, deals, activities, tasks
- [ ] 09-02: Lead scoring (ICP 40% / behavior 35% / recency 15% / source 10%) + tagging + automation workflows
- [ ] 09-03: Form builder — all form types, spam protection, UTM capture
- [ ] 09-04: Email engine — DKIM/SPF/DMARC, sequences, BullMQ async; 35-day warm-up gate
- [ ] 09-05: Cal.com self-hosted integration + CRM sync (white-labeled per agency, 6 meeting types)
- [ ] 09-06: Twilio SMS — TCPA compliant, double opt-in (unchecked default), STOP keyword
- [ ] 09-07: Per-niche pre-seeded CRM data — pipelines, 30 tags, templates, 8 sequences/agency, multi-touch attribution

### Phase 10: Tools + Pitch + PDF + Builder
**Goal**: 36 tools (3/agency × 12), proposal builder with view tracking + e-sign, Stripe/PayPal invoicing, Puck visual builder scoped per agency.
**Depends on**: Phase 9
**Requirements**: REQ-120, REQ-121, REQ-122, REQ-123, REQ-124, REQ-125, REQ-126, REQ-127, REQ-128, REQ-129, REQ-130, REQ-131, REQ-132, REQ-133, REQ-134, REQ-401, REQ-402, REQ-406, REQ-413, REQ-418, REQ-419, REQ-422
**Success Criteria** (what must be TRUE):
  1. All 36 tools calculate correctly (math test vs. spreadsheet); deterministic, no LLM in math path
  2. Tool result PDF generates and emails; behind email gate → CRM hook
  3. Proposal sign → CRM Won → deposit invoice auto-sent
  4. Puck builder is auth-gated (server-side session check) and scoped per agency
  5. Invoice partial payment tracked in CRM with visible balance; chargeback evidence auto-compiled
  6. Tool result URLs are inline only (NOT separate indexed pages)
**Plans**: 7 plans

Plans:
- [ ] 10-01: Tool engine — calculator, benchmark datasets, result renderer
- [ ] 10-02: 36 tools built (3 per agency × 12) with real-source benchmarks (12-month expiry)
- [ ] 10-03: Tool content — full page per tool, 2200+ words, full SEO/AIO content
- [ ] 10-04: Proposal builder — hosted page, view tracking, 14-day expiry → grace → nurture
- [ ] 10-05: E-sign — ESIGN Act compliant, PDF generation, R2 vault storage, audit trail
- [ ] 10-06: Stripe + PayPal invoicing — dunning, partial payments, refunds, chargeback evidence
- [ ] 10-07: Puck visual builder — admin bar, meta panel, SEO score widget, server-side auth

### Phase 11: Analytics + Compliance + Security
**Goal**: GA4 + Clarity + Meta CAPI, per-agency dashboards, CCPA tooling, WAF, CSP nonce, OWASP scan clean.
**Depends on**: Phase 10
**Requirements**: REQ-140, REQ-141, REQ-142, REQ-143, REQ-144, REQ-145, REQ-146, REQ-147
**Success Criteria** (what must be TRUE):
  1. GA4 events flow for all P0 actions (server-side container)
  2. RUM dashboard shows LCP/INP/CLS per page
  3. OWASP ZAP scan: zero high-severity findings
  4. CSP headers present on all pages with per-request nonce
  5. CCPA erasure flow works end-to-end
**Plans**: 7 plans

Plans:
- [ ] 11-01: GA4 + GTM server-side container setup
- [ ] 11-02: Microsoft Clarity + heatmaps
- [ ] 11-03: Meta CAPI server-side
- [ ] 11-04: Analytics dashboards — per-agency + platform overview
- [ ] 11-05: CCPA / ADA compliance tooling — opt-out, deletion, export
- [ ] 11-06: WAF + Cloudflare security rules
- [ ] 11-07: Security hardening — CSP nonce, OWASP ZAP scan, pen test

### Phase 12: Launch + QA + Seeds + Runbooks + SLA
**Goal**: Full QA pass for all 12 agencies, complete seed run, canary deploy, all runbooks, SLA documented, Brand Setup Wizard ready.
**Depends on**: Phase 11
**Requirements**: REQ-150, REQ-151, REQ-152, REQ-153, REQ-154, REQ-155, REQ-156, REQ-157, REQ-415, REQ-416, REQ-504
**Success Criteria** (what must be TRUE):
  1. All QA checks pass for all 12 agencies
  2. All 12 agencies have 100% content coverage (real assets, validators pass)
  3. `gsd headless` exits 0 (pre-launch gate)
  4. Canary deploy executes 5% → health check → 100% without rollback
  5. Brand Setup Wizard documented and functional (logo + color + identity + API keys + DNS + warmup)
  6. ΔE check on brand color vs. pre-seeded imagery passes (niche guardrails)
**Plans**: 7 plans

Plans:
- [ ] 12-01: Full QA matrix — automated, all 12 agencies
- [ ] 12-02: Complete seed run — all 12 agencies, all content
- [ ] 12-03: Pre-launch CI gate — `gsd headless` exit 0 = pass
- [ ] 12-04: Canary deploy pipeline — 5% → health check → 100%, auto-rollback < 60s
- [ ] 12-05: All runbooks written (13 runbooks)
- [ ] 12-06: SLA documentation — public uptime 99.9%, admin 99.5%, RPO 1h, RTO 4h
- [ ] 12-07: Brand Setup Wizard — only user task post-generate

## Progress

**Execution Order:** Phases execute in numeric order (1 → 2 → 3 → … → 12), with explicit parallel-safe windows noted in dependency table above.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Infra | 0/6 | Not started | - |
| 2. Multi-tenant DB + Migration | 0/6 | Not started | - |
| 3. Auth + SSO + Edge Routing | 0/6 | Not started | - |
| 4. Design System + Theme Engine | 0/5 | Not started | - |
| 5. Central CMS + Block Library + Editor UX | 0/6 | Not started | - |
| 6. SEO/AIO/GEO Plugin Engine | 0/6 | Not started | - |
| 7. AI Assistant + Anti-Fabrication | 0/6 | Not started | - |
| 8. Public Frontend + Page Tree | 0/7 | Not started | - |
| 9. CRM + Forms + Booking | 0/7 | Not started | - |
| 10. Tools + Pitch + PDF + Builder | 0/7 | Not started | - |
| 11. Analytics + Compliance + Security | 0/7 | Not started | - |
| 12. Launch + QA + Seeds + Runbooks | 0/7 | Not started | - |
