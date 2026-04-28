---
phase: 11
slug: analytics-compliance-security
researched: 2026-04-28
researcher: gsd-phase-researcher
domain: analytics + privacy compliance + web security hardening
confidence: HIGH (most areas) / MEDIUM (Phase-8 RUM persistence — see Critical Discovery)
requirements_covered:
  - REQ-140 (GA4 + GTM server-side container)
  - REQ-141 (Microsoft Clarity heatmaps)
  - REQ-142 (Meta CAPI server-side)
  - REQ-143 (per-agency analytics dashboards)
  - REQ-144 (CCPA / ADA compliance tooling — opt-out, deletion, export)
  - REQ-145 (Cloudflare WAF + security rules)
  - REQ-146 (CSP nonce per-request)
  - REQ-147 (OWASP ZAP scan clean)
key_risks:
  - "RUM dashboard depends on a persisted web_vitals events table that does NOT yet exist in packages/db (CONTEXT.md assumes it; only GA4-direct ingestion was built in Phase 8). Plan 11-04 must either (a) add the table + ingestion endpoint as a precursor task, or (b) source RUM from GA4 Data API and accept the 5-60min lag. RECOMMENDED: (a) — small Drizzle table + edge POST /api/rum is < 1 task and gives <1s freshness for the dashboard."
  - "Two CSP enforcement points exist today (packages/auth/security-headers.ts AND every middleware.ts in 12 apps). The nonce CSP must REPLACE the static one in security-headers.ts — not add a second header, which would be merged by the browser using the most-restrictive intersection and break all inline-style emitting components."
  - "All 12 apps share @mjagency/auth/middleware via re-export. Adding nonce/CSP to the shared middleware is correct architecture — but each app's middleware.ts file currently re-exports `config` (the matcher), so the matcher MUST exclude /api/csp-report (one new addition) or report POSTs will trigger auth redirects and 100% of CSP reports will be lost."
  - "Meta CAPI per-agency env var pattern (META_PIXEL_ID_${AGENCY_ID}, META_ACCESS_TOKEN_${AGENCY_ID}) needs uppercase normalization — existing LiteLLM pattern uses agencyId.toUpperCase() (Phase 7 STATE decision). Agency slugs contain hyphens (web-ecommerce); env var names cannot have hyphens, so the pattern is `META_ACCESS_TOKEN_${AGENCY_ID.replaceAll('-','_').toUpperCase()}` — same convention as Phase 7 LITELLM_API_KEY_${AGENCY_ID}."
  - "Microsoft Clarity NPM package (@microsoft/clarity) was only released in 2024; verify current Edge runtime compatibility before using clarity.init() in Next.js layout — fall back to <Script> tag injection if Edge incompatible."
  - "OWASP ZAP scan typically takes 1-10 minutes per target; running against 12 agency sites + brand.com (13 targets) on every PR will overwhelm CI budget. Scope correctly: PR gate hits ONLY the changed-app target; weekly cron runs the full 13-site sweep against staging."
---

<user_constraints>
## User Constraints (from 11-CONTEXT.md)

### Locked Decisions (D-01 through D-14 — research these, not alternatives)

**Consent + tracking model**

- **D-01:** CCPA opt-out model (default-on tracking). Visitors load GA4/Clarity/Meta CAPI on first visit. Footer link "Do Not Sell or Share My Personal Information" present on every public page across all 12 agency sites. No GDPR-style cookie banner. Default state when cookie absent: `tracking_allowed`.
- **D-02:** Consent state lives in `mj_consent` cookie (1-year expiry) read by `ConsentProvider` React Context + `useConsent()` hook. Cookie checked server-side in middleware/layout so SSR knows whether to render pixels — zero flash of pre-consent tracking.
- **D-03:** Revocation = server endpoint `POST /api/ccpa/opt-out`. Sets cookie to `tracking_blocked` AND fires GA4 User Deletion + Meta CAPI Deletion + Clarity Delete API in parallel via BullMQ (sensitiveData: true). Page reloads with all pixels disabled. Audit row written.

**CCPA erasure flow**

- **D-04:** Public web form at `/privacy/erasure` (deployed to all 12 apps + brand.com). Email entry → email verification link → confirms request. No login. Reuses Phase 9 form-builder + Phase 3 email verification token.
- **D-05:** Full fan-out scope. BullMQ erasure worker deletes from: per-agency Postgres (contacts, deals, activities, form submissions, invoices, e-sign records — except legal hold), per-agency Redis caches, R2 (uploaded media + e-sign older than retention), GA4, Meta CAPI, Clarity, LiteLLM call logs. Per-agency legal-hold rules in Payload override defaults.
- **D-06:** Published SLA = 30 days. Internal target = 7 days. Beats CCPA legal max (45+45 days). Published on `/privacy`.
- **D-07:** Hash-chained audit trail. New `ccpa_erasure_records` collection (Payload + Drizzle, RLS, immutable — `delete: () => false`). One row per system erased: `prev_hash`, `record_hash` (Phase 2 + Phase 10 pattern). On completion, signed PDF receipt via pdf-lib, emailed + stored in R2 vault.

**CSP enforcement**

- **D-08:** Two-stage rollout. Stage 1 launch: `Content-Security-Policy-Report-Only`. Sentry CSP report endpoint at `/api/csp-report`. 14 days collection. Stage 2 post-launch: review reports, fix gaps, flip to enforcing.
- **D-09:** Per-request nonce via middleware. `crypto.randomUUID()` nonce, `x-nonce` request header, embedded in CSP `script-src 'nonce-{uuid}' 'strict-dynamic'` and `style-src 'nonce-{uuid}'`. Layout reads via `headers()`, passes to `<NonceProvider>`. SSR-safe with App Router.
- **D-10:** Minimal explicit CSP allowlist. Permitted external origins: `googletagmanager.com`, `clarity.ms`, `js.stripe.com` + `api.stripe.com`, `cloudflareinsights.com`. **Meta CAPI is server-side only — NO browser pixel — so no Meta domain in CSP.** `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`, `base-uri 'self'`.

**Analytics dashboard**

- **D-11:** Full business KPIs per-agency: traffic (GA4), RUM (LCP/INP/CLS), leads (Phase 9), deals (Phase 9), revenue (Phase 10). Platform-overview rolls up across all 12 for super-admins.
- **D-12:** Hybrid data source. GA4 Data API for traffic. Per-agency Postgres aggregates for CRM + invoicing. Phase 8 web_vitals events table for RUM percentiles (NOTE: see Critical Discovery — table does not currently exist).
- **D-13:** Dashboard at `/admin/dashboard`. Custom Payload admin view (Phase 5 pattern). SSR-rendered. Super-admin sees platform-overview tab.
- **D-14:** Near-realtime refresh. Client polls every 60s while `document.visibilityState === 'visible'`. No websockets/SSE in v1.

### Claude's Discretion (research recommended, not locked)

- GTM server-side container hosting → Cloudflare Workers (already in stack at edge — best latency, zero new infra). Endpoint: `analytics.{agency_subdomain}` proxies to Workers.
- Microsoft Clarity DOM masking → mask-all-by-default; whitelist specific non-PII selectors. Reuse Phase 7 `redactPii` for any text captured before send.
- Cloudflare WAF strictness → Managed Ruleset + Bot Fight Mode + per-route rate limits (auth: 10/min/IP, public form posts: 5/min/IP, public reads: 100/min/IP).
- OWASP ZAP integration → CI gate on PRs touching `/api/*` or middleware (block on high-severity). Weekly full-site baseline against staging.
- Meta CAPI dedup → `event_id = crypto.randomUUID()` per server event; same id with browser pixel where applicable. (D-10 disables browser pixel, so dedup is server-only.)

### Deferred Ideas (OUT OF SCOPE — do not research)

- A/B testing platform (post-v1)
- Custom analytics warehouse / event ingest (Phase 12+)
- Realtime SSE dashboard updates (60s polling sufficient)
- ML-driven attribution / multi-touch model
- Per-agency stricter rules beyond healthcare-style legal hold (no UI in v1)
- International (GDPR) opt-in cookie banner
- External pen test (Phase 12 launch QA)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-140 | GA4 + GTM server-side container | Item 1 — server-side GTM on Cloudflare Workers, dual-tag (client GA4 + server CAPI) with event_id dedup |
| REQ-141 | Microsoft Clarity heatmaps | Item 2 — @microsoft/clarity@1.0.2 NPM, mask-all-by-default, Delete API for opt-out |
| REQ-142 | Meta CAPI server-side | Item 3 — direct fetch to graph.facebook.com/v22.0/{pixel_id}/events with hashed user_data |
| REQ-143 | Per-agency + platform analytics dashboards | Item 4 — Payload custom admin view, GA4 Data API + Postgres + RUM hybrid |
| REQ-144 | CCPA opt-out + deletion + export | Items 5 & 6 — opt-out modal + erasure form + worker fan-out + receipt PDF |
| REQ-145 | Cloudflare WAF + rate limit rules | Item 8 — Managed Ruleset + Bot Fight Mode + custom rate limit rules |
| REQ-146 | CSP nonce per-request | Item 7 — Edge middleware crypto.randomUUID + headers().get('x-nonce') |
| REQ-147 | OWASP ZAP scan zero high-severity | Item 9 — zaproxy/action-baseline GitHub Action + scoped per-PR + weekly cron |
</phase_requirements>

## Summary

Phase 11 has the highest cross-cutting integration density of any phase: it touches all 12 agency apps simultaneously, persists data in 4 places (Postgres × 12, Redis × 12, R2 × 12, Payload globals), modifies the shared edge middleware, adds Cloudflare WAF rules, gates CI with OWASP ZAP, and introduces 6 net-new public surfaces + 1 admin dashboard.

The codebase already contains every primitive this phase needs: the Phase 7 `redactPii()` for masking, Phase 9 `createEncryptedQueue()`/`createEncryptedWorker()` for fan-out, Phase 10 hash-chain `prev_hash/record_hash` pattern + `pdf-lib` PDF generator + R2 PutObjectCommand, Phase 8 `WebVitalsReporter` (RUM ingestion), Phase 5 Payload admin custom view registration, and Phase 3 email-verification token. The challenge is composition discipline, not novel implementation.

**Three load-bearing constraints from CLAUDE.md must drive every plan:**

1. **Edge runtime safety (CLAUDE.md rule 4):** middleware = jose only. The CSP nonce generation lives in `packages/auth/src/middleware.ts` (already Edge-safe) — no Node.js APIs.
2. **Server actions auth-first (CLAUDE.md rule 3):** every privacy/CCPA server action begins `await requireSession()` (when admin context) or HMAC-signed token validation (when public CCPA flow).
3. **No secrets in NEXT_PUBLIC_*:** GA4 Measurement IDs are public-by-design; GA4 Data API service account JSON, Meta access tokens, Clarity Delete API auth all stay server-only.

