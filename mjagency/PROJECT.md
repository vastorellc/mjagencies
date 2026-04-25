PROJECT: MJAgency Multi-Agency Platform
STATUS: All requirements locked. Ready for GSD-2 build.

==============================================================
WHAT THIS IS
==============================================================
Multi-agency SaaS platform.
Main brand at brand.com + 11 active agency subdomains.
All 11 agencies ACTIVE at launch. No MVP tiers.
US-only at v1.

Subdomains:
  ecommerce.brand.com
  growth.brand.com
  webdev.brand.com
  ai.brand.com
  branding.brand.com
  strategy.brand.com
  finance.brand.com
  engineering.brand.com
  product.brand.com
  video.brand.com
  graphic.brand.com

==============================================================
TECH STACK (LOCKED)
==============================================================
Framework:      Next.js 15 App Router
CMS:            Payload CMS 3.82.1 (PINNED - DO NOT UPGRADE)
Language:       TypeScript strict mode
Styling:        Tailwind CSS v4
Monorepo:       Turborepo + pnpm workspaces
Database:       PostgreSQL 17 + Drizzle ORM (per-agency DB)
Connection:     PgBouncer per agency, transaction mode, pool_size=20
Cache:          Redis (shared cluster, namespaced per agency)
Queue:          BullMQ 5.x (per-agency queue prefix)
Auth:           JWT (jose library ONLY - never jsonwebtoken) + refresh tokens
JWT lib:        jose (Web Crypto API compatible, works in Edge runtime)
AI Gateway:     LiteLLM
Builder:        Puck (open-source, MIT)
Rich Text:      Payload Lexical editor
Booking:        Cal.com (self-hosted)
Payments:       Stripe + PayPal
Email:          Postmark / SendGrid / SES (BYO)
SMS:            Twilio (BYO)
CDN:            Cloudflare (Images + Stream + R2 + Workers + WAF)
Observability:  OpenTelemetry + Prometheus + Loki + Grafana
Deployment:     VPS (self-hosted, PM2)
Node version:   22 LTS
Package mgr:    pnpm

==============================================================
ARCHITECTURE MODEL (LOCKED)
==============================================================
Payload 3 embedded inside Next.js via withPayload().
Single PM2 process per agency. One deployment unit per agency.
13 total Next.js+Payload instances (12 agencies + 1 main brand).
VPS minimum: 8GB RAM, 4GB swap.

Per-agency isolation:
- Separate PostgreSQL database per agency
- Separate PgBouncer per agency (port 6432..6444)
- Namespaced Redis keys: agency:<id>:cache:*, agency:<id>:bull:*
- RLS enforced at DB layer on all tables
- agency_id immutable after creation

Monorepo structure:
  apps/web-main/
  apps/web-ecommerce/
  apps/web-growth/
  apps/web-webdev/
  apps/web-ai/
  apps/web-branding/
  apps/web-strategy/
  apps/web-finance/
  apps/web-engineering/
  apps/web-product/
  apps/web-video/
  apps/web-graphic/
  packages/ui/
  packages/db/
  packages/config/
  packages/auth/
  packages/ai/
  packages/media/
  packages/cms/
  packages/crm/
  packages/email/
  packages/seo/
  packages/tools/
  packages/builder/
  packages/testing/
  scripts/seed/
  scripts/migrate/
  scripts/validate/

==============================================================
ROLES (3 TYPES LOCKED)
==============================================================
super_admin  - Global. All agencies. All powers.
admin        - Own agency only. Full power within agency.
editor       - Central CMS only. Scoped by editor_grants.

==============================================================
CONTENT-COMPLETE RULE (TOP PRIORITY)
==============================================================
ALL content must be authored DURING build phases, not post-launch.
Every page, every agency, every image slot = 100% complete at launch.
ONLY Brand Setup Wizard remains for user post-generate.
Zero TODO. Zero placeholder. Zero "Coming soon".
User does NOT author content after generation.

Pre-seeded at build:
- All blog posts (3+ cornerstone per agency)
- All service pages (3-5 per agency)
- All FAQ entries (10+ per agency)
- All tool pages with full content (36 tools total)
- All CRM email templates (10+ per agency)
- All CRM sequences (8 per agency)
- All proposal templates (2 per agency)
- All booking meeting descriptions
- All form copy (labels, tooltips, confirmations)
- All legal pages (Privacy, Terms, Cookie)
- All meta titles and descriptions
- All image slots (real photos + stock + AI-generated)
- All niche illustrations (30 per agency)
- All benchmark data for tools

Brand Setup Wizard (only user task):
- Logo upload (primary + symbol minimum)
- Brand color selection
- Brand identity fields (name, tagline, mission)
- API keys (Stripe, Cal.com, email provider)
- DNS pointing

==============================================================
AI MODEL ROUTING (LOCKED)
==============================================================
Tier 1 bulk:    gemini-2.5-flash-lite + gpt-4.1-nano
Tier 2 writing: claude-sonnet-4-6
Tier 2 research: gemini-2.5-pro
Tier 3 max:     claude-opus-4-6

GSD-2 model assignments:
  Planning (discuss/plan):     Opus
  Architecture milestones:     Opus (M001-M003)
  Execution milestones:        Sonnet (M004-M012)
  Research tasks:              Flash-Lite
  Content drafting tasks:      Flash-Lite

==============================================================
12 MILESTONES (LOCKED)
==============================================================
M001 - Foundation + Infra
M002 - Multi-tenant DB + Migration Orchestrator
M003 - Auth + SSO + Edge Routing
M004 - Design System + Theme Engine
M005 - Central CMS + Block Library + Editor UX
M006 - SEO/AIO/GEO Plugin Engine
M007 - AI Assistant + Anti-Fabrication
M008 - Public Frontend + Page Tree (12 agency apps)
M009 - CRM + Forms + Booking + Lead Routing
M010 - Tools Catalog + Pitch + PDF + Visual Builder
M011 - Analytics + RUM + Compliance + Security Hardening
M012 - Launch + QA + Seeds + Runbooks + SLA

==============================================================
KEY CONSTRAINTS
==============================================================
- Payload CMS: EXACTLY 3.82.1 (pinned, never upgrade without explicit order)
- JWT library: ONLY jose (never jsonwebtoken - Edge runtime incompatible)
- Next.js version: >=15.2.3 (CVE-2025-29927 patch required)
- Yjs collaboration: Deferred to v2 (single-user builder at v1)
- Cloudflare middleware: EXCLUDE /(payload)/admin/* and /api/* routes
- Server actions: MUST verify session as first line (see CLAUDE.md)
- Stock API keys: Server-side proxy only, NEVER exposed to browser
- No dangerouslyAllowSVG globally on Next.js Image component
