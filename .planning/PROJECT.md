# MJAgency — Multi-Agency Platform

## What This Is

A multi-agency SaaS platform: brand.com plus 11 active agency subdomains (ecommerce, growth, webdev, ai, branding, strategy, finance, engineering, product, video, graphic). All 11 agencies go live simultaneously at v1 launch — no MVP tiers. US-only. Built on Next.js 15 + Payload CMS 3.82.1 (embedded), per-agency Postgres isolation, Turborepo monorepo.

## Core Value

Every page, every agency, every image slot is 100% real and complete the moment the platform launches — zero placeholders, zero "Coming soon", zero TODOs. The only post-generate user task is the Brand Setup Wizard.

## Requirements

See `.planning/REQUIREMENTS.md` for the full traceable list (REQ-001…REQ-507). Source of truth: `mjagency/REQUIREMENTS.md`.

### Validated

(None yet — pre-build)

### Active

All v1 requirements REQ-001 through REQ-507 mapped across 12 milestones (Phases 1–12 in ROADMAP.md).

### Out of Scope

- **Yjs real-time collaboration** — deferred to v2 (single-user builder at v1)
- **International / non-US** — US-only at v1, regional expansion deferred
- **Video posts on user-generated content streams** — n/a, this is a CMS platform
- **Payload CMS upgrades past 3.82.1** — pinned exactly; never upgrade without explicit human approval
- **`jsonwebtoken` library anywhere in the codebase** — incompatible with Edge runtime; `jose` only
- **Cloudflare middleware over `/(payload)/admin/*` and `/api/*`** — explicitly excluded from matcher
- **Mobile-native apps** — web-first, mobile deferred

## Context

- **Stack is locked.** Next.js 15 App Router, Payload 3.82.1 embedded via `withPayload()`, TypeScript strict, Tailwind v4, Drizzle ORM, PgBouncer per agency (transaction mode, pool_size=20), Redis (namespaced per agency), BullMQ 5.x, LiteLLM gateway, Puck builder (MIT), Cal.com self-hosted, Stripe + PayPal, Cloudflare (Images, Stream, R2, Workers, WAF), OpenTelemetry/Prometheus/Loki/Grafana, Doppler for secrets, PM2 cluster, Node 22 LTS, pnpm.
- **13 deployment units.** 12 agency apps + 1 main brand. One Next.js+Payload PM2 process per agency. VPS minimum 8GB RAM + 4GB swap.
- **Per-agency isolation.** Separate PostgreSQL DB, separate PgBouncer (ports 6432–6444), namespaced Redis keys (`agency:<id>:cache:*`, `agency:<id>:bull:*`), RLS at DB layer on every agency-scoped table, `agency_id` immutable after creation.
- **3 roles only.** `super_admin` (global), `admin` (own agency), `editor` (central CMS, scoped by `editor_grants`).
- **Content-Complete Rule (top priority).** All blog posts (3+ cornerstone per agency), service pages (3–5/agency), FAQ (10+/agency), 36 tool pages, CRM templates (10+/agency), 8 sequences/agency, proposal templates, meeting descriptions, form copy, legal pages, meta tags, image slots, niche illustrations (30/agency), benchmark data — every piece authored DURING build, never post-launch.
- **Brand Setup Wizard** is the ONLY thing the user does after generation: logo upload, brand color, identity fields, API keys, DNS pointing.
- **AI model routing.** Tier 1 bulk (gemini-2.5-flash-lite + gpt-4.1-nano), Tier 2 writing (claude-sonnet-4-6), Tier 2 research (gemini-2.5-pro), Tier 3 max (claude-opus-4-6). Planning + M001–M003 architecture: Opus. M004–M012 execution: Sonnet. Research/content drafting: Flash-Lite.
- **Agent rules** in `mjagency/CLAUDE.md` (read first, every session). Routing in `mjagency/AGENTS.md`.

## Constraints

- **Tech (LOCKED — Payload):** EXACTLY `payload@3.82.1` in every `package.json` (no `^`, no `~`). CI gate: `pnpm list payload | grep 3.82.1 || exit 1`.
- **Tech (LOCKED — JWT):** `jose` library only. `jsonwebtoken` is incompatible with Next.js Edge runtime. CI gate: `grep jsonwebtoken` must return zero results.
- **Tech (LOCKED — Next.js):** `>= 15.2.3` (CVE-2025-29927 patch).
- **Security — server actions:** every server action must verify session as the FIRST line. Middleware alone is insufficient.
- **Security — secrets:** never `NEXT_PUBLIC_` prefix. Stock API keys server-side proxy only. Doppler injection at build/deploy.
- **Security — webhooks:** HMAC verification mandatory; Stripe uses raw `req.text()` for signature.
- **Security — SVG:** every upload sanitized via DOMPurify (server-side jsdom) + SVGO. No `dangerouslyAllowSVG` on Next.js Image.
- **Performance:** LCP < 1.8s desktop / < 2.2s mobile on all P0 pages. CLS = 0. ISR purge < 60s after publish. Theme switch < 16ms. axe-core: zero critical violations.
- **Compliance:** WCAG 2.2 AA, CCPA opt-out + erasure flow, ESIGN Act for B2B contracts, TCPA double opt-in for SMS, FTC 2023 testimonial disclaimer, AI disclosure when content >70% AI-generated.
- **Infra:** VPS self-hosted, 8GB RAM minimum, PM2 cluster mode, OTel traces flowing to Grafana Tempo, hourly WAL + snapshots to R2 with quarterly DR.
- **SLA:** Public uptime 99.9%/month, admin 99.5%/month, RPO 1h, RTO 4h, lead first-response 4h business hours.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Payload 3.82.1 pinned exactly | Avoid breaking changes mid-build; multi-tenant CMS surface is wide | — Pending |
| `jose` only for JWT | Edge runtime compatibility; `jsonwebtoken` doesn't work in middleware | — Pending |
| Embedded Payload (withPayload) over standalone | Single deployment unit per agency, shared session/auth surface | — Pending |
| Per-agency Postgres + PgBouncer (not row-level only) | Strong isolation, blast-radius containment, easier per-tenant backup/restore | — Pending |
| All 11 agencies live at launch (no MVP tiers) | Brand promise; partial launch undermines positioning | — Pending |
| Content-Complete at build time | User authoring post-launch is the failure mode this product is preventing | — Pending |
| Puck (MIT) for visual builder | Open-source, scoped per agency, JSON output (no `dangerouslySetInnerHTML`) | — Pending |
| Cal.com self-hosted, white-labeled per agency | Bookings owned, no per-seat SaaS cost across 12 agencies | — Pending |
| LiteLLM as single AI gateway | Per-agency cost caps, model routing, PII redaction in one place | — Pending |
| Cloudflare (Images + Stream + R2 + Workers + WAF) | Single CDN/edge stack; R2 egress-free for media | — Pending |
| Doppler for secrets (per-agency project + shared project) | Per-tenant rotation, CI injection, no `.env` sprawl | — Pending |
| Yjs real-time collaboration deferred to v2 | Single-user builder is sufficient for v1; Yjs adds complexity to RLS/auth | — Pending |
| Git branch per milestone, squash to main on complete | Milestone-level rollback unit; squashed history stays readable | — Pending |

---
*Last updated: 2026-04-25 after `.planning/` bootstrap from `mjagency/` GSD-2 docs*