**Primary recommendation:** Build Plan 11-04 RUM data ingestion FIRST (precursor task to dashboard) — it is the only piece CONTEXT.md assumes exists but does not. Everything else composes from existing primitives.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GA4 client tag injection | Frontend Server (SSR) | Browser | Server reads `mj_consent` cookie; only emits `<Script>` if `tracking_allowed`. Browser executes. |
| GA4 server tag (sGTM container) | CDN / Edge (Cloudflare Workers) | — | Same-origin proxy at `analytics.{subdomain}` → Workers reverse-proxies to Google Tag Manager Server. |
| GA4 Data API (dashboard reads) | API / Backend | — | Service account JSON server-only (CLAUDE.md rule 7). Called from Payload admin view RSC + 60s polling endpoint. |
| Microsoft Clarity inject | Frontend Server (SSR) | Browser | Server gates on cookie; browser runs `clarity.init()`. |
| Clarity Delete API | API / Backend | — | Auth secret server-only. |
| Meta CAPI server event | API / Backend | — | Server-only by D-10 (no browser pixel). |
| CCPA opt-out endpoint | API / Backend | — | Cookie set + queue fan-out. |
| CCPA erasure form | Frontend Server (SSR) | Browser | Form rendered server, validation + submit client-side. |
| CCPA erasure worker | API / Backend (BullMQ) | Database / Storage | Connects to each per-agency Postgres + Redis + R2 in turn. |
| CSP nonce generation | CDN / Edge (middleware) | Frontend Server | Nonce in middleware Edge runtime; layout reads via `headers()`. |
| CSP report endpoint | API / Backend | — | Receives violation reports; stores in `csp_reports` table. |
| Dashboard custom view | Frontend Server (SSR) | API / Backend | Payload admin custom view (RSC) + `/api/admin/dashboard/metrics` polling endpoint. |
| RUM ingestion | API / Backend | Database | Edge `POST /api/rum` → `web_vitals` Postgres table (NEW — see Critical Discovery). |
| WAF rules | CDN / Edge (Cloudflare dashboard) | — | Configured in Cloudflare dashboard / Terraform; not in app code. |
| OWASP ZAP scan | CI (GitHub Actions) | Staging environment | Runs in CI workflow against ephemeral or staging endpoints. |

## Critical Discovery: web_vitals Persistence Gap

**Status:** [VERIFIED: codebase grep — Phase 8 SUMMARY 08-01]

CONTEXT.md D-12 says:
> "Phase 8 `web_vitals` events table for RUM percentiles"

**This table does not exist.** Phase 8 plan 08-01 / 08-05 implemented `WebVitalsReporter` as a `'use client'` component that sends events ONLY to GA4 via `window.gtag(...)` — there is no Postgres table, no `/api/rum` ingestion route, no Drizzle schema for it. The component file `packages/ui/src/rum/web-vitals.tsx` confirms this:

```typescript
const send = (metric: Metric): void => {
  window.gtag?.('event', metric.name, { ... })  // GA4 only — no /api/rum POST
}
```

Per `packages/db/src/schema/index.ts` directory listing:
- agencies.ts, audit-log.ts, base.ts, crm.ts, esign.ts, invoices.ts, mfa-config.ts, permissions-vault.ts, proposals.ts, seed-state.ts, sessions.ts, users.ts
- **No web_vitals.ts**

### Recommendation

The dashboard RUM card needs sub-second freshness on per-page p75 percentiles, which GA4 Data API cannot deliver (5-60 min lag). Add as a precursor task to Plan 11-04:

1. **New Drizzle table** `web_vitals` (per-agency, RLS):
   ```sql
   id BIGSERIAL PK, agency_id UUID NOT NULL, page_path TEXT NOT NULL,
   metric_name TEXT NOT NULL CHECK (metric_name IN ('LCP','INP','CLS','FCP','TTFB')),
   value DOUBLE PRECISION NOT NULL, rating TEXT, navigation_type TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW()
   -- Index on (agency_id, page_path, metric_name, created_at DESC)
   ```
2. **New ingestion endpoint** `POST /api/rum` (Edge runtime, no auth — public): rate-limit 100/min/IP via Cloudflare WAF (already planned in 11-06), insert via `postgres-js` direct (RLS bypass acceptable since `agency_id` derived from `Host` header by middleware).
3. **Update WebVitalsReporter** to dual-emit: existing `gtag()` call (preserves GA4 funnel) + new `navigator.sendBeacon('/api/rum', JSON.stringify({...}))` (persists for dashboard).
4. **Aggregate query** in Plan 11-04 dashboard: `SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY value) FROM web_vitals WHERE agency_id = $1 AND metric_name = 'LCP' AND created_at > NOW() - INTERVAL '24 hours' GROUP BY page_path`.

Estimated effort: 1 small task (~15 min) inside Plan 11-04. Or split into a precursor Plan 11-00 if planner prefers atomicity.

---

## Research item 1: GA4 + GTM Server-Side Container on Cloudflare Workers (REQ-140)

### Recommended approach

**Hybrid client + server tagging** with `event_id` deduplication.

Per-agency setup:
1. **GA4 property per agency** — 12 properties + 1 brand. Each gets a Measurement ID (e.g. `G-XXXXXXXXXX`) which IS public — exposed via `NEXT_PUBLIC_GA4_MEASUREMENT_ID` per agency app.
2. **Server-side GTM container** hosted on Cloudflare Workers, accessible at `analytics.{agency_subdomain}` (e.g. `analytics.web-ecommerce.mjagency.com`). The Worker is a thin reverse proxy to Google Tag Manager Server (running as a Docker container on Google Cloud Run, or a managed sGTM provider like Stape — D-loose, recommend self-hosted on Cloud Run for cost).
3. **GA4 Measurement Protocol fallback** — for events that must bypass client (e.g. CCPA opt-out fired from server), POST directly to `https://www.google-analytics.com/mp/collect?measurement_id=G-XXX&api_secret=YYY` with `client_id` + event payload.
4. **GA4 Data API for dashboard reads** — `@google-analytics/data@5.2.1` [VERIFIED: npm view 2026-04-28] with service account JSON. Account JSON path stays in Doppler, never in `NEXT_PUBLIC_*`.

[CITED: developers.google.com/analytics — GA4 properties accept events via gtag.js (browser) AND Measurement Protocol (server)]

### Per-agency env var pattern

Mirrors Phase 7 LiteLLM convention (`LITELLM_API_KEY_${AGENCY_ID}`):

| Var | Scope | Example | Public? |
|-----|-------|---------|---------|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | per-app | `G-ECOM12345` | YES (browser must read) |
| `GA4_API_SECRET_${SLUG_UPPER}` | server | `GA4_API_SECRET_WEB_ECOMMERCE` | NO |
| `GA4_PROPERTY_ID_${SLUG_UPPER}` | server | `123456789` | NO |
| `GOOGLE_APPLICATION_CREDENTIALS_PATH_${SLUG_UPPER}` | server | `/secrets/ga4-ecom-sa.json` | NO |
| `SGTM_ENDPOINT_${SLUG_UPPER}` | server | `https://analytics.web-ecommerce.mjagency.com` | NO |

`SLUG_UPPER` = `agencyId.replaceAll('-','_').toUpperCase()` (env var names cannot contain hyphens).

### Alternatives considered

| Approach | Tradeoff |
|----------|----------|
| **Stape.io managed sGTM** | $20-100/mo per container × 12 = $240-1200/mo. Faster setup but recurring cost. Not selected — Cloudflare Workers free tier covers 100K req/day per worker. |
| **Self-hosted sGTM on Cloud Run** | $5-15/mo per container, zero-to-scale. Trade off: maintain Docker image + Google Tag Manager auth. |
| **Cloudflare Workers proxy ONLY** | Worker forwards browser hits straight to Google. Cheapest but loses sGTM transformation layer. Acceptable for v1 if cost becomes blocking. |
| **Plausible / Fathom self-hosted** | Privacy-first analytics. Out of scope — REQ-140 explicitly mandates GA4. |

### Key code snippet — Cloudflare Worker proxy (sGTM same-origin)

```typescript
// workers/sgtm-proxy.ts — deployed at analytics.{agency_subdomain}
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    // Strip Cloudflare-added headers; forward original IP via X-Forwarded-For
    const sgtmTarget = `https://sgtm-${SLUG}.run.app${url.pathname}${url.search}`
    return fetch(sgtmTarget, {
      method: req.method,
      headers: {
        ...Object.fromEntries(req.headers),
        'X-Forwarded-For': req.headers.get('CF-Connecting-IP') ?? '',
        'X-Forwarded-Proto': 'https',
      },
      body: req.method !== 'GET' ? await req.arrayBuffer() : undefined,
    })
  },
}
```

### Integration points

- **Layout-level GA4 inject:** `apps/web-*/src/app/(frontend)/layout.tsx` — add server-rendered `<Script>` only if `cookies().get('mj_consent')?.value !== 'tracking_blocked'`. The existing `WebVitalsReporter` (Phase 8) keeps emitting via `window.gtag` and benefits automatically.
- **Server action GA4 fallback:** `packages/analytics/src/ga4-server.ts` (NEW) — `sendServerEvent(agencyId, eventName, params)` calls Measurement Protocol.
- **Dashboard GA4 reads:** `packages/analytics/src/ga4-data-api.ts` (NEW) — `runReport({propertyId, dimensions, metrics, dateRanges})` returns rows for KPI cards.

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 1.1 | **`NEXT_PUBLIC_GA4_MEASUREMENT_ID` is per-app, not global** — using brand.com's ID for all 12 agency apps misattributes 100% of analytics. | Each agency app's `.env.local` (and Doppler config) carries its own MID. Verify `process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID` is referenced via the existing `NEXT_PUBLIC_AGENCY_SLUG` pattern. |
| 1.2 | **Service account JSON file in repo** — would leak GA4 read access. | Doppler downloads to `/secrets/` at deploy time; gitignore + CI gate `grep -r "private_key" packages/ apps/` returns 0. |
| 1.3 | **GA4 Data API quota: 25,000 tokens/day per property** — 60s dashboard polling × 12 agency users × 8 hours × 5 cards = ~2,300 reads/day/property. Borderline. | Cache GA4 responses for 5 min in Redis (`agency:<id>:dashboard:ga4:*`). 60s client polling hits cache 11/12 times. |
| 1.4 | **Measurement Protocol drops events with no validation** — bad event names or missing `client_id` get HTTP 204 + silent drop. | Server-side validation before send: `event_name` must be `[a-z_]{1,40}`; `client_id` must be present (use anonymous UUID derived from session). |
| 1.5 | **Same-origin sGTM requires DNS A/AAAA records on `analytics.{subdomain}` pointing to Cloudflare Workers** — easy to miss for new agencies. | Document in `docs/runbooks/agency-onboarding.md`. Validation script in CI: `dig analytics.web-ecommerce.mjagency.com +short` returns CF range. |

---

## Research item 2: Microsoft Clarity (REQ-141)

### Recommended approach

**`@microsoft/clarity@1.0.2`** [VERIFIED: npm view 2026-04-28] — official package released by Microsoft. Replaces the 2021-vintage `<script async src="..."/>` snippet with a proper NPM module.

[CITED: clarity.microsoft.com/blog/npm-integration/ — official Microsoft Clarity NPM blog post]

Per-agency Clarity project ID lives in `NEXT_PUBLIC_CLARITY_PROJECT_ID` (analogous to GA4 MID — public by design). 12 agency projects + 1 brand = 13 Clarity projects.

### Initialization pattern

```typescript
// apps/web-*/src/app/(frontend)/layout.tsx
'use client'  // OR mount via a client wrapper
import Clarity from '@microsoft/clarity'
import { useEffect } from 'react'

