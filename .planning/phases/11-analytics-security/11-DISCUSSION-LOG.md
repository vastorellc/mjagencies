# Phase 11: Analytics + Compliance + Security - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 11-analytics-security
**Areas discussed:** Consent + tracking model, CCPA erasure flow, CSP enforcement strictness, Analytics dashboard depth

---

## Consent + tracking model

### Q1: Tracking model — what loads by default for visitors?

| Option | Description | Selected |
|--------|-------------|----------|
| CCPA opt-out (default-on) | GA4/Clarity/Meta CAPI load on first visit. Footer "Do Not Sell" link → stops tracking and clears data. Standard for US-only sites. | ✓ |
| Opt-in cookie banner (default-off) | No tracking until user accepts. Loses ~30–50% of analytics data. Future-proofs international. | |
| Hybrid: load essential only, ask for rest | Server-side analytics by default; ask consent for marketing pixels. | |

### Q2: Where does consent state live?

| Option | Description | Selected |
|--------|-------------|----------|
| Cookie + React Context | mj_consent cookie, ConsentProvider, useConsent() hook. SSR-safe, no flash. | ✓ |
| localStorage + client-only check | All gates client-side. Brief tracker load before opt-out honored. | |
| Per-agency override (default platform) | Platform cookie + per-agency override in Payload (e.g., healthcare). | |

### Q3: How is revocation handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Server endpoint + immediate purge | POST /api/ccpa/opt-out → cookie + GA4 deletion + Meta deletion + Clarity API. | ✓ |
| Client-only — just stop loading scripts | Cookie set, future loads skip pixels. No retroactive deletion. | |
| Hybrid: client-stop + queue server purge | Stop scripts immediately, BullMQ job purges within 24h. | |

---

## CCPA erasure flow

### Q1: How do users initiate a CCPA erasure request?

| Option | Description | Selected |
|--------|-------------|----------|
| Public web form + email verify | Public form at /privacy/erasure. Email verification link. No login required. | ✓ |
| Authenticated portal only | User must log in. Blocks anonymous visitors who never registered. | |
| Email-to-privacy@ + manual triage | Mailto link, agency owner manually fields requests. Risks SLA misses. | |

### Q2: Fan-out scope when erasure runs?

| Option | Description | Selected |
|--------|-------------|----------|
| Full fan-out (all systems) | Postgres + Redis + R2 + GA4 + Meta CAPI + Clarity + LiteLLM logs. Hash-chained audit per system. | ✓ |
| Postgres + Redis only | Primary stores only. Marketing pixel data left intact. | |
| Configurable per-agency policy | Each agency sets retention rules in Payload. | |

### Q3: Published SLA?

| Option | Description | Selected |
|--------|-------------|----------|
| 30 days (Recommended) | Promise 30, target 7. Beats CCPA legal max with margin. | ✓ |
| Quote legal max: 45 days | Match CCPA statute exactly. | |
| Best-effort 7 days, no formal SLA | Don't publish formal SLA. | |

### Q4: Audit trail proof?

| Option | Description | Selected |
|--------|-------------|----------|
| Hash-chained record per system | Phase 2 + Phase 10 pattern. ccpa_erasure_records table. Signed completion PDF. | ✓ |
| Single completion log entry | One row per request, status=completed. Less defensible. | |
| BullMQ job history only | BullMQ logs as audit. Jobs expire — no long-term record. | |

---

## CSP enforcement strictness

### Q1: CSP rollout strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Report-only → enforce | CSP-Report-Only at launch + Sentry endpoint. 2 weeks of collection, then enforce. | ✓ |
| Strict CSP from day one | Enforcing at launch. Maximum security but breakage risk. | |
| Strict on public, relaxed in /admin | Strict on public pages, looser in admin (Puck). | |

### Q2: Per-request nonce strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Middleware → header → React Context | crypto.randomUUID() in middleware, headers() in layout, NonceProvider, useNonce() hook. SSR-safe. | ✓ |
| Per-page generation in layouts | Each route segment generates own nonce. Mismatches with middleware. | |
| Pre-generated nonces (build-time) | Hash-based CSP. Breaks for dynamic styles. | |

### Q3: Allowlist for 3rd-party domains?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal + explicit | GA4, Clarity, Stripe, Cloudflare Insights only. Meta CAPI server-side, no browser pixel. | ✓ |
| Use server-side container as proxy | Single 1st-party endpoint. Maximum tightness, more infra. | |
| Default-allow common SaaS | Permissive starter list. Easier; harder to defend. | |

---

## Analytics dashboard depth

### Q1: What does the per-agency dashboard show?

| Option | Description | Selected |
|--------|-------------|----------|
| Full business KPIs | Traffic + RUM + leads + deals + revenue. Primary product surface. | ✓ |
| RUM + traffic only (technical) | LCP/INP/CLS, GA4 traffic, top pages. Technical only. | |
| RUM + traffic + leads only (no $) | Add lead counts but no deal/revenue. Compromise scope. | |

### Q2: Where does dashboard data come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: GA4 API + Postgres aggregates | GA4 Data API + Postgres + Phase 8 web-vitals. | ✓ |
| GA4 API only | Slow + capped. | |
| Build a warehouse | BullMQ ingests GA4 events into per-agency analytics schema. Phase 12+. | |

### Q3: Where does dashboard live?

| Option | Description | Selected |
|--------|-------------|----------|
| Payload admin | Custom Payload admin view at /admin/dashboard. Single auth. | ✓ |
| Standalone /dashboard route + own auth | Separate Next.js route, own login. Duplicates auth + UI shell. | |
| Embed in marketing site as logged-in /me | Mixes public and private experiences. | |

### Q4: Update cadence?

| Option | Description | Selected |
|--------|-------------|----------|
| Near-realtime | Polls every 60s while page open. No websockets. | ✓ |
| Static SSR + manual refresh | Render once, manual refresh button. Feels stale. | |
| Realtime via Server-Sent Events | SSE stream. Overkill for agency owner use. | |

---

## Claude's Discretion

User did not ask about these — Claude's stack/best-practice judgment:
- **GTM server-side container hosting:** Cloudflare Workers (already in stack at edge)
- **Microsoft Clarity DOM masking:** mask-all-by-default + Phase 7 redactPii reuse
- **Cloudflare WAF:** Managed Ruleset + Bot Fight Mode + per-route rate limits
- **OWASP ZAP scan:** CI gate on /api/middleware PRs + weekly baseline
- **Meta CAPI/Pixel dedup:** event_id = crypto.randomUUID() per server event

## Deferred Ideas

- A/B testing platform (post-v1 phase)
- Custom analytics warehouse (Phase 12+)
- Realtime SSE dashboard updates (60s polling sufficient v1)
- ML-driven attribution
- Per-agency stricter rules beyond healthcare legal hold (configurable, no UI v1)
- International GDPR opt-in (only on geographic expansion)
- External pen test (coordinated with Phase 12 launch QA, not 11-07)
