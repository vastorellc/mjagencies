# Phase 12: Launch + QA + Seeds + Runbooks + SLA — Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Full QA pass for all 12 agencies, complete seed run, canary deploy, all runbooks, SLA documented, Brand Setup Wizard ready.

**Requirements:** REQ-150, REQ-151, REQ-152, REQ-153, REQ-154, REQ-155, REQ-156, REQ-157, REQ-415, REQ-416, REQ-504

**Success Criteria:**
1. All QA checks pass for all 12 agencies
2. All 12 agencies have 100% content coverage (real assets, validators pass)
3. `gsd headless` exits 0 (pre-launch gate)
4. Canary deploy executes 5% → health check → 100% without rollback
5. Brand Setup Wizard documented and functional (logo + color + identity + API keys + DNS + warmup)
6. ΔE check on brand color vs. pre-seeded imagery passes (niche guardrails)

</domain>

<decisions>
## Implementation Decisions

### D-01: QA Matrix Strategy
Automated Vitest + Playwright E2E per agency. Each agency gets a per-agency test suite that validates: auth flows, public pages (home/service/tool/privacy), form submissions, CRM lead creation, booking flow. All 12 agencies run in parallel via turborepo `turbo test`.

### D-02: Seed Run Completeness
Seed run covers: all Payload collections (pages, services, tools, team members, testimonials, FAQs, blog posts, case studies), per-agency CRM pre-seeds (leads, deals, contacts), niche-specific benchmark datasets (Phase 9 reuse). Must pass MIN_WORD_COUNT=2200 on all long-form content.

### D-03: Pre-launch CI Gate
`gsd headless` script wraps: TypeScript compile (tsc --noEmit), all Vitest tests (unit + integration), Playwright smoke tests (5 critical paths per agency), axe-core WCAG AA, OWASP ZAP passive scan, Lighthouse CI (LCP < 2.5s, CLS < 0.1, FID < 100ms), and CSP static grep gate. Exit 0 = all green.

### D-04: Canary Deploy Pipeline
GitHub Actions workflow: build → tag → deploy 5% traffic weight → 30s health check (HTTP 200 on /api/health per agency) → if pass auto-promote 100% → if fail auto-rollback. Rollback SLA < 60s. Uses Cloudflare Workers weighted routing or Vercel canary deployments.

### D-05: Runbooks
13 runbooks (1 per agency subdomain + 1 platform/ops): incident response, DB failover, Redis flush procedure, Cloudflare WAF rule toggle, CCPA erasure manual trigger, GA4 data deletion follow-up, Payload CMS backup/restore, DNS cutover checklist, Doppler secrets rotation, Stripe webhook re-delivery, BullMQ queue drain, SSL certificate renewal, Brand Setup Wizard walkthrough.

### D-06: SLA Documentation
Public-facing SLA page at /sla on brand.com: 99.9% uptime (4.38h/yr), admin dashboard 99.5%, RPO = 1h (last backup), RTO = 4h. Documents: incident severity matrix, escalation contacts, maintenance window policy (Sundays 02:00-04:00 UTC), credits policy.

### D-07: Brand Setup Wizard
Single-page admin wizard in Payload admin at /admin/brand-setup. Steps: (1) Logo upload + DOMPurify SVG sanitize, (2) Brand color picker + ΔE guardrail check vs. seeded imagery, (3) Identity fields (tagline, about, phone, address), (4) API keys (GA4, Clarity, Meta Pixel), (5) DNS + warmup checklist. Gated: requires super_admin role.

### Claude's Discretion
All remaining implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

- 12 agency apps (web-ai, web-branding, web-construction, web-dental, web-ecommerce, web-financial, web-fitness, web-homeservices, web-legal, web-realestate, web-restaurant, web-spa) + web-main
- packages/compliance: 7-system CCPA erasure fan-out complete (Phase 11)
- packages/analytics: GA4 + Clarity + Meta CAPI complete (Phase 11)
- packages/db: Drizzle schema with all collections + RLS (Phases 2-11)
- All 132 P0 page routes live (Phase 8)
- Puck builder + e-sign + invoicing complete (Phase 10)
- Phase 11 deferred items for Phase 12 QA: live payload migrate, ZAP vs live target, receipt PDF + R2 smoke test

Codebase context will be supplemented during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

- QA matrix must include Phase 11 deferred E2E items: 7-system CCPA erasure fan-out, GA4 through sGTM, RUM dashboard with real traffic data
- Brand Setup Wizard ΔE check: use deltaE (CIEDE2000) npm package, compare logo color vs. seeded hero images; warn if ΔE < 30 (too similar = niche brand confusion risk)
- Canary pipeline must respect Cloudflare WAF state — do not toggle to enforcing mode during canary window
- All 13 runbooks must be in docs/runbooks/ (Clarity runbook already exists from Phase 11)

</specifics>

<deferred>
## Deferred Ideas

- Phase 13 (if it exists): Post-launch monitoring, v2 roadmap items
- Yjs real-time collaboration (deferred to v2 from Phase 1)
- Advanced ΔE batch checks across full asset library (Phase 12 only covers brand color vs. seeded hero)

</deferred>