function ClarityInit({ projectId, consent }: { projectId: string; consent: boolean }) {
  useEffect(() => {
    if (!consent) return  // D-02: gated by mj_consent cookie
    Clarity.init(projectId)
    // Mask all PII fields by default — D-loose decision
    Clarity.consent()  // marks user as opted-in for Clarity's own consent layer
  }, [projectId, consent])
  return null
}
```

### Mask-all-by-default config

Clarity supports two masking strategies:

1. **CSS-attribute** — add `data-clarity-mask="true"` to any element. Best for component-level PII (form fields, user emails).
2. **Project-dashboard config** — set `Mask Mode = 'Strict'` in clarity.microsoft.com project settings. Masks ALL text by default; whitelist via CSS selector list.

**Recommended:** Project dashboard `Mask Mode = 'Strict'` for v1 (zero PII risk by default). Whitelist hero copy + service descriptions via CSS class `.clarity-allow` once content team is comfortable.

### Reuse Phase 7 `redactPii()` for any custom event payloads

Clarity supports `Clarity.event(eventName, data)` for custom events. Any string we pass to `data` flows to Microsoft. Pre-process:

```typescript
import { redactPii } from '@mjagency/ai'  // Phase 7 reuse
const cleanData = redactPii(formField).redacted
Clarity.event('form_submit', { field_redacted: cleanData })
```

### Clarity Delete API for opt-out

[CITED: learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup — Cookie Consent API]

Per project, the Delete API requires:
- `clarity-api-token` (from project dashboard, server-only)
- `POST https://www.clarity.ms/api/v3/delete` with `{ "userId": "<clarity-internal-id>" }` body

**Per-agency env var:** `CLARITY_API_TOKEN_${SLUG_UPPER}` (analogous to GA4 pattern).

### Alternatives considered

| Approach | Tradeoff |
|----------|----------|
| `<Script src="https://www.clarity.ms/tag/{id}"/>` legacy | Works but bypasses CSP nonce. Selected approach uses `@microsoft/clarity` NPM package, which respects nonce because the script is bundled. |
| `react-microsoft-clarity@2.0.x` community wrapper | Adds dependency for ~10 lines of code. Not selected. |
| Hotjar / FullStory | Out of scope — REQ-141 explicit. |

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 2.1 | **Clarity Delete API requires Clarity's internal user ID, not the user's email** — opt-out flow needs to capture the Clarity ID at session start. | On `Clarity.init()` success, call `Clarity.identify(<sha256-of-email>)` or use `Clarity.getUserID()` (if available in 1.0.2 — verify) and store mapping in `consent_log` table for later deletion. |
| 2.2 | **Mask-mode='Strict' breaks the "Top Pages" report** because page titles get masked. | Whitelist `<title>` and `<h1>` via project config CSS list: `title, h1, h2.clarity-allow`. |
| 2.3 | **Clarity `<script>` evaluates `eval()` internally** — strict CSP without `'unsafe-eval'` will block it. Verify before launch. | If broken: add `'unsafe-eval'` to `script-src` (acceptable per Clarity docs). Or move Clarity behind a CSP-bypass `<iframe sandbox>` (complex). |
| 2.4 | **Clarity captures network XHR by default** — could leak Stripe payment payloads even with DOM masking. | Disable XHR capture in project dashboard: Settings → "Capture network requests" = off. |

---

## Research item 3: Meta CAPI server-side (REQ-142)

### Recommended approach

**Direct fetch to Graph API** at `https://graph.facebook.com/v22.0/{pixel_id}/events` — NOT the `facebook-nodejs-business-sdk@24.0.1` [VERIFIED: npm view 2026-04-28]. Reasons:

1. **SDK is heavy** (~3MB installed; pulls in axios, lodash, full Facebook ads API surface). We need 1 endpoint.
2. **Edge runtime compatibility unverified** for facebook-nodejs-business-sdk. Direct fetch is universally compatible.
3. **CLAUDE.md rule 9 (no `any`)** — direct fetch with TypeScript types we control is cleaner than wrapping SDK any-types.

[CITED: developers.facebook.com/docs/marketing-api/conversions-api — Conversions API direct REST endpoint]

### Per-agency env vars

| Var | Example | Notes |
|-----|---------|-------|
| `META_PIXEL_ID_${SLUG_UPPER}` | `123456789012345` | Per-agency Meta pixel/dataset ID |
| `META_ACCESS_TOKEN_${SLUG_UPPER}` | `EAAxxx...` | Long-lived system user token, server-only |
| `META_TEST_EVENT_CODE_${SLUG_UPPER}` | `TEST123` | Optional — test events visible in Meta Events Manager Test Events tab |

### Hashing user_data (reuse Phase 7 patterns)

Meta requires SHA-256 of normalized fields:

```typescript
import { createHash } from 'crypto'
function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}
function hashPhone(phone: string): string {
  // Meta wants E.164 without + prefix: "14155551234"
  const normalized = phone.replace(/[^\d]/g, '').replace(/^1/, '') // strip US country code
  return createHash('sha256').update('1' + normalized).digest('hex')
}
```

Reuse the SHA-256-on-PII discipline from Phase 9 SMS (where phone is hashed before Redis insertion) and Phase 10 e-sign (where signer IP is hashed before storage).

### event_id deduplication

`event_id = crypto.randomUUID()` per server event. Meta dedupes based on `event_name + event_id + event_time`. Per D-10 (no browser pixel), dedup is server-only — but generating `event_id` per server event is still required because retries from BullMQ workers should not inflate counts.

Persist `event_id` in BullMQ job `id` field — BullMQ guarantees same `id` is processed once.

### Key code snippet — server-side CAPI send

```typescript
// packages/analytics/src/meta-capi.ts (NEW)
import { createHash } from 'crypto'

interface CapiUserData { em?: string; ph?: string; client_ip_address?: string; client_user_agent?: string }
interface CapiEvent { event_name: string; event_time: number; event_id: string; user_data: CapiUserData; custom_data?: Record<string, unknown> }

export async function sendCapiEvent(agencyId: string, event: CapiEvent): Promise<void> {
  const slugUpper = agencyId.replaceAll('-', '_').toUpperCase()
  const pixelId = process.env[`META_PIXEL_ID_${slugUpper}`]
  const accessToken = process.env[`META_ACCESS_TOKEN_${slugUpper}`]
  if (!pixelId || !accessToken) throw new Error(`Meta CAPI not configured for ${agencyId}`)

  const hashed: CapiUserData = {
    ...(event.user_data.em && { em: createHash('sha256').update(event.user_data.em.trim().toLowerCase()).digest('hex') }),
    ...(event.user_data.ph && { ph: createHash('sha256').update(event.user_data.ph.replace(/\D/g, '')).digest('hex') }),
    ...(event.user_data.client_ip_address && { client_ip_address: event.user_data.client_ip_address }),
    ...(event.user_data.client_user_agent && { client_user_agent: event.user_data.client_user_agent }),
  }

  const res = await fetch(`https://graph.facebook.com/v22.0/${pixelId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{ ...event, user_data: hashed, action_source: 'website' }],
      access_token: accessToken,
      ...(process.env[`META_TEST_EVENT_CODE_${slugUpper}`] && { test_event_code: process.env[`META_TEST_EVENT_CODE_${slugUpper}`] }),
    }),
  })
  if (!res.ok) throw new Error(`CAPI send failed ${res.status}: ${await res.text()}`)
}
```

### Integration points

- Phase 9 lead form submission → call `sendCapiEvent(agencyId, { event_name: 'Lead', ... })`.
- Phase 10 invoice paid → call `sendCapiEvent(agencyId, { event_name: 'Purchase', custom_data: { value, currency } })`.
- Always wrap call in BullMQ job with `sensitiveData: true` (PII in user_data even hashed = sensitive per project policy).

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 3.1 | **Meta access tokens expire** — short-lived tokens (1-2 hours) versus system-user long-lived tokens (~60 days). | Use System User token from Business Manager. Document rotation in `docs/runbooks/meta-capi-rotation.md`. CI gate: alert when `META_ACCESS_TOKEN_*` decoded JWT exp is within 7 days. |
| 3.2 | **Phone normalization wrong** — Meta wants E.164 without `+` (`14155551234`). Easy to send `(415)555-1234` literal. | Strict regex `\D` strip + leading `1` for US (REQ states US-only v1). |
| 3.3 | **`event_time` must be Unix seconds, not milliseconds** — sending `Date.now()` overflows by 1000× and Meta rejects. | `Math.floor(Date.now() / 1000)`. |
| 3.4 | **Test event code in production traffic** = data fed to test bucket, real campaigns starve. | Only set `META_TEST_EVENT_CODE_*` in `.env.development` / staging. Production env never has the var. |
| 3.5 | **CAPI events with no user_data fail** — Meta requires at least 1 of (em, ph, fbp, fbc, external_id, ip+ua). | Always include `client_ip_address` (from `req.headers.get('cf-connecting-ip')`) and `client_user_agent` as fallback. |

---

## Research item 4: Analytics dashboards (REQ-143)

### Recommended approach

**Payload custom admin view** at `/admin/dashboard` (Phase 5 admin theming pattern reused) + RSC initial render + 60s client polling.

[CITED: payloadcms.com/docs/admin/components — `admin.components.views` registers custom routes inside the admin shell]

### Payload custom view registration

```typescript
// packages/cms/src/admin-views/dashboard-view.ts (NEW)
import type { AdminViewConfig } from 'payload'

export const dashboardView: AdminViewConfig = {
  Component: '@mjagency/cms/admin-views/DashboardView#default',
  path: '/dashboard',
  exact: true,
}

// In packages/cms/src/build-payload-config.ts:
admin: {
  ...existing,
  components: {
    ...existing.components,
    views: {
      Dashboard: dashboardView,
    },
  },
}
```

### Data source pipeline (per D-12)

| KPI Card | Source | Query Pattern | Cache |
|----------|--------|--------------|-------|
| Sessions (7d) | GA4 Data API `runReport` dim=date metric=sessions | `@google-analytics/data` runReport | Redis 5min |
| LCP/INP/CLS p75 (24h) | Postgres `web_vitals` (NEW table — see Critical Discovery) | `percentile_cont(0.75) WITHIN GROUP (ORDER BY value)` per page | None (live) |
| New leads (7d) | Postgres `contacts` (Phase 9) | `SELECT count(*) WHERE agency_id=$1 AND created_at > NOW()-INTERVAL '7d'` | None |
| Open pipeline value | Postgres `deals` (Phase 9) | `SELECT sum(value) WHERE agency_id=$1 AND stage NOT IN ('won','lost')` | None |
| Revenue MTD | Postgres `invoices` (Phase 10) | `SELECT sum(amount) WHERE agency_id=$1 AND status='paid' AND paid_at > date_trunc('month', NOW())` | None |
| Top pages (GA4) | GA4 Data API dim=pagePath metric=screenPageViews | runReport with orderBy desc | Redis 5min |

### Key code snippet — RSC dashboard view

```typescript
// packages/cms/src/admin-views/DashboardView.tsx (NEW, default export)
import { headers } from 'next/headers'
import { requireSession } from '@mjagency/auth'
import { getDashboardMetrics } from '@mjagency/analytics/dashboard'
import { KpiCard, RumKpiCard, TopPagesTable, DashboardPolling } from '@mjagency/ui/dashboard'

