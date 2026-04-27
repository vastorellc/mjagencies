---
gsd_state_version: 1.0
milestone: v9.1.20
milestone_name: milestone
status: executing Phase 09 crm-forms-booking
stopped_at: "Phase 09 plan 09-06 complete — Twilio SMS TCPA opt-in + encrypted queue + status webhook"
last_updated: "2026-04-27T20:45:00Z"
last_activity: 2026-04-27 -- Phase 09 plan 09-06 complete — packages/sms, TCPA guard, 11 Vitest tests
progress:
  total_phases: 13
  completed_phases: 8
  total_plans: 50
  completed_plans: 50
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** Every page, every agency, every image slot is 100% real and complete at launch — only the Brand Setup Wizard remains for the user post-generate.
**Current focus:** Phase --phase — 08

## Current Position

Phase: 09 (crm-forms-booking) — IN PROGRESS (plan 06 of 7 complete)
Status: Executing Phase 09 — Wave 3 in progress
Last activity: 2026-04-27 -- Phase 09 plan 09-06 complete (packages/sms, TCPA double opt-in, BullMQ encrypted queue, status webhook, 11 tests)

Progress: [████████░░] 62% (8/13 phases complete)

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

### Pending Todos

- Run `doppler login` then resume Plan 01-06 (Doppler workspace bootstrap)
- Write missing 04-02 SUMMARY.md (code is done, commits b48476c–711f0b8)

### Blockers/Concerns

None.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Infra | Plan 01-06: Doppler workspace bootstrap | Blocked on `doppler login` (interactive OAuth) | 2026-04-26 |
| Docs | Plan 04-02 SUMMARY.md missing | Code committed (b48476c, 938cdea, 9b7a889); summary never written | 2026-04-26 |

## Session Continuity

Last session: 2026-04-27T12:00:00Z
Stopped at: Phase 08 complete — all 7 plans done, 132 P0 page routes across 12 agency apps
Resume file: None

Next step: `/gsd-plan-phase 9` (Phase 09: CRM + Forms + Booking + Lead Routing)
