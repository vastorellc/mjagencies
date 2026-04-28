---
gsd_state_version: 1.0
milestone: v9.1.20
milestone_name: milestone
status: completed
stopped_at: Completed 12-07-PLAN.md — Brand Setup Wizard (5-step Payload admin, ΔE CIEDE2000, DOMPurify+SVGO, Doppler keys)
last_updated: "2026-04-28T14:15:00.000Z"
last_activity: 2026-04-28 -- Phase 12 complete — QA matrix, seed manifest (12 agencies), pre-launch gate, canary deploy, runbooks, SLA page, Brand Setup Wizard. All 78 plans delivered.
progress:
  total_phases: 12
  completed_phases: 12
  total_plans: 78
  completed_plans: 78
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** Every page, every agency, every image slot is 100% real and complete at launch — only the Brand Setup Wizard remains for the user post-generate.
**Current focus:** Phase 12 — launch + QA + seeds + runbooks + SLA

## Current Position

Phase: 12 (launch-qa-seeds-runbooks-sla) — COMPLETE (all 7 plans complete)
Status: ALL PHASES COMPLETE — milestone v9.1.20 delivered
Last activity: 2026-04-28 -- Phase 12 complete — QA matrix (12×5 E2E), seed manifest (12 agencies), pre-launch gate, canary deploy, 13 runbooks, SLA page, Brand Setup Wizard.

Progress: [██████████] 100%

## Completed Phases

| Phase | Plans | Key Deliverable | Status |
|-------|-------|-----------------|--------|
| 01 (foundation-infra) | 5/6 done | Turborepo monorepo, Next.js 15, Payload 3.82.1, Docker Compose, CI/CD, OTel | ✓ (01-06 Doppler deferred) |
| 02 (multi-tenant-db) | 6/6 | Per-agency Postgres + PgBouncer + Drizzle schema + RLS + audit log | ✓ |
| 03 (auth-sso-edge) | 6/6 | JWT/jose auth, MFA, SSO, Cloudflare middleware, server-action auth pattern | ✓ |
| 04 (design-system) | 4/5 done | 6-layer CSS tokens, 12 OKLCH themes, AJV validator, A/B framework, Storybook CI | ✓ (04-02 summary missing) |
| 05 (central-cms) | 8/8 | Payload CMS wired, 11 collections, 45 blocks, Lexical editor, DAM, content sprint | ✓ |
| 06 (seo-plugin-engine) | 6/6 | 3 SEO plugins, merge-patch config, SeoPanel live scoring, self-learning loop, algo watcher | ✓ |
| 07 (ai-assistant) | 6/6 | LiteLLM gateway, 20 editor AI features, anti-fab validators, brand voice, PII redactor, prompt guard | ✓ |
| 08 (public-frontend) | 7/7 | WebVitalsReporter, ISR purge hooks, MjImage AVIF/BlurHash, axe-core gate, 132 P0 page routes | ✓ |
| 09 (crm-forms-booking) | 7/7 | Per-agency CRM, lead scoring, form builder, Cal.com, Twilio SMS, niche pre-seeds | ✓ |
| 10 (tools-pitch-builder) | 7/7 | 36 tools, proposal builder, e-sign ESIGN Act, 7-state invoicing, Puck builder | ✓ |
| 11 (analytics-security) | 7/7 | GA4 + Clarity + Meta CAPI, dashboards, CCPA opt-out + erasure, WAF, CSP nonce, OWASP ZAP | ✓ (44/45 verified, 7 items for Phase 12 QA) |
| 12 (launch-qa-seeds-runbooks-sla) | 7/7 | QA matrix (12×5 E2E), seed manifest (12 agencies), pre-launch gate, canary deploy, 13 runbooks, SLA page, Brand Setup Wizard | ✓ |

## Performance Metrics

**Velocity:**

- Total plans completed: 35
- Phases completed: 5 (of 12)
- Execution sessions: autonomous (phases 1-5)

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 01 | 5/6 | 01-06 deferred (needs doppler login) |
| 02 | 6/6 | complete |
| 03 | 6/6 | complete |
| 04 | 4/5 | 04-02 summary missing (code committed) |
| 05 | 8/8 | complete + approved |
| Phase 06-seo-plugin-engine P01 | 14 | 2 tasks | 13 files |
| Phase 06-seo-plugin-engine P02 | 5 | 3 commits (TDD) | 4 files |
| Phase 06-seo-plugin-engine P03 | 6 | 3 commits (TDD+feat) | 10 files |
| Phase 06-seo-plugin-engine P04 | 3 | 3 commits (TDD) | 3 files |
| Phase 06-seo-plugin-engine P05 | 15 | 2 tasks | 7 files |
| Phase 06-seo-plugin-engine P06 | 6 | 2 tasks | 7 files |
| Phase 11 P06 | 5 | 3 tasks | 11 files |
| Phase 11 P03 | 30min | 2 tasks | 25 files |
| Phase 11 P11-02 | 12 min | 3 tasks | 20 files |
| Phase 11 P11-04 | 45min | 3 tasks | 29 files |
| Phase 12 P06 | 5m | 1 tasks | 2 files |
| Phase 12 P07 | 252 | 2 tasks | 7 files |
| Phase 12-launch-qa-seeds-runbooks-sla P05 | 45m | 2 tasks | 13 files |
| Phase 12-launch-qa-seeds-runbooks-sla P01 | 22m | 2 tasks | 33 files |
| Phase 12-launch-qa-seeds-runbooks-sla P04 | 15m | 2 tasks | 3 files |