export default async function DashboardView() {
  const session = await requireSession()  // CLAUDE.md rule 3
  const view = (await headers()).get('x-view') ?? 'agency'
  const agencyIds = view === 'platform' && session.role === 'super_admin'
    ? await getAllAgencyIds()
    : [session.agencyId]

  const initialMetrics = await getDashboardMetrics(agencyIds)

  return (
    <main>
      <h1>Dashboard</h1>
      <DashboardPolling initialMetrics={initialMetrics} agencyIds={agencyIds}>
        <KpiCard label="Sessions (last 7 days)" />
        <RumKpiCard metric="LCP" />
        {/* ... */}
      </DashboardPolling>
    </main>
  )
}
```

### Polling endpoint

```typescript
// apps/web-main/src/app/api/admin/dashboard/metrics/route.ts (NEW)
import { requireSession } from '@mjagency/auth'
import { getDashboardMetrics } from '@mjagency/analytics/dashboard'

export async function GET(req: Request) {
  const session = await requireSession()  // CLAUDE.md rule 3
  const view = new URL(req.url).searchParams.get('view') ?? 'agency'
  const agencyIds = view === 'platform' && session.role === 'super_admin'
    ? await getAllAgencyIds()
    : [session.agencyId]
  return Response.json(await getDashboardMetrics(agencyIds))
}
```

### Client polling hook (per UI-SPEC Surface 1)

```typescript
// packages/ui/src/dashboard/use-dashboard-polling.ts (NEW)
'use client'
import { useEffect, useState } from 'react'

export function useDashboardPolling(initial, agencyIds, viewMode) {
  const [data, setData] = useState(initial)
  useEffect(() => {
    let active = true
    const poll = async () => {
      if (document.visibilityState !== 'visible') return  // D-14
      const res = await fetch(`/api/admin/dashboard/metrics?view=${viewMode}`)
      if (active && res.ok) setData(await res.json())
    }
    const id = setInterval(poll, 60_000)
    return () => { active = false; clearInterval(id) }
  }, [agencyIds.join(','), viewMode])
  return data
}
```

### Token rule enforcement (UI-SPEC)

All dashboard React components (`KpiCard`, `RumKpiCard`, `TopPagesTable`, sparkline svg) live in `packages/ui/src/dashboard/` and use `var(--mj-*)` exclusively. The Phase 4 AJV validator + Phase 8 axe-core CI gate already catches violations. No new validator needed.

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 4.1 | **`headers()` is async in Next.js 15** — old code `headers().get(...)` fails typecheck. | `await headers()` then `.get(...)`. |
| 4.2 | **GA4 Data API quota exceeded under polling** — 12 agencies × 60s polling × 8 hr × 5 cards = 28,800 calls/day per property; quota is 25,000/day. | Redis cache 5 min on GA4 reads (most polls hit cache). Quota usage ~2,400/day per property. |
| 4.3 | **Per-agency Postgres aggregate queries × 12 in platform-overview view** = 12 round-trips. | Run in `Promise.all()` parallel with per-agency PgBouncer pool. Each query <50ms; total <100ms wall. |
| 4.4 | **Custom Payload view does not inherit Payload's session** without explicit auth check. | First line: `await requireSession()` (Phase 3 helper). Without this, anonymous users see super-admin view. |
| 4.5 | **Sparkline SVG inline `style="stroke: ..."`** breaks CSP nonce (inline style without nonce). | Use external CSS class `.dashboard-sparkline { stroke: var(--mj-color-brand-500) }` in `packages/ui/src/dashboard/dashboard.css`. |

---

## Research item 5: CCPA opt-out flow (REQ-144 — part 1)

### Cookie + ConsentProvider pattern

```typescript
// packages/ui/src/consent/consent-provider.tsx (NEW)
'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'

type ConsentState = 'tracking_allowed' | 'tracking_blocked'
const ConsentContext = createContext<{ state: ConsentState; setState: (s: ConsentState) => void } | null>(null)

export function ConsentProvider({ initial, children }: { initial: ConsentState; children: ReactNode }) {
  const [state, setState] = useState<ConsentState>(initial)
  return <ConsentContext.Provider value={{ state, setState }}>{children}</ConsentContext.Provider>
}

export function useConsent() {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent must be used inside ConsentProvider')
  return ctx
}
```

### Server-side gate in layout

```typescript
// apps/web-*/src/app/(frontend)/layout.tsx
import { cookies } from 'next/headers'
import { ConsentProvider } from '@mjagency/ui/consent'

export default async function PublicLayout({ children }) {
  const cookieJar = await cookies()
  const consent = cookieJar.get('mj_consent')?.value === 'tracking_blocked'
    ? 'tracking_blocked'
    : 'tracking_allowed'  // D-01: default-on
  return (
    <html>
      <body>
        <ConsentProvider initial={consent}>
          {consent === 'tracking_allowed' && <GA4Inject /> /* Server-rendered Script */}
          {consent === 'tracking_allowed' && <ClarityInit projectId={...} /> }
          {/* Meta CAPI server-side only — D-10, no browser inject */}
          {children}
          <CookieHintBanner />  {/* Surface 6 */}
        </ConsentProvider>
      </body>
    </html>
  )
}
```

### Opt-out endpoint — POST /api/ccpa/opt-out

```typescript
// apps/web-*/src/app/api/ccpa/opt-out/route.ts (NEW, deployed to all 13 apps)
import { cookies } from 'next/headers'
import { createCcpaOptOutQueue } from '@mjagency/compliance'

export async function POST(req: Request) {
  const agencyId = process.env.NEXT_PUBLIC_AGENCY_SLUG!  // Phase 8 pattern
  const ip = req.headers.get('cf-connecting-ip') ?? ''
  const ua = req.headers.get('user-agent') ?? ''

  // Set mj_consent cookie
  const cookieJar = await cookies()
  cookieJar.set('mj_consent', 'tracking_blocked', {
    maxAge: 60 * 60 * 24 * 365, sameSite: 'strict', secure: true, httpOnly: false,
  })

  // Audit row in consent_log table
  await logConsentEvent({ agencyId, ipHash: sha256(ip), userAgent: ua, action: 'opt_out' })

  // Queue parallel fan-out: GA4 user-deletion + Meta CAPI deletion + Clarity Delete
  const queue = createCcpaOptOutQueue(agencyId)
  await queue.add('opt-out-fanout', { agencyId, anonymousId: cookieJar.get('mj_anon_id')?.value }, { sensitiveData: true })

  return Response.json({ ok: true })
}
```

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 5.1 | **Cookie set in API route is visible to browser only after page reload** — modal shows "tracking stopped" but pixels still load until refresh. | UI-SPEC Surface 4: explicit `window.location.reload()` after success. SSR re-renders without `<GA4Inject />`. |
| 5.2 | **Anonymous users have no email** for GA4/Meta/Clarity deletion API. | Use `client_id` (GA4 cookie) or `userId` (Clarity), or cookie `mj_anon_id` set on first visit. Without an ID, deletion is a no-op (acceptable — they were never identified). |
| 5.3 | **`mj_consent` cookie set with `httpOnly: false`** — JS must read for `useConsent()` initial state on client. | OK by design. Cookie does not contain secrets. |
| 5.4 | **Cookie `domain` attribute** — should it cover all subdomains? | NO — D-01 says per-agency. Each agency app sets cookie with default domain (subdomain only). Cross-agency consent does not transfer. |
| 5.5 | **Browser prefetch of /privacy/erasure form** triggers spurious consent_log writes. | API endpoint requires POST + valid form data; prefetch is GET-only. |

---

## Research item 6: CCPA erasure form + worker (REQ-144 — part 2)

### Form route per UI-SPEC Surface 3

12 agency apps + brand.com = 13 deployments of `/privacy/erasure` page. Reuse Phase 9 form-builder + Phase 3 email verification token.

```typescript
// apps/web-*/src/app/(frontend)/privacy/erasure/page.tsx (NEW × 13 apps)
import { ErasureFormClient } from '@mjagency/compliance/erasure-form-client'
export default function ErasurePage() {
  const agencyId = process.env.NEXT_PUBLIC_AGENCY_SLUG!
  return <ErasureFormClient agencyId={agencyId} />
}
```

### Email verification token (Phase 3 reuse)

```typescript
// packages/compliance/src/erasure/token.ts (NEW)
import { SignJWT, jwtVerify } from 'jose'  // CLAUDE.md rule 2 — jose only
const SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!)

export async function createErasureToken(email: string, agencyId: string): Promise<string> {
  return new SignJWT({ email, agencyId, kind: 'erasure' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('mjagency').setAudience('mjagency-api')
    .setExpirationTime('24h')   // UI-SPEC: 24h TTL
    .sign(SECRET)
}

export async function verifyErasureToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET, {
    algorithms: ['HS256'], issuer: 'mjagency', audience: 'mjagency-api',
  })
  if (payload.kind !== 'erasure') throw new Error('Invalid token kind')
  return payload as { email: string; agencyId: string }
}
```

### Erasure worker — full fan-out (D-05)

```typescript
// packages/compliance/src/erasure/worker.ts (NEW)
import { createEncryptedWorker } from '@mjagency/queue'
import { redactPii } from '@mjagency/ai'  // Phase 7 reuse for log redaction

export function startErasureWorker(agencyId: string) {
  return createEncryptedWorker('ccpa-erasure', async (job) => {
    const { email, requestId } = job.data
    const recordHash = ''  // hash-chained per system erased

    // 1. Postgres tables (per-agency)
    const pgDeleted = await deleteFromPostgres(agencyId, email, { honorLegalHold: true })
    await writeAuditRow(agencyId, requestId, 'postgres', pgDeleted, recordHash)

    // 2. Redis caches
    const redisDeleted = await deleteFromRedis(agencyId, email)
    await writeAuditRow(agencyId, requestId, 'redis', redisDeleted, recordHash)

    // 3. R2 (uploaded media + e-sign older than retention)
    const r2Deleted = await deleteFromR2(agencyId, email, { honorLegalHold: true })
    await writeAuditRow(agencyId, requestId, 'r2', r2Deleted, recordHash)

    // 4. GA4 User Deletion API
    await ga4DeleteUser(agencyId, email)
    await writeAuditRow(agencyId, requestId, 'ga4', { ok: true }, recordHash)

    // 5. Meta CAPI deletion (server event with event_name='DeleteUser' + hashed em)
    await metaCapiDeleteUser(agencyId, email)
    await writeAuditRow(agencyId, requestId, 'meta_capi', { ok: true }, recordHash)

    // 6. Clarity Delete API
    await clarityDeleteUser(agencyId, email)
    await writeAuditRow(agencyId, requestId, 'clarity', { ok: true }, recordHash)

    // 7. LiteLLM call logs (Phase 7)
    await litellmDeleteCalls(agencyId, email)
    await writeAuditRow(agencyId, requestId, 'litellm', { ok: true }, recordHash)

    // 8. Generate signed PDF receipt + email + R2 vault
    const receiptPdf = await generateErasureReceiptPdf({ email, requestId, agencyId, completedAt: new Date() })
    await uploadToR2(`erasure-receipts/${agencyId}/${requestId}.pdf`, receiptPdf)
    await sendEmail({ to: email, subject: 'CCPA Deletion Receipt', attachment: receiptPdf })
  }, /* connection */)
}
```

### Hash-chain audit (D-07 — Phase 2 + 10 pattern reuse)

```typescript
// packages/compliance/src/erasure/audit.ts (NEW)
import { createHash } from 'crypto'

