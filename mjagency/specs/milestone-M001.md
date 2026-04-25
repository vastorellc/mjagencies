MILESTONE M001 - FOUNDATION + INFRA
Branch: milestone/M001-foundation-infra
Model: claude-opus-4-6 (architecture milestone)
Depends on: nothing (first milestone)

==============================================================
GOAL
==============================================================
Working monorepo with all 13 apps scaffolded.
Docker Compose for local dev running.
Cloudflare pipeline connected.
CI/CD pipeline live with test gates.
OTel traces flowing to Grafana.
All secrets in Doppler.

==============================================================
SLICES + TASKS
==============================================================
SLICE 1: Turborepo monorepo scaffold
  Task 1.1: Initialize Turborepo + pnpm workspaces
    - Create turbo.json with pipeline config
    - Create pnpm-workspace.yaml
    - Create all 12 apps + 13 packages directories
    - Shared tsconfig.json, eslint.config.js, .prettierrc
    - Root package.json with workspace scripts
  Task 1.2: Base Next.js 15 app template (web-main)
    - Next.js 15 App Router setup
    - Payload CMS 3.82.1 embedded via withPayload()
    - TypeScript strict mode
    - Tailwind CSS v4
    - Verify: pnpm dev --filter=@mjagency/web-main works
  Task 1.3: Scaffold remaining 11 agency apps
    - Each extends web-main template
    - Agency-specific env var loading (AGENCY=ecommerce)
    - Niche theme token placeholders
    - Hosts file documentation for local subdomain routing

SLICE 2: Docker Compose + local dev
  Task 2.1: Docker Compose setup
    - PostgreSQL 17: one shared instance with 13 databases
      (brand_db, ecommerce_db, growth_db, ... graphic_db)
    - Redis: single instance (namespaced per agency)
    - Mailhog: email testing
    - Stripe CLI: webhook forwarding
    - PgAdmin: DB inspection (dev only)
  Task 2.2: PgBouncer per agency
    - 13 PgBouncer configs (one per agency)
    - Transaction mode, pool_size=20
    - Port mapping: brand=6432, ecommerce=6433...
    - PM2 config for PgBouncer processes

SLICE 3: Cloudflare pipeline
  Task 3.1: Cloudflare Images + R2 SDK setup
    - packages/media package scaffold
    - CF Images API client (server-side only, never browser)
    - Signed upload URL generator
    - BlurHash computation utility
    - AVIF variant derivation config
    - packages/builder package scaffold (Puck dependency installed, types only at M001)
    - packages/tools package scaffold (calculator engine interface + types)
  Task 3.2: Cloudflare Stream + R2 setup
    - Video upload + encoding pipeline
    - R2 client for asset storage + backup
    - Cache tag helpers: agency:<id>:asset:<id>

SLICE 4: OpenTelemetry + Observability
  Task 4.1: OTel setup
    - @opentelemetry/sdk-node in packages/config
    - trace_id propagation via traceparent header
    - Pino transport with trace_id injection
    - DB query comment injection: /* trace_id=X */
    - Pino redact config (tokens, emails, phones, secrets)
  Task 4.2: Prometheus + Loki + Grafana
    - Docker Compose: Prometheus + Loki + Grafana + Tempo
    - Next.js /api/metrics endpoint (Prometheus scrape)
    - Basic dashboards: request rate, error rate, latency

SLICE 5: CI/CD pipeline
  Task 5.1: GitHub Actions setup
    - pnpm install + build on PR
    - Vitest unit tests (packages/testing)
    - ESLint + TypeScript type check
    - Bundle size check (CI fails if unexpected growth)
    - pnpm list payload | grep 3.82.1 || exit 1 (version pin check)
  Task 5.2: Security CI checks
    - npm audit (fail on high severity)
    - Check for NEXT_PUBLIC_ secrets in code (grep)
    - Check for jsonwebtoken usage (grep - must use jose)
    - Check for dangerouslySetInnerHTML from user content

SUCCESS CRITERIA
  pnpm dev --filter=@mjagency/web-main starts without error
  Docker Compose: all services healthy
  CF Images: test upload returns AVIF URL
  OTel: trace visible in Grafana Tempo
  CI: full pipeline passes on main branch
  Payload version: pnpm list payload shows exactly 3.82.1

SLICE 6: Secrets Management (Doppler)
  Task 6.1: Doppler workspace setup
    - One Doppler project per agency: mjagency-ecommerce, mjagency-growth, etc.
    - One shared project: mjagency-shared (platform-wide secrets)
    - Each agency app reads own project + shared project
    - Secret namespacing:
        DATABASE_URL (per-agency, points to PgBouncer port)
        REDIS_URL (shared, namespaced in app)
        JWT_SECRET (shared)
        STRIPE_SECRET_KEY (per-agency)
        STRIPE_WEBHOOK_SECRET (per-agency)
        CALCOM_API_KEY (per-agency)
        CLOUDFLARE_API_TOKEN (shared)
        CLOUDFLARE_IMAGES_ACCOUNT_ID (shared)
        R2_BUCKET / R2_ACCESS_KEY / R2_SECRET_KEY (shared)
        LITELLM_API_KEY (shared)
        DOPPLER_TOKEN (per agency app at deploy)
        PINO_LEVEL (shared, default 'info')
    - NEVER: NEXT_PUBLIC_ prefix on any secret
    - CI: Doppler CLI injects secrets at build time
    - Local dev: .env.local mirrors Doppler (not committed)
  Task 6.2: Secret rotation plan
    - JWT_SECRET: rotate quarterly (old tokens still valid until expiry)
    - API keys: rotate on team member offboarding
    - STRIPE keys: rotate annually or on exposure
    - Document rotation procedure in runbook