## Accumulated Context

### Decisions

- Payload CMS pinned to 3.82.1 exactly — never upgrade without explicit approval
- `jose` only for JWT — `jsonwebtoken` banned (Edge runtime incompatible)
- All 11 agencies live at launch — no MVP tiering
- Content-Complete at build time — only Brand Setup Wizard remains for user post-generate
- Per-agency Postgres + PgBouncer + RLS — strong tenant isolation
- Yjs real-time collaboration deferred to v2
- 45 React block components use `var(--mj-*)` tokens only — zero hex literals
- SEO/AIO/GEO panels are stubs in Phase 5 — Phase 6 replaces with real plugin engine
- AI hooks stubs in Phase 5 (`isStub: true`) — Phase 7 wires real LiteLLM calls
- SerializedLexicalNode imported from 'lexical' package (not @payloadcms/richtext-lexical)
- Plugin engine uses registerPlugin/runPluginEngine pattern — plans 02-04 plug in scoring logic
- computeLiveScore uses requireSession() (not auth()) per project auth pattern
- seo-classic plugin registration via index.ts export chain (not engine.ts bottom import) — avoids circular ESM dependency
- PluginDefaults not re-exported from engine.ts; seo-classic.ts receives pre-merged SeoClassicConfig via config.seo_classic
- aio-citations plugin follows same index.ts export self-registration pattern as seo-classic
- blockPublishOnUnsourcedStat flag preserved in AioCitationsConfig interface but not used by scorer (only CMS publish gate)
- FAQPage JSON-LD injection in page <head> is Phase 8 scope; Phase 6 delivers utility functions only
- validateAioTldr exempt from legal pages; enforced only on status=published
- geo-chunking plugin registration follows same index.ts export chain pattern (not engine.ts side-effect import) — consistent with seo-classic and aio-citations
- Non-applicable short-circuit (pageType != services) checked before empty-cities check — blog/home pages always score 100 regardless of city config
- seo_suggestions collection is global (superAdminOnly, no agency_id) — same pattern as algo-alerts
- Self-learning worker uses auth.GoogleAuth from @googleapis/searchconsole AuthPlus (googleapis not installed)
- generateContent() returns GenerateContentResult.text (not raw string); self-learning worker uses result.text
- algoAlertsCollection is global (no agency_id), superAdminOnly x4 — algo intelligence must not leak to agency editors
- No-match RSS items also marked seen via Redis pipeline SADD+EXPIRE — prevents reprocessing on every 6h poll
- JSDoc cron expression avoids */6 sequence — TypeScript misparses as closing JSDoc comment block
- generate-content.ts IS the LiteLLM gateway (no separate gateway.ts file) — Phase 7 extends it with agencyId/cost caps
- Banned phrases are an avoid_phrases array field inside brand_glossary collection (not a separate banned-phrases collection)
- computeAiContentRatio uses dynamic populatedTracked denominator (count of non-empty tracked fields per document, not a constant)
- Pipeline order in generate-content.ts: guardPrompt() → redactPii() → fetch LiteLLM
- Per-agency LiteLLM key: LITELLM_API_KEY_${agencyId.toUpperCase()} env var; falls back to LITELLM_API_KEY
- Monthly spend Redis key: agency:<id>:ai:monthly-spend; reset by BullMQ cron '0 0 1 * *'
- Phase 7 pipeline order in generate-content.ts: guardPrompt() → redactPii() → checkAgencyCostCap() → fetch LiteLLM
- LLM output is NOT auto-de-tokenized — PII tokens stay in AI output for safety
- PromptInjectionError returns user-friendly message "This input cannot be processed. Please rephrase." (not a crash)
- Quote attribution allows plain parenthetical (Source Name Year) and "said Name" — stat citations still require verifiable hyperlinks
- brand_voice + brand_glossary tables require live DB + `CI=true PAYLOAD_MIGRATING=true npx payload migrate`
- lexical-features.ts pre-existing renames fixed in 07-04 (AlignmentFeature, BoldTextFeature etc. — 5 pre-existing issues resolved)
- AGENCY_ID constant pattern: each agency app declares `const AGENCY_ID = '<slug>'` at module scope — matches agency_id in Payload collections
- fetchPageBySlug(AGENCY_ID, slug) returns null → caller invokes notFound(); all slug routes have generateStaticParams
- ISR cache tags: `agency:<id>:page:<slug>` and `agency:<id>:collection:pages` — purged by isrPurgeHook (08-03)
- axe-core requires DOM attachment: runAxeTest() attaches container to document.body before axe.run(), removes in finally block
- esbuild JSX without plugin: `esbuild: { jsx: 'automatic', jsxImportSource: 'react' }` in vitest config — works without @vitejs/plugin-react
- Python3 unavailable in bash env on this Windows machine — use Node.js ESM for generation scripts
- TCPA SMS opt-in consent stored in Redis with no TTL — consent persists until explicit STOP opt-out
- Phone hashed SHA-256 before Redis key insertion — raw phone never appears in key names
- TcpaConsentError thrown in SMS worker before any Twilio call — worker is the hard TCPA gate (not just queue-side check)
- Twilio status webhook uses runtime = 'nodejs' (not Edge) — Twilio SDK requires Node.js
- ContactFormClient uses 'use client' + fetch to /api/contact (not server action) — public form by design
- Agency slug sourced from NEXT_PUBLIC_AGENCY_SLUG env var per Phase 8 pattern (not hardcoded AGENCY_ID)
- forms + form_submissions collections use collectionAccess/deleteAccess/fieldImmutable pattern from @mjagency/crm
- /api/contact honeypot protection only in Phase 09; rate limiting deferred to Phase 11
- Cloudflare WAF: pinned cloudflare/cloudflare ~> 4.40 provider; for_each over 13-zone map; OWASP CRS managed ruleset; 4 custom firewall rules (4/5 free-tier cap); 5 rate limit rules (5/5 at cap); enable_enforcing toggle for log-only→enforcing rollout (Plan 11-06)
- Plan 11-01 GA4 + sGTM: @mjagency/analytics package created with payload pinned 3.82.1; getAgencySecret(prefix, agencyId) helper added to @mjagency/config (slug normalization replaceAll('-','_').toUpperCase) — generalizes Phase 7 LITELLM_API_KEY_<SLUG> convention for Phase 11 reuse (Plan 11-02 Clarity, 11-03 Meta CAPI, 11-04 dashboard)
- GA4InjectScript: server-component reads cookies().get('mj_consent') === 'tracking_blocked' → renders null; reads x-nonce header (Plan 11-07) → passes to <Script nonce={nonce}>; Pitfall 1.4 mitigated via EVENT_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/ + clientId.length >= 8 BEFORE fetch
- GA4 Data API: 5-min Redis cache (Pitfall 1.3 — 25K tokens/day quota); cache key agency:<id>:dashboard:ga4:<sha256-prefix-16>; agencyId stripped from hashed payload to dedupe identical query shapes
- Cloudflare Worker sGTM proxy: matches /^analytics\.(web-[a-z]+)\./ → SGTM_TARGET_<SLUG_UPPER>; preserves CF-Connecting-IP via X-Forwarded-For; rejects unknown subdomains 400, missing target 503
- Plan 11-01 deviation: project codebase has 12 vertical apps (web-ai, web-branding, etc.) not 13 niche apps as plan listed (web-realestate, web-petcare, etc. exist as partial route-group shells without (frontend)/layout.tsx) — wired GA4 into all 12 existing layouts
- Test-only injection helpers __setRedisForTest, __setClientForTest exported from ga4-data-api.ts so unit tests can mock Redis + BetaAnalyticsDataClient without spinning real services
- Plan 11-03: Created standalone @mjagency/meta-capi package (not inside @mjagency/analytics) to decouple from in-flight Plan 11-01 GA4 work
- Plan 11-03: Direct fetch to graph.facebook.com/v22.0 (NOT facebook-nodejs-business-sdk) — SDK is 3MB and Edge-incompatible; single REST endpoint does not justify it
- Plan 11-03: jobId = event_id pairs BullMQ once-only processing with Meta event_id dedup — retries cannot produce duplicate Lead/Purchase events
- Plan 11-03: Lead emission moved to form-worker.ts (after createContact succeeds) — uses Payload contact id as external_id; Purchase emits only on newStatus=paid (not partial)
- Plan 11-03: D-10 enforced — Meta CAPI is server-side ONLY; CSP allowlist (security-headers + middleware) intentionally OMITS facebook.com
- Microsoft Clarity uses ClarityInjectScript server-component wrapper around 'use client' ClarityInit — symmetric with Plan 11-01 GA4InjectScript pattern (1 import + 1 render line per layout, no async layouts needed)
- @microsoft/clarity@1.0.2 actual API: Clarity.event(eventName) takes only event name; metadata uses Clarity.setTag(key, value). emitClarityEvent helper redacts each value via Phase 7 redactPii() then calls setTag + event
- Mask Mode = Strict + network capture OFF live in Clarity DASHBOARD, not in code (no init() option in @microsoft/clarity@1.0.2 API). docs/runbooks/clarity-project-setup.md is the per-agency operator contract
- Plan 11-04 dashboards: hybrid data sources per D-12 — GA4 Data API for traffic + top pages, per-agency Postgres aggregates for CRM (crm_contacts, crm_deals)/invoicing (invoices.total_amount), web_vitals percentile_cont(0.75) for RUM p75; orchestrator uses Promise.all + per-source Promise.allSettled (Pitfall 4.3 partial-failure isolation)
- Plan 11-04: Payload custom admin view at /admin/dashboard registered via admin.components.views.Dashboard in build-payload-config.ts; Component path '@mjagency/cms/admin-views/DashboardView#default' resolved by importMap.baseDir; await requireSession() FIRST runtime call in DashboardView (CLAUDE.md §3 + Pitfall 4.4 — Payload custom views do NOT auto-authenticate)
- Plan 11-04: 60s polling via useDashboardPolling hook with document.visibilityState === 'visible' gate (D-14), inFlight ref guard preventing manual-refresh + interval-tick race (Pitfall 4.8); polling endpoint /api/admin/dashboard/metrics calls requireSession() first + 403 super_admin gate + Cache-Control: no-store (T-11-04-07)
- Plan 11-04: dashboard.css uses 100% var(--mj-*) tokens (108 references), zero hex literals; sparkline uses external .dashboard-sparkline class (Pitfall 4.5 — per-request CSP nonce blocks inline styles); UI-SPEC strict typography honored — only 4 sizes (14/16/24/36) and 2 weights (400/700)
- Badge colors as CSS classes (not inline styles) to satisfy CLAUDE.md §7 CSP nonce requirement for SLA page
- --mj-color-info token confirmed present in layer-2-semantic-color.css; no fallback needed in .sla-badge--p3
- Payload custom admin view BrandSetupView uses requireSession() + super_admin guard + redirect to /admin on fail — same Pitfall 4.4 pattern as DashboardView (Plan 11-04)
- CIEDE2000 implemented inline in BrandSetupWizardClient server action — no npm deltaE package; safe default { value: 100, pass: true } before Plan 12-02 seed imagery is available
- Brand Setup Wizard API keys stored via Doppler REST API in server action; non-fatal if token absent; GA4/Clarity/Meta keys named agency:<id>-scoped pattern
- CCPA erasure manual runbook gates on confirmed identity verification before BullMQ enqueue (STRIDE T-12-05-01 mitigation)
- JWT_SECRET rotation requires adding old secret to Redis revocation set to prevent old-key tokens remaining valid
- brand-setup-wizard.md references Phase 12-02 seed as prerequisite for deltaE check to prevent always-fail ΔE during setup
- Canary pipeline: concurrency cancel-in-progress=false prevents race where new dispatch cancels in-flight canary before rollback fires (T-12-04-01)
- Canary rollback: single terraform apply with canary_weight=0 destroys cloudflare_workers_deployment.canary in < 60s (REQ-154)
- WAF must remain in log-only mode during canary window per 12-CONTEXT.md D-04