async function writeAuditRow(agencyId, requestId, system, result, prevHash) {
  const ts = new Date().toISOString()
  const rowHash = createHash('sha256')
    .update(prevHash + requestId + system + ts + JSON.stringify(result))
    .digest('hex')
  await payload.create({
    collection: 'ccpa_erasure_records',
    data: { agency_id: agencyId, request_id: requestId, system, result, occurred_at: ts, prev_hash: prevHash, record_hash: rowHash },
    overrideAccess: true,
  })
  return rowHash
}
```

### `ccpa_erasure_records` collection — Payload + Drizzle (D-07)

```typescript
// packages/compliance/src/collections/ccpa-erasure-records.ts (NEW)
import type { CollectionConfig } from 'payload'
import { collectionAccess } from '../access/collection-access.js'  // copy verbatim from cms — Phase 9/10 pattern

export const ccpaErasureRecords: CollectionConfig = {
  slug: 'ccpa_erasure_records',
  access: { ...collectionAccess('ccpa_erasure_records'), delete: () => false },  // immutable per D-07
  fields: [
    { name: 'agency_id', type: 'text', required: true, admin: { position: 'sidebar', readOnly: true } },
    { name: 'request_id', type: 'text', required: true },
    { name: 'system', type: 'select', required: true, options: ['postgres','redis','r2','ga4','meta_capi','clarity','litellm'] },
    { name: 'result', type: 'json' },
    { name: 'occurred_at', type: 'date', required: true },
    { name: 'prev_hash', type: 'text' },
    { name: 'record_hash', type: 'text', required: true },
  ],
  admin: { group: 'Privacy', useAsTitle: 'request_id' },
}
```

### Receipt PDF (Phase 10 pdf-lib reuse)

```typescript
// packages/compliance/src/erasure/generate-pdf.ts (NEW)
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'  // Phase 10 reuse

export async function generateErasureReceiptPdf({ email, requestId, agencyId, completedAt }) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])  // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('CCPA Deletion Receipt', { x: 50, y: 780, size: 18, font, color: rgb(0,0,0) })
  page.drawText(`Email: ${email}`, { x: 50, y: 740, size: 11, font })
  page.drawText(`Request ID: ${requestId}`, { x: 50, y: 720, size: 11, font })
  page.drawText(`Agency: ${agencyId}`, { x: 50, y: 700, size: 11, font })
  page.drawText(`Completed: ${completedAt.toISOString()}`, { x: 50, y: 680, size: 11, font })
  // Hash-chain attestation block...
  return await pdf.save()  // Uint8Array
}
```

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 6.1 | **Erasure worker connects to per-agency Postgres but per-agency-Postgres clients are pre-built per-app** — worker process doesn't know how to connect to `web-fitness` Postgres if it's running in `web-main` app context. | Worker runs in dedicated `apps/worker-erasure` (NEW) with all 13 PgBouncer connection strings in env. Or — accept that the worker runs per-agency (one worker per app). Latter is simpler. |
| 6.2 | **Honoring legal hold across 7 systems** — different rules per system. E-sign records under ESIGN Act 7-year retention cannot be deleted regardless of CCPA request. | `legal_hold_rules` field on each per-agency `agencies` Payload row: `{ esign_retention_years: 7, hipaa_required: false, ... }`. Worker checks before each delete. |
| 6.3 | **GA4 User Deletion API takes `client_id` (anonymous), not email** — same as opt-out flow pitfall 5.2. | Capture and persist `client_id` ↔ email mapping in `consent_log` (or dedicated `analytics_identity_map` table). |
| 6.4 | **Email-verification token replay** — user clicks link twice, worker fires erasure twice. | One-time-use token: store `requestId` in Redis with `EX 86400`, check `SETNX` before processing. Phase 3 family-revocation pattern. |
| 6.5 | **PDF attachment > 25 MB email rejection** — receipt PDF is small but if we ever attach exported user data, smtp limits. | Receipt only: < 10 KB. Future export feature: link to R2 signed URL (90-day expiry). |
| 6.6 | **Erasure worker fails halfway through fan-out** — user data partially deleted, no rollback. | Hash-chain audit captures every system. Failed system = audit row with `result: { ok: false, error: ... }`. Worker retries on re-enqueue. Fan-out is idempotent per system (DELETE is idempotent). |

---

## Research item 7: CSP nonce per-request middleware (REQ-146)

### Recommended approach

Modify `packages/auth/src/middleware.ts` (already Edge-safe, jose-only) to generate nonce + inject CSP header. The shared middleware is already imported by all 12 agency apps (`apps/web-*/middleware.ts` re-exports `createAuthMiddleware()`), so the change applies uniformly.

[CITED: nextjs.org/docs/pages/guides/content-security-policy — official Next.js CSP nonce + middleware pattern]

### Edge-safe nonce generation

```typescript
// packages/auth/src/middleware.ts — EXTEND existing
const nonce = crypto.randomUUID()  // Web Crypto API — Edge-safe (CLAUDE.md rule 4)

const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://www.clarity.ms`,
  `style-src 'self' 'nonce-${nonce}'`,
  "img-src 'self' data: https://imagedelivery.net https://www.google-analytics.com",
  "connect-src 'self' https://api.cloudflare.com https://www.google-analytics.com https://*.clarity.ms https://cloudflareinsights.com",
  "frame-src 'self' https://js.stripe.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join('; ')

const requestHeaders = new Headers(req.headers)
requestHeaders.set('x-nonce', nonce)
const response = NextResponse.next({ request: { headers: requestHeaders } })

// D-08 Stage 1 — Report-Only at launch
response.headers.set(
  process.env.CSP_ENFORCING === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
  cspHeader,
)
```

### REPLACE existing static CSP — do NOT add second header

`packages/auth/src/security-headers.ts` (Phase 3 plan 03-04) currently sets a static `Content-Security-Policy` header inside `applySecurityHeaders()`. **The nonce middleware MUST remove this static set** — having both headers means the browser intersects them (most-restrictive wins) and the static `'unsafe-inline'` directive overrides the nonce, defeating the whole purpose.

Concrete change: delete the `h.set('Content-Security-Policy', ...)` block from `security-headers.ts`. Keep the other 6 security headers (HSTS, X-Frame-Options, X-XSS-Protection, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

### Reading nonce in layouts

```typescript
// apps/web-*/src/app/(frontend)/layout.tsx
import { headers } from 'next/headers'
import { NonceProvider } from '@mjagency/ui/nonce'  // NEW

export default async function PublicLayout({ children }) {
  const nonce = (await headers()).get('x-nonce') ?? ''
  return (
    <html>
      <body>
        <NonceProvider nonce={nonce}>
          {children}
          {/* Pass nonce to <Script> tags */}
          <Script id="ga4-init" nonce={nonce}>{`window.dataLayer = window.dataLayer || [];...`}</Script>
        </NonceProvider>
      </body>
    </html>
  )
}
```

### useNonce client hook

```typescript
// packages/ui/src/nonce/nonce-provider.tsx (NEW)
'use client'
import { createContext, useContext, type ReactNode } from 'react'

const NonceContext = createContext<string>('')
export function NonceProvider({ nonce, children }: { nonce: string; children: ReactNode }) {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>
}
export function useNonce(): string { return useContext(NonceContext) }
```

### CSP report endpoint

```typescript
// apps/web-main/src/app/api/csp-report/route.ts (NEW — also in all 12 agency apps)
import { sql } from '@mjagency/db'

export const runtime = 'nodejs'  // postgres-js requires Node, not Edge

export async function POST(req: Request) {
  // Browsers send Content-Type: application/csp-report (not JSON)
  const body = await req.text()
  const parsed = JSON.parse(body)
  const report = parsed['csp-report'] ?? parsed
  await sql`
    INSERT INTO csp_reports (received_at, document_uri, blocked_uri, violated_directive, original_policy, source_file, line_number, agency_slug)
    VALUES (NOW(), ${report['document-uri']}, ${report['blocked-uri']}, ${report['violated-directive']}, ${report['original-policy']}, ${report['source-file']}, ${report['line-number']}, ${process.env.NEXT_PUBLIC_AGENCY_SLUG})
  `
  return new Response(null, { status: 204 })
}
```

### Middleware matcher MUST exclude /api/csp-report

```typescript
// packages/auth/src/middleware.ts — config export
export const config = {
  matcher: [
    '/((?!_next|api/csp-report|api/rum|\\(payload\\)|admin).*)',
    // Note: /api/* is NOT excluded — auth still gates most APIs.
    // /api/csp-report and /api/rum are exceptions: public POST endpoints, no auth.
  ],
}
```

### `csp_reports` table (platform-wide, no agency_id RLS)

```typescript
// packages/db/src/schema/csp-reports.ts (NEW)
export const cspReports = pgTable('csp_reports', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  receivedAt: timestamp('received_at').defaultNow(),
  documentUri: text('document_uri'),
  blockedUri: text('blocked_uri'),
  violatedDirective: text('violated_directive'),
  originalPolicy: text('original_policy'),
  sourceFile: text('source_file'),
  lineNumber: integer('line_number'),
  agencySlug: text('agency_slug'),
})
```

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 7.1 | **Static CSP from security-headers.ts NOT removed** — both headers sent, static `'unsafe-inline'` wins, nonce ineffective. | Diff `packages/auth/src/security-headers.ts` to confirm `Content-Security-Policy` line is deleted. CI grep gate: `grep -n "h.set.'Content-Security-Policy'" packages/auth/src/security-headers.ts` returns 0. |
| 7.2 | **Pages with nonce CSP must be dynamically rendered** — Next.js cannot precompute pages with per-request nonces. Pages currently using `force-static` will break. | Audit `apps/web-*/src/app/(frontend)/**/*.tsx` for `export const dynamic = 'force-static'` — these pages cannot inject inline nonces. Fix: either (a) use external scripts only, or (b) `dynamic = 'force-dynamic'` per page. Phase 8 ISR pages use `revalidate = N` not `force-static` — they're SSR, dynamic nonces work. |
| 7.3 | **Puck builder uses inline `style={{...}}` heavily** — D-08 explicitly chose Report-Only for this reason. | Stage 1: Report-Only header. Stage 2: after 14 days of reports, either (a) refactor Puck blocks to use CSS classes, or (b) accept `'unsafe-inline'` in `style-src` (but NEVER in `script-src`). |
| 7.4 | **`unstable_cache` and `next/dynamic` import third-party scripts** — these may emit inline scripts without our nonce. | Whitelist domains in `script-src 'self' https://...` (already done above). `'strict-dynamic'` propagates trust to scripts loaded by trusted scripts. |
| 7.5 | **CSP report endpoint authenticated** — auth middleware redirects 100% of reports to `/login`, all reports lost. | Matcher exclusion above. Verify in CI: `curl -X POST /api/csp-report -H 'Content-Type: application/csp-report' -d '{}'` returns 204, not 302. |
| 7.6 | **Middleware adds `x-nonce` header with `request: { headers }` API** — Next.js 14.x used different signature. | Next.js 15 App Router uses `NextResponse.next({ request: { headers: requestHeaders } })` — verified pattern. |

---

## Research item 8: Cloudflare WAF + security rules (REQ-145)

### Recommended approach

Cloudflare Free tier covers v1 needs:
1. **Cloudflare Managed Ruleset** (free) — OWASP Core Rule Set, applied to all subdomains.
2. **Bot Fight Mode** (free) — challenges automated traffic from known-bad ASNs.
3. **WAF Custom Rules** (5 free rules per zone, scaling pro) — for app-specific rate limits.
4. **Rate Limiting Rules** (10 free rules per zone) — for endpoint-specific abuse.

