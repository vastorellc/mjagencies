MJAgency — GSD-2 Architecture Package
======================================
Multi-agency SaaS platform: brand.com + 11 agency subdomains.
All 11 agencies ACTIVE at launch. US-only. Built with GSD-2.

HOW TO START
============
1. Install GSD-2: npm install -g gsd-2
2. In this directory: gsd
3. On first run: configure Anthropic API key + model profiles (see specs/gsd-config.md)
4. Start first milestone: gsd new-milestone (select M001)
5. GSD-2 reads PROJECT.md + CLAUDE.md automatically on every session

CRITICAL RULES (read before anything else)
==========================================
- Read CLAUDE.md first — contains non-negotiable coding rules
- Payload CMS: EXACTLY version 3.82.1 (pinned, never upgrade)
- JWT: use ONLY the 'jose' library (never jsonwebtoken)
- Every server action: session check as first line
- Zero placeholder content — everything real at launch

FILE STRUCTURE
==============
README.md              You are here
PROJECT.md             Big picture: stack, agencies, architecture, constraints
CLAUDE.md              Agent rules: coding standards, security patterns, anti-fab rules
AGENTS.md              GSD-2 agent routing and model assignments per task type
ROADMAP.md             12 milestones with slices, success criteria, dependency DAG
REQUIREMENTS.md        310 traceable requirements mapped to milestones

specs/
  architecture.md      DB, Redis, API, auth, Cloudflare, OTel, local dev
  security.md          All 111 security fixes, testing plan, incident response
  cms.md               Payload 3.82.1, 45 blocks, Lexical editor, DAM, Puck builder
  crm.md               CRM, forms, booking, pitch, invoicing, email, chatbot
  content.md           Content strategy, word floors, SEO/AIO/GEO, niche ICPs
  media.md             Media catalog, image pipeline, illustrations, icons, video
  tools.md             36 tools, benchmark sources, calculation engine, embeds
  analytics.md         GA4, RUM, dashboards, compliance, cost tracking, SLA
  gsd-config.md        GSD-2 setup, model profiles, content sprint, Iron Rule
  milestone-M001.txt   Foundation + Infra (slices + tasks + success criteria)
  milestone-M002.txt   Multi-tenant DB + Migration (full Drizzle schema)
  milestone-M003.txt   Auth + SSO + Edge Routing
  milestone-M004.txt   Design System + Theme Engine
  milestone-M005.txt   CMS + Blocks + Editor UX
  milestone-M006.txt   SEO/AIO/GEO Plugin Engine
  milestone-M007.txt   AI Assistant + Anti-Fabrication
  milestone-M008.txt   Public Frontend + Page Tree
  milestone-M009.txt   CRM + Forms + Booking + Lead Routing
  milestone-M010.txt   Tools + Pitch + PDF + Visual Builder
  milestone-M011.txt   Analytics + Compliance + Security Hardening
  milestone-M012.txt   Launch + QA + Seeds + Runbooks + SLA

scripts/
  validate.sh          Pre-launch CI validation script (called by gsd headless)
  seed-plan.md         Complete seed execution plan + Brand Setup Wizard steps

docs/
  README.md            What gets written here in M012
  runbooks/README.md   13 operational runbooks (written in M012)

MILESTONE BUILD ORDER
=====================
M001 -> M002 -> M003 -> M004 -> M005 -> M006+M007 (parallel) -> M008
                      -> M009 -> M010 -> M011 -> M012

Content sprint: parallel workstream starting after M005 slice 1.2

STACK SUMMARY
=============
Next.js 15 + Payload CMS 3.82.1 (embedded via withPayload)
TypeScript strict + Tailwind CSS v4 + Turborepo + pnpm
PostgreSQL 17 + Drizzle ORM (per-agency DB) + PgBouncer
Redis (shared, namespaced) + BullMQ 5.x
Auth: jose JWT only + refresh token rotation
AI: LiteLLM gateway (Opus/Sonnet/Flash-Lite routing)
Builder: Puck (MIT, open-source)
Booking: Cal.com (self-hosted)
Payments: Stripe + PayPal
CDN: Cloudflare (Images + Stream + R2 + Workers + WAF)
VPS: PM2, 13 processes, 8GB RAM minimum

IMPORTANT — TWO NEW SPEC FILES ADDED:
  specs/website-ui.md    - Complete website UI + page anatomy for all 12 agencies
                           Covers: homepage 13 sections, service page, blog layout,
                           FAQ, about, contact, pricing, tools list, 404/500,
                           mega menu, navigation, advanced UI animations,
                           agency-specific visual differentiation (all 12)
  specs/admin-ui.md      - Complete admin panel UI for all roles
                           Covers: admin navigation, dashboard, content editor,
                           DAM, CRM views, tool manager, proposal/invoice/e-sign,
                           settings, Brand Setup Wizard, Cmd+K search,
                           notifications, keyboard shortcuts, audit trail
