# Phase 11: Analytics + Compliance + Security - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the platform observable, lawful, and attack-resistant before launch. Specifically:
- Analytics: GA4 + Microsoft Clarity + Meta CAPI server-side, per-agency + platform dashboards, Phase 8 web-vitals piped to dashboards.
- Compliance: CCPA opt-out + erasure flow + ADA/WCAG 2.2 AA enforcement (already gated in Phase 8 — Phase 11 hardens the runtime).
- Security: Cloudflare WAF rules, CSP nonce, OWASP ZAP scan clean.

**Carries forward from prior phases:** US-only at v1 (PROJECT.md → CCPA framework only, GDPR opt-in not required); Phase 8 web-vitals reporter already captures LCP/INP/CLS; Phase 7 PII redactor reused for Clarity DOM masking + Meta CAPI hashing; Phase 5 audit log + Phase 10 hash-chain pattern reused for CCPA audit trail; Phase 9 BullMQ encrypted queues (sensitiveData: true) reused for CCPA workers; 12 per-agency Postgres + RLS — every CCPA erasure must fan out across all 12.

**Out of scope:** A/B testing platform, ML-driven attribution, custom analytics warehouse (deferred).

</domain>

<decisions>
## Implementation Decisions

### Consent + tracking model

- **D-01:** CCPA opt-out model (default-on tracking). Visitors load GA4/Clarity/Meta CAPI on first visit. Footer link "Do Not Sell or Share My Personal Information" present on every public page across all 12 agency sites. No GDPR-style cookie banner. Rationale: US-only v1 — CCPA framework controls; opt-in would lose 30–50% of analytics signal at the worst possible moment (launch).
- **D-02:** Consent state lives in `mj_consent` cookie (1-year expiry) read by `ConsentProvider` React Context + `useConsent()` hook. Cookie checked server-side in middleware/layout so SSR knows whether to render pixels — zero flash of pre-consent tracking. Default state when cookie absent: "tracking_allowed" (CCPA opt-out semantics).
- **D-03:** Revocation = server endpoint `POST /api/ccpa/opt-out`. Sets cookie to `tracking_blocked` AND fires GA4 User Deletion API + Meta CAPI Server Event Data Deletion + Clarity Delete API in parallel via BullMQ (sensitiveData: true). Page reloads with all pixels disabled. Audit row written for legal defensibility.

### CCPA erasure flow

- **D-04:** Public web form at `/privacy/erasure` (deployed to every agency subdomain + brand.com). User enters email → email verification link → confirms request. No login required (CCPA permits anonymous requests; auth-only would block non-customer visitors). Reuses Phase 9 form-builder pattern + email verification token from Phase 3.
- **D-05:** Full fan-out scope. BullMQ erasure worker deletes user data from all of: per-agency Postgres (contacts, deals, activities, form submissions, invoices, e-sign records — except those under legal hold), per-agency Redis caches, R2 storage (uploaded media + e-sign PDFs older than retention), GA4 (User Deletion API), Meta CAPI (deletion endpoint), Microsoft Clarity (Delete API), LiteLLM call logs (Phase 7). Configurable per-agency legal-hold rules in Payload (e.g., healthcare HIPAA) override default deletion for specific data classes.
- **D-06:** Published SLA = **30 days**. Internal target = 7 days (most cases complete same-day via async fan-out). Beats CCPA legal max (45 days + 45-day extension) with clear margin. Explicitly published on `/privacy` page.
- **D-07:** Hash-chained audit trail. New `ccpa_erasure_records` collection (Payload + Drizzle, RLS, immutable — `delete: () => false`). One row per system erased: `prev_hash`, `record_hash` (Phase 2 + Phase 10 pattern). On completion, signed PDF receipt generated via pdf-lib (reuse Phase 10 e-sign generator), emailed to requester + stored in R2 vault (per agency).

### CSP enforcement strictness