### Custom rate-limit rules (D-loose recommended)

| Rule | Path | Threshold | Period | Action |
|------|------|-----------|--------|--------|
| Auth attempts | `/api/auth/login`, `/api/auth/refresh`, `/api/sso/*` | 10 | 1 min | Challenge |
| Public form posts | `/api/contact`, `/api/privacy/erasure-request`, `/api/privacy/verify`, `/api/ccpa/opt-out` | 5 | 1 min | Block |
| RUM ingest | `/api/rum` | 100 | 1 min | Block |
| Public reads | `/`, `/blog/*`, `/services/*` | 100 | 1 min | Challenge |
| CSP report | `/api/csp-report` | 50 | 1 min | Block |

### Custom firewall rules

```
# Block known bad bots (ad scrapers, content miners)
(http.user_agent contains "AhrefsBot") or (http.user_agent contains "SemrushBot")
→ Block

# Geo-block: US-only at v1 (PROJECT.md)
(ip.geoip.country ne "US")
→ Challenge   # Allow legit international visitors, block automated foreign traffic

# Block requests with x-middleware-subrequest header (CVE-2025-29927 layer 1 — already documented in 03-04)
(http.request.headers["x-middleware-subrequest"] ne "")
→ Block
```

### Configuration medium

Recommend Terraform via `cloudflare/cloudflare` provider for repeatable per-zone setup. Store config in `infra/cloudflare/` with one `.tf` per zone. Alternative: Cloudflare API + scripts in `scripts/cloudflare/`.

[CITED: developers.cloudflare.com/waf/managed-rules — Managed ruleset OWASP CRS available on free tier]

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 8.1 | **Geo-block of non-US challenges legitimate users on VPN** — unsolicited friction at launch. | Use Challenge (CAPTCHA), not Block, for non-US. Adjust per real traffic in week 2. |
| 8.2 | **Rate limit on `/api/contact` = 5/min/IP blocks legitimate office NAT** — single IP for 50-person company. | Combine with mTLS or session-cookie-based rate limiting via Cloudflare Workers if office traffic is mission-critical. v1: accept. |
| 8.3 | **Cloudflare WAF ruleset vs Next.js middleware order** — WAF runs FIRST at edge, BEFORE Next.js. Good for DDoS. | Confirm Cloudflare Worker / WAF executes before request reaches origin. Origin still must independently auth (CLAUDE.md rule 3). |
| 8.4 | **Bot Fight Mode false-positives** legitimate analytics (Google bot, Bingbot for SEO crawl). | Whitelist known good bots in WAF: `cf.client.bot` field is true for verified bots. |

---

## Research item 9: OWASP ZAP scan (REQ-147)

### Recommended approach

[CITED: github.com/zaproxy/action-baseline — official OWASP ZAP GitHub Action]

**Two-tier ZAP integration:**

1. **Per-PR baseline scan** — only against the changed app, gates merge on high-severity findings.
2. **Weekly full sweep** — all 13 sites against staging, results posted to internal channel.

### GitHub Action — per-PR

```yaml
# .github/workflows/zap-pr-scan.yml
name: ZAP Baseline (PR)
on:
  pull_request:
    paths:
      - 'apps/web-*/src/app/api/**'
      - 'apps/web-*/middleware.ts'
      - 'packages/auth/**'
      - 'packages/compliance/**'

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Detect changed app
        id: detect
        run: echo "app=$(git diff --name-only origin/main HEAD | grep -oP 'apps/\K[^/]+' | head -1)" >> $GITHUB_OUTPUT
      - name: Build + start changed app
        run: pnpm --filter=@mjagency/${{ steps.detect.outputs.app }} build && pnpm --filter=@mjagency/${{ steps.detect.outputs.app }} start &
      - name: Wait for app
        run: timeout 60 sh -c 'until curl -s http://localhost:3000/health; do sleep 1; done'
      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.15.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'  # tune false-positives
          fail_action: true   # gate merge on high-severity (-c flag)
          allow_issue_writing: false  # PR comment only, no GitHub issue spam
```

### `.zap/rules.tsv` for known acceptable warnings

```
# id  level   description
10038  IGNORE  CSP not enforced (D-08 Stage 1: Report-Only by design)
10063  IGNORE  Permissions-Policy not set on test endpoints
```

After D-08 Stage 2 (CSP enforcing), remove rule 10038.

### Weekly cron — full sweep

```yaml
# .github/workflows/zap-weekly.yml
name: ZAP Weekly Full Sweep
on:
  schedule:
    - cron: '0 6 * * 1'  # Monday 6am UTC
  workflow_dispatch:

jobs:
  zap-full:
    strategy:
      matrix:
        app: [web-main, web-ecommerce, web-realestate, web-healthcare, ...]
    runs-on: ubuntu-latest
    steps:
      - uses: zaproxy/action-baseline@v0.15.0
        with:
          target: 'https://${{ matrix.app }}.staging.mjagency.com'
          rules_file_name: '.zap/rules.tsv'
          fail_action: false  # cron — don't fail run, just report
```

### Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 9.1 | **ZAP scan hits `/api/csp-report` 1000× and writes 1000 rows** — pollutes csp_reports table. | Add `User-Agent: ZAP/*` rule in `/api/csp-report` POST handler: skip insert if UA matches. |
| 9.2 | **ZAP scan against production = real DoS** — 1-minute spider hits hundreds of URLs. | Cron runs ONLY against `staging.mjagency.com`. Production sweeps require manual approval + human-in-loop. |
| 9.3 | **`fail_action: true` on PR + scan finds existing high-severity** — every PR fails until fixed. | Triage existing findings in baseline run BEFORE enabling `fail_action: true`. Stage rollout: `fail_action: false` for week 1, then flip on. |
| 9.4 | **Rate-limit rules block ZAP** — WAF rule from item 8 blocks scan after 100 req/min. | ZAP runs against staging. Add staging IP to WAF whitelist OR run ZAP from inside the staging network (no WAF). |

---

## Research item 10: ADA / WCAG runtime guard (REQ-147 supplementary)

### Existing — Phase 8

`packages/testing/src/axe-test.ts` runs axe-core against all P0 page components. This catches static violations (missing alt text, missing labels, low contrast in token system).

### Phase 11 additions

1. **Runtime contrast checker for `var(--mj-*)` overrides** — catches the case where a per-agency theme overrides `--mj-color-text-primary` to a value that clashes with `--mj-color-bg-primary`. The Phase 4 OKLCH token system makes contrast deterministic; a CI test can compute `chroma-js` contrast ratio for every (text, bg) pair and assert ≥ 4.5:1.

```typescript
// packages/testing/src/wcag-contrast-test.ts (NEW)
import { contrast } from 'chroma-js'
import { resolveTheme } from '@mjagency/ui/theme'

export function assertWcagContrast(themeName: string) {
  const theme = resolveTheme(themeName)
  const pairs = [
    [theme.color.text.primary, theme.color.bg.primary],
    [theme.color.text.secondary, theme.color.bg.primary],
    [theme.color.text.link, theme.color.bg.primary],
    [theme.color.text.onBrand, theme.color.brand[500]],
    // ... 10 more critical pairs
  ]
  for (const [fg, bg] of pairs) {
    const ratio = contrast(fg, bg)
    if (ratio < 4.5) throw new Error(`WCAG AA fail: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`)
  }
}
```

Run for all 12 niche themes in CI (`pnpm test:wcag` runs 12 themes × 14 pairs = 168 assertions, < 100ms total).

2. **`aria-live` region pattern for dashboard 60s polling** — already specified in UI-SPEC Surface 1 §Accessibility (`aria-live="polite"` on `Last refresh: Ns ago` text). Plan 11-04 implementation must include this.

3. **Skip link** to `<main>` in dashboard view — Phase 8 pattern reuse.

---

## Cross-cutting: env var naming convention

| Pattern | Example | Where set |
|---------|---------|-----------|
| Per-agency public | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | per-app `.env.local` (Doppler dev) |
| Per-agency secret | `META_ACCESS_TOKEN_${SLUG_UPPER}` | Doppler prod, server-only |
| Slug normalization | `agencyId.replaceAll('-', '_').toUpperCase()` | env-var lookup helper |
| Helper | `getAgencySecret(name, agencyId)` | `packages/config/src/per-agency-env.ts` (NEW) |

```typescript
// packages/config/src/per-agency-env.ts (NEW)
export function getAgencySecret(prefix: string, agencyId: string): string {
  const key = `${prefix}_${agencyId.replaceAll('-', '_').toUpperCase()}`
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}
// Usage: getAgencySecret('META_ACCESS_TOKEN', 'web-ecommerce') → reads META_ACCESS_TOKEN_WEB_ECOMMERCE
```

## Cross-cutting: dependency additions

| Package | Version | Used by | Verified |
|---------|---------|---------|----------|
| `@google-analytics/data` | `^5.2.1` | packages/analytics | [VERIFIED: npm view 2026-04-28] |
| `@microsoft/clarity` | `^1.0.2` | packages/ui (browser) | [VERIFIED: npm view 2026-04-28] |
| `chroma-js` | `^3.1.0` | packages/testing (WCAG contrast) | [ASSUMED — verify before plan] |
| `pdf-lib` | `^1.17.1` (already installed) | packages/compliance | Already in packages/esign |
| `@aws-sdk/client-s3` | `^3.620.0` (already installed) | packages/compliance R2 | Already in packages/esign |
| `web-vitals` | `^5.2.0` (already installed) | packages/ui RUM | [VERIFIED: npm view 2026-04-28] |
| `jose` | `^6.2.3` (already installed) | packages/compliance erasure tokens | [VERIFIED: npm view 2026-04-28] |

NO new packages needed for: Meta CAPI (direct fetch), GTM server-side (Cloudflare Workers script — separate deployment, not NPM dep), CSP nonce (`crypto.randomUUID()` is built-in), OWASP ZAP (GitHub Action, no NPM dep).

## Cross-cutting: testing strategy

### Unit tests (Vitest)

| Module | Test focus |
|--------|-----------|
| `redactPii()` reuse for Clarity payloads | Already covered by Phase 7 (118 tests) |
| `sendCapiEvent()` Meta CAPI | Mock fetch; assert SHA-256 hashing, body shape, error on missing env |
| `createErasureToken / verifyErasureToken` | Round-trip; expiry; tampered token rejection |
| `useDashboardPolling()` hook | RTL + jsdom; assert pause on `visibilitychange` blur |
| Hash-chain audit | `prev_hash → record_hash` integrity across 7 systems |
| WCAG contrast for 12 themes | All pairs ≥ 4.5:1 |

### Integration tests

| Flow | Test focus |
|------|-----------|
| CCPA opt-out flow end-to-end | Mock GA4/Meta/Clarity Delete API; assert audit row written + cookie set + queue job emitted |
| CCPA erasure email-verification → confirm → fan-out | Token TTL, replay rejection, all 7 systems hit |
| Dashboard polling | Mock GA4 Data API; assert 60s tick, pause on blur, resume on focus |
| CSP report ingestion | Mock browser POST with `Content-Type: application/csp-report`; assert row in `csp_reports` |

### E2E tests (Playwright — Phase 12 scope)

| Flow | Test focus |
|------|-----------|
| User opens opt-out modal → confirms → page reloads with no GA4 `<script>` | Browser-level verification |
| User submits erasure form → receives email → clicks link → sees confirmation | Email + token round-trip |
| Super-admin views platform dashboard → switches to per-agency tab → URL navigates | Auth + tab navigation |

