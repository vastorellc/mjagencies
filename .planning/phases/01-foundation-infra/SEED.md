# Phase 1 Seed — Foundation + Infra

**Source:** `mjagency/specs/milestone-M001.md`
**Status:** Pre-discuss seed. `/gsd-discuss-phase 1` will produce the formal `01-CONTEXT.md` from this seed plus user Q&A.

This file is INPUT to the discuss-phase workflow, not a substitute for it. It captures the decisions already locked in the GSD-2 milestone spec so the discuss agent doesn't re-ask them.

## Phase Boundary (from M001 spec)

Working monorepo with all 13 apps scaffolded. Docker Compose for local dev running. Cloudflare pipeline connected. CI/CD pipeline live with test gates. OTel traces flowing to Grafana. All secrets in Doppler.

## Locked Decisions (from M001 spec)

### Slice 1 — Turborepo monorepo scaffold
- Turborepo + pnpm workspaces (`turbo.json` pipeline, `pnpm-workspace.yaml`)
- 12 agency apps + 13 packages directories
- Shared `tsconfig.json`, `eslint.config.js`, `.prettierrc`
- Next.js 15 App Router base template (`apps/web-main`) with Payload CMS 3.82.1 embedded via `withPayload()`, TypeScript strict, Tailwind v4
- Verify: `pnpm dev --filter=@mjagency/web-main` works
- 11 remaining agency apps extend `web-main`, with `AGENCY=<slug>` env loading and niche theme placeholders
- Hosts file documentation for local subdomain routing

### Slice 2 — Docker Compose + local dev
- PostgreSQL 17: ONE shared instance with 13 databases (`brand_db`, `ecommerce_db`, …, `graphic_db`)
- Redis: single instance, namespaced per agency
- Mailhog (email testing), Stripe CLI (webhook forwarding), PgAdmin (dev only)
- 13 PgBouncer configs — transaction mode, pool_size=20, ports 6432–6444 (`brand=6432`, `ecommerce=6433`, …)
- PM2 config for PgBouncer processes

### Slice 3 — Cloudflare pipeline (M001 stops at scaffolds + types)
- `packages/media`: CF Images API client (server-side only, never browser), signed upload URL generator, BlurHash util, AVIF variant config
- `packages/builder`: Puck dependency installed, types only at M001 (full builder ships in M010)
- `packages/tools`: calculator engine interface + types only at M001 (full tools in M010)
- CF Stream + R2 setup: video upload + encoding pipeline, R2 client for asset storage + backup
- Cache tag helpers: `agency:<id>:asset:<id>`

### Slice 4 — OpenTelemetry + Observability
- `@opentelemetry/sdk-node` lives in `packages/config`
- `trace_id` propagation via `traceparent` header
- Pino transport with `trace_id` injection
- DB query comment injection: `/* trace_id=X */`
- Pino redact config — tokens, emails, phones, secrets
- Docker Compose: Prometheus + Loki + Grafana + Tempo
- Next.js `/api/metrics` endpoint (Prometheus scrape)
- Basic dashboards: request rate, error rate, latency

### Slice 5 — CI/CD pipeline
- GitHub Actions: `pnpm install` + build on PR
- Vitest unit tests (`packages/testing`)
- ESLint + TypeScript type check
- Bundle size check (CI fails if unexpected growth)
- **Version-pin gate:** `pnpm list payload | grep 3.82.1 || exit 1`
- Security CI: `npm audit` (fail on high), `grep NEXT_PUBLIC_.*KEY` (must return 0), `grep jsonwebtoken` (must return 0; jose only), `grep dangerouslySetInnerHTML` from user content

### Slice 6 — Secrets Management (Doppler)
- Per-agency Doppler project: `mjagency-ecommerce`, `mjagency-growth`, … (12 total)
- Shared Doppler project: `mjagency-shared`
- Each agency app reads own project + shared project
- Per-agency: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CALCOM_API_KEY`, `DOPPLER_TOKEN` (at deploy)
- Shared: `REDIS_URL`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `LITELLM_API_KEY`, `PINO_LEVEL` (default `info`)
- **Banned:** any `NEXT_PUBLIC_` prefix on secrets
- CI: Doppler CLI injects secrets at build time
- Local dev: `.env.local` mirrors Doppler (not committed)
- Rotation plan: JWT_SECRET quarterly (overlap until expiry), API keys on team offboarding, Stripe annually or on exposure — runbook required

## Success Criteria (from M001 spec, mirrored in ROADMAP.md Phase 1)

1. `pnpm dev --filter=@mjagency/web-main` starts without error
2. Docker Compose: all services healthy
3. CF Images: test upload returns AVIF URL
4. OTel: trace visible in Grafana Tempo
5. CI: full pipeline passes on main branch
6. `pnpm list payload` shows exactly 3.82.1

## Canonical References

- `mjagency/specs/milestone-M001.md` — full M001 spec (this seed extracted from it)
- `mjagency/PROJECT.md` — locked stack + architecture model
- `mjagency/CLAUDE.md` — non-negotiable coding rules (Payload pin, jose-only, server-action auth pattern, etc.)
- `mjagency/AGENTS.md` — GSD-2 agent routing per task type
- `mjagency/specs/architecture.md` — architecture spec
- `mjagency/specs/security.md` — security spec
- `mjagency/specs/gsd-config.md` — GSD-2 config
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — `.planning/` mirror

## Open Questions for `/gsd-discuss-phase 1`

The discuss agent should drive decisions on:
- Branch strategy: M001 spec says `milestone/M001-foundation-infra` — confirm and lock the per-milestone branch convention
- Postgres deployment for local dev: M001 spec says ONE shared instance with 13 DBs (not 13 instances) — confirm this matches Phase 2's per-agency PgBouncer expectation
- Doppler tier and access provisioning (free tier sufficient for v1?)
- VPS provisioning timing — provision during Phase 1 or defer to Phase 12?
- CI runner choice: GitHub-hosted vs. self-hosted on the VPS
- Minimum Node version pin (>= 22.x explicit in `package.json` engines?)