- **D-08:** Two-stage rollout. **Stage 1 (launch day):** ship `Content-Security-Policy-Report-Only` header. Configure Sentry CSP report endpoint at `/api/csp-report`. Collect violations 14 days. **Stage 2 (post-launch):** review reports, fix gaps, flip to enforcing `Content-Security-Policy`. Avoids launch-day breakage in Puck builder + 12 agency frontends.
- **D-09:** Per-request nonce via middleware. `middleware.ts` generates `crypto.randomUUID()` nonce, sets `x-nonce` request header, embeds in CSP `script-src 'nonce-{uuid}' 'strict-dynamic'` and `style-src 'nonce-{uuid}'`. Layout reads via `headers()`, passes to `<NonceProvider>`. Components emitting inline styles use `useNonce()` hook. SSR-safe with App Router.
- **D-10:** Minimal explicit CSP allowlist. Permitted external origins: `googletagmanager.com` (GA4), `clarity.ms` (Microsoft Clarity), `js.stripe.com` + `api.stripe.com` (Stripe), `cloudflareinsights.com` (Cloudflare RUM). Meta CAPI is server-side only — NO browser pixel — so no Meta domain in CSP. Everything else blocked. `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`, `base-uri 'self'`.

### Analytics dashboard depth

- **D-11:** Full business KPIs. Per-agency dashboard shows: traffic (GA4), RUM (LCP/INP/CLS from Phase 8 events), leads (Phase 9 CRM), deals (Phase 9 CRM), revenue (Phase 10 invoicing). Single primary product surface for agency owners. Platform-overview dashboard rolls these up across all 12 agencies for super-admins.
- **D-12:** Hybrid data source. GA4 Data API for traffic and channel/source data. Per-agency Postgres aggregate queries for CRM + invoicing metrics (already in DB from Phase 9/10). Phase 8 `web_vitals` events table for RUM percentiles. No separate analytics warehouse in v1 (deferred to backlog).
- **D-13:** Dashboard lives in Payload admin at `/admin/dashboard`. Custom Payload admin view (Phase 5 admin theming reused). Agency owners already log into Payload to edit content — single auth, no extra login. SSR-rendered, fast first paint. Super-admin sees platform-overview tab.
- **D-14:** Near-realtime refresh. Client polls dashboard endpoint every 60 seconds while page is visible (`document.visibilityState`). No websockets/SSE in v1. GA4 lag (~5–60 min) bounds perceived latency anyway; Postgres aggregates are live.

### Claude's Discretion

These were not selected for discussion — Claude has judgment based on stack/best-practice:
- **GTM server-side container hosting:** Cloudflare Workers (already in the stack at the edge — best latency, zero new infra). Endpoint: `analytics.{agency_subdomain}` proxies to Workers.
- **Microsoft Clarity DOM masking:** mask-all-by-default; whitelist specific non-PII selectors. Reuse Phase 7 `redactPii` for any text captured before send.
- **Cloudflare WAF strictness:** Cloudflare Managed Ruleset + Bot Fight Mode + per-route rate limits (auth: 10/min/IP, public form posts: 5/min/IP, public reads: 100/min/IP).
- **OWASP ZAP scan integration:** CI gate on PRs that touch `/api/*` or middleware (block on high-severity findings). Weekly full-site baseline scan against staging.
- **Meta CAPI + Pixel deduplication:** generate `event_id = crypto.randomUUID()` per server event, send same id with browser pixel where applicable. Standard Meta Conversions API dedup pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + prior phases
- `.planning/PROJECT.md` — US-only v1 mandate, multi-agency tenant model
- `.planning/REQUIREMENTS.md` — REQ-140 through REQ-147 (Phase 11 requirements)
- `.planning/ROADMAP.md` §"Phase 11: Analytics + Compliance + Security" — phase goal, success criteria, plan boundaries
- `.planning/phases/05-central-cms/` — Payload collection + admin theming patterns
- `.planning/phases/07-ai-assistant/` — `redactPii()`, prompt guard reused for Clarity masking
- `.planning/phases/08-public-frontend/` — `webVitalsReporter`, `web_vitals` events, ISR + middleware pattern
- `.planning/phases/09-crm-forms-booking/` — BullMQ encrypted queue (`createEncryptedQueue/Worker`, `sensitiveData: true`), form-builder + email-verify pattern
- `.planning/phases/10-tools-pitch-builder/` — Hash-chain audit trail (Phase 2 + 10 pattern), pdf-lib PDF generator, R2 vault storage
- `CLAUDE.md` — All security mandatory patterns (DOMPurify, HMAC webhooks, no secrets in NEXT_PUBLIC_*, agency isolation, JWT via jose only)