### CI gates

| Gate | When | Action on fail |
|------|------|---------------|
| Vitest unit | Every commit | Block merge |
| Integration tests | Every PR touching `/api/*` or middleware | Block merge |
| OWASP ZAP baseline | Every PR (per-app) | Block on high-severity |
| WCAG contrast | Every commit | Block merge |
| `grep "jsonwebtoken"` returns 0 | Every commit | Block merge (CLAUDE.md rule 2) |
| `grep "h.set.*Content-Security-Policy" packages/auth/src/security-headers.ts` returns 0 | After plan 11-07 | Block merge (Pitfall 7.1) |

## Project Constraints (from CLAUDE.md)

Phase 11 plans MUST honor these without exception. Each is enforced via existing CI gates from earlier phases — research is not introducing new constraints, only confirming compliance.

| # | Constraint | How Phase 11 honors |
|---|-----------|---------------------|
| 1 | Payload 3.82.1 exact pin | All new packages (`@mjagency/compliance`, `@mjagency/analytics`) declare `"payload": "3.82.1"` exact |
| 2 | jose only — no jsonwebtoken | Erasure email-verification token uses `jose` (item 6); CSP nonce middleware is jose-only path |
| 3 | Server actions auth-first | `requireSession()` first line in dashboard endpoints; HMAC token verify first line in CCPA confirm |
| 4 | Middleware = Edge runtime | CSP nonce generation uses `crypto.randomUUID()` (Web Crypto, Edge-safe) |
| 5 | Content-complete (no placeholder) | UI-SPEC Surface 3, 5 copy is real CCPA-compliant text; no Lorem ipsum |
| 6 | Anti-fabrication | Privacy page does not invent retention numbers; "30 days" is verifiable (matches CCPA legal max) |
| 7 | Security mandatory patterns | DOMPurify not needed (no SVG upload); HMAC verify used for erasure confirm; NEXT_PUBLIC_ check on every new env var; CSP nonce per-request |
| 8 | Agency isolation | All new tables (`csp_reports` exempt — platform-wide; `web_vitals`, `ccpa_erasure_records`, `consent_log` are per-agency) have `agency_id` + RLS |
| 9 | TypeScript strict, no any | Direct Meta CAPI fetch with explicit types over SDK any-types |
| 10 | Testing | Unit + integration + E2E breakdown above |

## Runtime State Inventory

This phase introduces NEW state to multiple stores. Inventory captured for plan completeness:

| Category | Items Added | Action Required |
|----------|-------------|------------------|
| **Stored data (Postgres)** | `web_vitals` (per-agency, NEW), `ccpa_erasure_records` (per-agency, NEW), `consent_log` (per-agency, NEW), `csp_reports` (platform, NEW) | 4 Drizzle migration files in `packages/db/migrations/` + RLS policies |
| **Stored data (Redis)** | `agency:<id>:dashboard:ga4:*` cache keys (TTL 5min); `agency:<id>:erasure:requestid:*` (TTL 24h, replay protection); `agency:<id>:rum:rate-limit:*` (TTL 1min, ingest throttle) | No migration; keys created on demand |
| **Stored data (R2)** | `erasure-receipts/{agency_id}/{request_id}.pdf` per completed CCPA erasure | Bucket already exists (Phase 10); add lifecycle policy: keep 7 years (audit retention) |
| **Live service config (NOT in git)** | Cloudflare WAF custom rules + rate limit rules per zone (13 zones); Cloudflare DNS A records `analytics.{subdomain}` per agency; GTM Server containers per agency (Cloud Run); GA4 properties per agency; Microsoft Clarity projects per agency; Meta pixels per agency | Item 8 — Terraform recommended; per-agency onboarding runbook |
| **OS-registered state** | None — no OS-level cron, daemon, or service registration introduced by Phase 11 | None |
| **Secrets / env vars (NEW per-agency, NOT in git)** | `GA4_API_SECRET_${SLUG}`, `GA4_PROPERTY_ID_${SLUG}`, `META_PIXEL_ID_${SLUG}`, `META_ACCESS_TOKEN_${SLUG}`, `META_TEST_EVENT_CODE_${SLUG}`, `CLARITY_API_TOKEN_${SLUG}`, `SGTM_ENDPOINT_${SLUG}`, `GOOGLE_APPLICATION_CREDENTIALS_PATH_${SLUG}`, `CSP_ENFORCING` (platform); per-agency public: `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Doppler config for all 13 projects + shared platform project |
| **Build artifacts / installed packages** | New workspace packages: `@mjagency/analytics`, `@mjagency/compliance` | `pnpm install` after package.json updates; CI verifies workspace resolution |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Cloudflare account + 13 zones | WAF, Workers, DNS, sGTM proxy | Assumed YES (Phase 1 + 8 already use Cloudflare) | — | None — blocking |
| Google Cloud project for sGTM hosting | GTM server-side container | Unknown | — | Stape.io managed (recurring cost) |
| GA4 properties × 13 | Per-agency analytics | Likely needs creation | — | Aggregated property + content_group dim (loses per-agency cleanliness) |
| Meta Business Manager + 13 pixels | CAPI per-agency | Likely needs creation | — | Skip Meta CAPI, defer to v2 |
| Microsoft Clarity projects × 13 | Heatmaps per-agency | Likely needs creation | — | Use 1 platform-wide project + custom dim per agency |
| Doppler workspace | Per-agency env injection | Pending — Plan 01-06 deferred per STATE.md | — | `.env.local` files (Phase 1 fallback) |
| Postgres × 13 | New tables (web_vitals, ccpa_erasure_records, consent_log) | Available (Phase 2) | — | None |
| Redis × 13 | Cache + rate limit | Available (Phase 1) | — | None |
| R2 buckets × 13 | Erasure receipts | Available (Phase 10) | — | None |
| Node.js 22 LTS | All packages | Available (Phase 1) | 22 | None |
| `jose@6.2.3` | Erasure tokens | Available | 6.2.3 | None |
| `pdf-lib@1.17.1` | Receipt PDF | Available (Phase 10 esign) | 1.17.1 | None |

**Blocking dependencies** (must be procured before Phase 11 launch, but not before plan creation):
- 13 GA4 properties + Measurement IDs
- 13 Meta pixel + access token pairs
- 13 Microsoft Clarity projects
- 1 GTM Server container per agency hosting decision (Cloud Run vs Stape)

These are external service registrations, not engineering blockers. Plans should reference env var names; secrets land in Doppler at deploy.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.6+ (already in @mjagency/testing) + Playwright (Phase 12 scope) |
| Config file | `vitest.config.ts` per package; root config in `packages/testing/` |
| Quick run command | `pnpm test --filter=@mjagency/compliance` (or analytics, etc.) |
| Full suite command | `pnpm -r test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-140 | GA4 server event sends with correct shape | unit | `pnpm test --filter=@mjagency/analytics ga4` | NO — Wave 0 |
| REQ-141 | Clarity initialized only when consent allows | unit | `pnpm test --filter=@mjagency/ui clarity` | NO — Wave 0 |
| REQ-142 | Meta CAPI hashes em correctly + dedup event_id | unit | `pnpm test --filter=@mjagency/analytics meta-capi` | NO — Wave 0 |
| REQ-143 | Dashboard SSR + 60s polling | integration | `pnpm test --filter=@mjagency/cms dashboard-view` | NO — Wave 0 |
| REQ-144 | CCPA opt-out flow end-to-end | integration | `pnpm test --filter=@mjagency/compliance opt-out-flow` | NO — Wave 0 |
| REQ-144 | Erasure worker fan-out 7 systems | integration | `pnpm test --filter=@mjagency/compliance erasure-worker` | NO — Wave 0 |
| REQ-145 | WAF rules deployed (terraform plan) | integration | `terraform -chdir=infra/cloudflare plan -detailed-exitcode` | NO — Wave 0 |
| REQ-146 | CSP nonce present + matches in script tags | integration | `pnpm test --filter=@mjagency/auth csp-nonce` | NO — Wave 0 |
| REQ-146 | CSP report endpoint accepts violations | unit | `pnpm test --filter=@mjagency/cms csp-report-route` | NO — Wave 0 |
| REQ-147 | OWASP ZAP baseline zero high-severity | integration | `gh workflow run zap-pr-scan.yml` | YES (workflow file new in 11-07) |

### Sampling Rate
- **Per task commit:** Quick run for changed package (`pnpm test --filter=@mjagency/{pkg}`)
- **Per wave merge:** Full suite (`pnpm -r test`) + WCAG contrast (`pnpm test:wcag`)
- **Phase gate:** Full suite green + ZAP scan zero high-severity + Playwright E2E (Phase 12)

### Wave 0 Gaps
- [ ] `packages/analytics/` package — does not exist; create scaffold first
- [ ] `packages/compliance/` package — does not exist; create scaffold first
- [ ] `packages/db/src/schema/web-vitals.ts` — table does not exist
- [ ] `packages/db/src/schema/ccpa-erasure-records.ts` — table does not exist
- [ ] `packages/db/src/schema/consent-log.ts` — table does not exist
- [ ] `packages/db/src/schema/csp-reports.ts` — table does not exist
- [ ] `infra/cloudflare/` directory — does not exist; Terraform setup needed if chosen path
- [ ] `.zap/rules.tsv` — does not exist; ZAP rules file
- [ ] `.github/workflows/zap-pr-scan.yml` — does not exist
- [ ] `.github/workflows/zap-weekly.yml` — does not exist

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Phase 3 `requireSession()` (already shipped) — used in dashboard endpoints |
| V3 Session Management | YES | Phase 3 jose-based JWT (already shipped) — extended for erasure tokens |
| V4 Access Control | YES | RLS on `web_vitals`, `ccpa_erasure_records`, `consent_log`; super-admin guard on platform dashboard view |
| V5 Input Validation | YES | Erasure email validated (RFC-5322 regex); CSP report JSON parsed defensively; CAPI event_name `[a-z_]{1,40}` |
| V6 Cryptography | YES | SHA-256 for Meta CAPI hashing, IP hashing, hash-chain audit; `crypto.randomUUID()` for nonce + event_id |
| V7 Error Handling | YES | Erasure worker writes audit row on every system success/fail; partial fan-out failures captured |
| V8 Data Protection | YES | Erasure receipts AES-encrypted at rest in R2 (Phase 10 pattern); BullMQ jobs `sensitiveData: true` |
| V9 Communication | YES | HSTS already shipped (Phase 3); TLS 1.2+ via Cloudflare |
| V10 Malicious Code | YES | CSP nonce defeats inline XSS; CSP report endpoint surfaces violations |
| V11 Business Logic | YES | Email-verification token one-time-use (Redis SETNX); legal-hold check before erasure delete |
| V12 Files and Resources | YES | R2 receipt upload uses signed URLs; bucket private |
| V13 API and Web Service | YES | All `/api/*` routes have rate limit (item 8); CSP report endpoint POST-only |
| V14 Configuration | YES | Doppler secret injection; CI grep gates for forbidden patterns |