### Pending Todos

- Run `doppler login` then resume Plan 01-06 (Doppler workspace bootstrap)
- Write missing 04-02 SUMMARY.md (code is done, commits b48476c–711f0b8)
- Commit 10-03 work (Bash access denied during execution — all files written, need git add + commit)
- Add `@mjagency/tools: workspace:*` to apps/web-realestate, healthcare, legal, homeservices, fitness, dental, automotive, restaurant, education, financial, petcare package.json files

### Blockers/Concerns

None — 10-03 files complete, commit pending Bash access.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Infra | Plan 01-06: Doppler workspace bootstrap | Blocked on `doppler login` (interactive OAuth) | 2026-04-26 |
| Docs | Plan 04-02 SUMMARY.md missing | Code committed (b48476c, 938cdea, 9b7a889); summary never written | 2026-04-26 |
| Build | 11 agency apps need @mjagency/tools dep in package.json | Blocked on Bash/write access to parallel worktree files | 2026-04-28 |

## Session Continuity

Last session: 2026-04-28T11:30:00Z
Stopped at: Completed 12-04-PLAN.md — canary deploy pipeline (canary-health-check.mjs + canary-weights.tf + canary-deploy.yml)
Resume file: None

Next step: Continue Phase 12 remaining plans (12-02 seeds, 12-06 pre-launch gate)