### External standards
- CCPA / CPRA: California Civil Code §§ 1798.100–1798.199 — right to know, right to delete, right to opt out, 45-day max response
- ADA / WCAG 2.2 AA — already enforced via axe-core in Phase 8 CI; Phase 11 adds runtime contrast guard
- OWASP ZAP scan profile — baseline + active scan
- ESIGN Act compliance — already covered in Phase 10 e-sign records (informs CCPA legal-hold rules)

### No ADRs yet — decisions in this CONTEXT.md are authoritative

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/observability/` (Phase 1, OTel) — server-side analytics container plugs in here
- `packages/ai/redact-pii.ts` — reused for Clarity DOM masking + any text captured pre-send
- `packages/queue/createEncryptedQueue` — used for opt-out fan-out, CCPA erasure worker, GA4/Meta/Clarity deletion jobs
- `packages/cms/audit-log` (Phase 5) — pattern reused for CCPA `ccpa_erasure_records` collection
- `packages/esign/pdf/generate-pdf.ts` (Phase 10) — pdf-lib pattern reused for CCPA completion-receipt PDFs
- `packages/proposals/r2.ts` (Phase 10) — R2 PutObjectCommand pattern reused for receipt vault
- `apps/web-*/src/app/(frontend)/` — public-form pattern for `/privacy/erasure` page (12 agencies)
- Phase 8 `web_vitals` events table + `WebVitalsReporter` — feeds RUM widget on dashboard
- Phase 8 `MjImage` ISR + ax-core gate — extend with WAF rules in 11-06

### Established Patterns
- **Middleware = Edge runtime, jose only** — CSP nonce generation lives here; no Node.js APIs allowed (CLAUDE.md rule 4)
- **Server-action auth pattern** — `requireSession()` + agencyId check on every action (CLAUDE.md rule 3)
- **No secrets in `NEXT_PUBLIC_*`** — GA4 Measurement ID is OK; GA4 Service Account JSON for Data API stays server-side only
- **All BullMQ jobs with email/PII use `sensitiveData: true`** — applies to opt-out + erasure + GA4-deletion workers
- **Per-agency Postgres + RLS** — CCPA erasure worker must connect to each agency's DB in turn; no cross-tenant queries
- **Hash-chain audit (`prev_hash`/`record_hash`)** — Phase 2 + Phase 10 pattern; reuse for CCPA records collection
- **var(--mj-*) tokens, zero hex** — applies to dashboard widgets in 11-04

### Integration Points
- `middleware.ts` (root + per-app) — CSP nonce injection point (Phase 11-07)
- Payload admin custom view (`/admin/dashboard`) — registered via Payload `admin.components.views` (Phase 5 pattern)
- BullMQ queues with new prefixes: `agency:<id>:ccpa-opt-out`, `agency:<id>:ccpa-erasure`, `platform:csp-report`
- Public route: `/api/ccpa/opt-out`, `/privacy/erasure`, `/api/csp-report`, `/api/privacy/verify` — all 12 agency apps + brand.com
- New Drizzle tables: `ccpa_erasure_records` (per-agency, RLS), `csp_reports` (platform, no agency_id), `consent_log` (per-agency, append-only)

</code_context>

<specifics>
## Specific Ideas

- "Do Not Sell or Share My Personal Information" — exact CCPA-required wording for the footer link (do not paraphrase)
- 30-day SLA published on `/privacy` page — sets the expectation publicly
- Dashboard "feels like" Linear's dashboard or Vercel's analytics — clean, fast, var(--mj-*) tokens, single primary metric per card
- CSP report-only first specifically because Puck builder uses inline styles — risk-managed launch

</specifics>

<deferred>
## Deferred Ideas

- A/B testing platform (separate phase post-v1)
- Custom analytics warehouse / event ingest (Phase 12+ — GA4 Data API + Postgres aggregates sufficient for v1)
- Realtime SSE dashboard updates (60s polling sufficient for v1)
- ML-driven attribution / multi-touch model (Phase 9 already does basic multi-touch; ML deferred)
- Per-agency stricter rules beyond healthcare-style legal hold (configurable, but no UI in v1)
- International (GDPR) opt-in cookie banner — only when expanding outside US
- Pen test by external firm — coordinated with Phase 12 launch QA, not included in 11-07 (engineering ZAP scan is)

</deferred>

---

*Phase: 11-analytics-security*
*Context gathered: 2026-04-28*