### Known Threat Patterns for {Next.js + Payload + Cloudflare}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data leak via shared cache | Information Disclosure | Per-agency Redis prefix `agency:<id>:*` (Phase 1 pattern); cache keys never lack agency prefix |
| Email-verification token replay | Spoofing | Redis SETNX on requestId; 24h TTL via jose `setExpirationTime` |
| CSP bypass via inline event handler | Tampering / EoP | `'strict-dynamic'` in script-src; nonce on every script; report-uri captures violations |
| Erasure worker partial-failure leaves orphaned data | Repudiation | Hash-chain audit per system; failed system requeued |
| WAF bypass via direct origin connection | EoP | Cloudflare authenticated origin pulls (mTLS) — DOCS task in 11-06; without it, scrapers can hit origin IP directly |
| Meta CAPI token theft | Information Disclosure | Tokens in Doppler only; never in `NEXT_PUBLIC_*`; rotation runbook |
| Dashboard SSRF via untrusted GA4 property ID | Tampering | property ID derived from session.agencyId, not user input |
| CSP report flooding | DoS | Rate limit 50/min/IP at Cloudflare WAF; ZAP UA filter at handler |
| Clarity DOM masking bypass via `data-clarity-mask=false` injection | Information Disclosure | DOMPurify on user-generated HTML (already shipped); CSP `strict-dynamic` blocks injected scripts |
| Browser pixel inadvertently re-enabled (Meta) | Information Disclosure | D-10 explicit: NO browser pixel; CSP allowlist excludes Meta domains; CI grep gate ensures no `<script src=".*facebook">` in apps |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `chroma-js@^3.1.0` is current and Edge-compatible | Cross-cutting deps | LOW — easy version swap; can use built-in OKLCH math instead |
| A2 | All 12 agency apps already inherit shared middleware via `@mjagency/auth/middleware` re-export (one place to change CSP) | Item 7 | MEDIUM — verified for `web-ecommerce`; other 11 assumed identical based on Phase 3 plan 03-04 |
| A3 | Cloudflare account is on Free tier with WAF Custom Rules + Rate Limiting available | Item 8 | MEDIUM — Pro tier ($20/mo/zone × 13 = $260/mo) needed if Free quota exceeded |
| A4 | GTM Server-Side container will be self-hosted on Google Cloud Run | Item 1 | LOW — Stape.io managed is a drop-in alternative |
| A5 | Microsoft Clarity NPM `@microsoft/clarity@1.0.2` is Edge-runtime safe (no Node-only imports) | Item 2 | MEDIUM — fallback to legacy `<script>` tag if not |
| A6 | Phase 8 ISR pages do NOT use `force-static` (only `revalidate = N`) | Item 7 (Pitfall 7.2) | MEDIUM — verified via Phase 8 plan; CSP nonce requires dynamic rendering |
| A7 | All 12 agencies have separate GA4 properties (not subviews of one property) | Item 1 | LOW — Free tier supports 100 properties per Google account |
| A8 | Cloud Run + sGTM is acceptable to operate (vs purchasing Stape.io) | Item 1 | LOW — cost difference $5-15/mo vs $20-100/mo per container |
| A9 | `NEXT_PUBLIC_AGENCY_SLUG` env var is set in every app's runtime config | Multiple items | LOW — Phase 8 STATE confirms this pattern is established |
| A10 | Cloudflare Authenticated Origin Pulls / Tunnel is configurable to lock origin to CF-only traffic | Item 8 (threat) | MEDIUM — without it, ZAP rate limit bypass is possible |
| A11 | `crypto.randomUUID()` exists in Cloudflare Workers + Next.js Edge runtime | Item 7 | LOW — both runtimes implement Web Crypto API; verified |

## Open Questions (RESOLVED)

1. **Should Plan 11-04 RUM dashboard data come from GA4 Data API (5-60min lag) or new `web_vitals` Postgres table (live)?**
   - What we know: CONTEXT.md D-12 says `web_vitals events table`. Phase 8 did not build the table.
   - What's unclear: Was D-12 a planning hypothesis or an explicit requirement? UI-SPEC Surface 1 caption says "LCP p75 (last 24 hours)" — implies sub-second freshness, which favors the new table.
   - Recommendation: Build the table (Critical Discovery section). Small effort (~15 min), big freshness gain.
   - **RESOLVED:** Build new `web_vitals` Postgres table. Plan 11-07 builds it (T-01 schema + migration + /api/rum endpoint), Plan 11-04 reads percentile_cont(0.75) from it.

2. **Where does the CCPA erasure worker run?**
   - What we know: Worker must connect to all 12 per-agency Postgres + Redis + R2.
   - What's unclear: Single dedicated `apps/worker-erasure` process? Or one worker per agency app?
   - Recommendation: Per-agency worker (each `apps/web-*` runs its own erasure worker for its own data) — simpler, avoids cross-tenant connection management. Fan-out to GA4/Meta/Clarity is by HTTP, identical regardless of worker location.
   - **RESOLVED:** Per-agency worker. Each `apps/web-*` runs its own erasure worker connecting only to its own Postgres + Redis + R2.

3. **Which Cloudflare WAF tier — Free or Pro?**
   - What we know: Free has 5 custom rules + 10 rate limit rules per zone; Pro has more + better managed rules.
   - What's unclear: Whether v1 traffic justifies Pro tier across 13 zones ($260/mo).
   - Recommendation: Free tier for v1 launch; upgrade to Pro per zone if abuse warrants. Document upgrade trigger in 11-06 SUMMARY.
   - **RESOLVED:** Free tier for v1 launch. Per-zone Pro upgrade trigger documented in Plan 11-06 SUMMARY.

4. **Should every agency app deploy `/privacy/erasure` or only brand.com?**
   - What we know: D-04 says "every agency subdomain + brand.com" (13 routes).
   - What's unclear: Does erasure submitted on `web-ecommerce.mjagency.com` only erase ecommerce data, or all 12?
   - Recommendation: Per-agency erasure (each subdomain erases its own data). Cross-agency erasure requires explicit user request via brand.com (unified privacy hub) — defer to a future phase or document explicitly in `/privacy` page.
   - **RESOLVED:** Per-agency scope. Each subdomain erases only its own data. Cross-agency unified hub deferred to a future phase; documented on `/privacy` page.

5. **CSP `'strict-dynamic'` vs explicit allowlist for `script-src`?**
   - What we know: D-09 says strict-dynamic; D-10 says explicit allowlist of 4 domains.
   - What's unclear: These are technically different defenses. `strict-dynamic` says "trust scripts loaded by trusted scripts" and IGNORES domain allowlist. Explicit allowlist + nonce is the safer combination.
   - Recommendation: Use BOTH. `script-src 'nonce-X' 'strict-dynamic' https://googletagmanager.com https://clarity.ms ...`. CSP3 says explicit allowlist is ignored when `'strict-dynamic'` is present, but listing them as fallback for CSP2 browsers is harmless.
   - **RESOLVED:** Use BOTH — `'nonce-X' 'strict-dynamic'` plus explicit allowlist of 4 domains. CSP3 browsers honor strict-dynamic; CSP2 browsers fall back to allowlist.

## Sources

### Primary (HIGH confidence)
- [CLAUDE.md](C:/Users/jamshaid_pph/ClaudeMJ/CLAUDE.md) — security mandatory patterns, agency isolation, jose-only mandate
- [STATE.md decisions log](C:/Users/jamshaid_pph/ClaudeMJ/.planning/STATE.md) — Phase 7 LITELLM_API_KEY_${AGENCY_ID} per-agency env pattern
- [Phase 7 PII redactor SUMMARY](C:/Users/jamshaid_pph/ClaudeMJ/.planning/phases/07-ai-assistant/07-05-SUMMARY.md) — `redactPii()` API for reuse
- [Phase 8 WebVitalsReporter](C:/Users/jamshaid_pph/ClaudeMJ/packages/ui/src/rum/web-vitals.tsx) — current implementation (GA4-only, no /api/rum)
- [Phase 9 createEncryptedQueue](C:/Users/jamshaid_pph/ClaudeMJ/packages/queue/src/encrypted-queue.ts) — encrypted BullMQ pattern for sensitiveData jobs
- [Phase 10 hash-chain audit pattern](C:/Users/jamshaid_pph/ClaudeMJ/.planning/phases/10-tools-pitch-builder/10-05-SUMMARY.md) — `prev_hash + record_hash` pattern
- [Phase 3 auth middleware](C:/Users/jamshaid_pph/ClaudeMJ/packages/auth/src/middleware.ts) — Edge-safe middleware factory + matcher pattern
- [Phase 3 security headers](C:/Users/jamshaid_pph/ClaudeMJ/packages/auth/src/security-headers.ts) — current static CSP that must be removed in 11-07

### Secondary (MEDIUM-HIGH confidence — official docs)
- [Next.js CSP guide](https://nextjs.org/docs/pages/guides/content-security-policy) — official nonce + middleware pattern
- [Google Analytics Data API client](https://www.npmjs.com/package/@google-analytics/data) — `@google-analytics/data@5.2.1`
- [Microsoft Clarity NPM blog](https://clarity.microsoft.com/blog/npm-integration/) — official package release
- [Meta Conversions API docs](https://developers.facebook.com/docs/marketing-api/conversions-api/) — Graph API endpoint, hashing requirements
- [GA4 User Deletion API](https://developers.google.com/analytics/devguides/config/userdeletion/v3) — deletion endpoint reference
- [zaproxy/action-baseline](https://github.com/zaproxy/action-baseline) — official OWASP ZAP GitHub Action
- [Cloudflare Managed Ruleset](https://developers.cloudflare.com/waf/managed-rules/) — OWASP CRS in Free tier

### Tertiary (MEDIUM — community resources verified independently)
- [GA4 user deletion guide — Loves Data](https://www.lovesdata.com/blog/google-analytics-user-deletion-api/) — supplementary reference
- [Meta CAPI 2026 setup guide — Ingest Labs](https://ingestlabs.com/blogs/meta-capi-setup-complete-implementation-guide-for-facebook-conversion-api-2026/) — current best practice confirmation
- [Cloudflare Workers + sGTM proxy — owntag](https://www.owntag.eu/blog/same-origin-cloudflare-worker-proxy/) — same-origin sGTM via Cloudflare reference

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack (Items 1-3) | HIGH | All package versions verified via npm view 2026-04-28; reuse of established Phase 7-10 primitives |
| Architecture patterns (Items 4, 7) | HIGH | Payload custom view + Edge middleware pattern documented in Phase 3 + 5 SUMMARYs; Next.js CSP nonce officially documented |
| Item 4 RUM data source | MEDIUM | Critical Discovery requires planner confirmation: build new web_vitals table OR accept GA4 Data API lag |
| CCPA fan-out (Items 5-6) | HIGH | Reuses Phase 9 + 10 patterns 1:1; novel logic is the orchestration sequence and hash-chain |
| WAF + ZAP (Items 8-9) | MEDIUM | Cloudflare Free tier sufficient for v1 — needs validation against actual quotas; ZAP `fail_action: true` triage path documented but assumes baseline run finds <5 high-severity initially |
| ADA / WCAG (Item 10) | HIGH | Phase 4 OKLCH tokens make contrast deterministic; new test is mechanical |
| Per-agency env var pattern | HIGH | Established Phase 7 pattern (LITELLM_API_KEY_${AGENCY_ID}); Phase 11 mirrors |
| Pitfalls | HIGH | Each pitfall traced to a specific concrete failure mode; mitigations are concrete |

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable subdomain — analytics SDKs and CCPA legal landscape are slow-moving; refresh if delay > 30 days)

---
*Phase: 11-analytics-compliance-security*
*Researched: 2026-04-28*
