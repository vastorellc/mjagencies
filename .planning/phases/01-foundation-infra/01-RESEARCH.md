# Phase 1: Foundation + Infra — Research

**Researched:** 2026-04-25
**Domain:** Monorepo scaffold + local dev infra + observability + CI/CD + secrets
**Confidence:** HIGH (locked stack; primary research goal is verifying integration patterns and version currency)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**VPS + CI runner provisioning**
- **D-01:** Production VPS is provisioned in **Phase 12 only**. Phases 1–11 stay local-only (Docker Compose) and rely on GitHub-hosted CI.
- **D-02:** **CI runners are GitHub-hosted through Phase 12.** Migrate to self-hosted runners on the production VPS at M012.
- **D-03:** **Stripe CLI in Docker Compose at M001 = webhook forwarding only.** Single Stripe CLI container forwards to all 13 apps' `/api/stripe/webhook` endpoints in test mode. No customer/product/price seeding at M001 — that lands in M010. Test-mode keys via Doppler `mjagency-shared`.

**Local DB topology + subdomain routing**
- **D-04:** **Local Postgres = ONE Postgres 17 container with 13 logical databases** (`brand_db`, `ecommerce_db`, `growth_db`, `webdev_db`, `ai_db`, `branding_db`, `strategy_db`, `finance_db`, `engineering_db`, `product_db`, `video_db`, `graphic_db`). Each has its own role + RLS. Production topology (separate clusters per agency) lives in M002; PgBouncer + RLS behavior is identical at the connection-string level so dev fidelity is acceptable.
- **D-05:** **PgBouncer per agency:** 13 PgBouncer instances (transaction mode, `pool_size=20`, ports `6432`–`6444`). Run via PM2 in dev. M001 ships configs + PM2 ecosystem files; full per-cluster prod variant tunes in M002.
- **D-06:** **Subdomain routing in dev = `/etc/hosts` entries** documented per-OS in `docs/runbooks/local-dev.md` (macOS, Linux, Windows-WSL2, Windows native). 13 entries: `127.0.0.1 brand.localhost ecommerce.localhost growth.localhost webdev.localhost ai.localhost branding.localhost strategy.localhost finance.localhost engineering.localhost product.localhost video.localhost graphic.localhost`.
- **D-07:** **PgAdmin in Docker Compose** (dev profile only) with pre-configured connections to all 13 DBs.

**Observability scope at M001**
- **D-08:** **OTel exporter target = Tempo only** at M001. SaaS APM deferred to Phase 11.
- **D-09:** **Pino log transport = `Pino → stdout → Promtail → Loki`.** 12-factor pattern.
- **D-10:** **`/api/metrics` Prometheus scrape endpoint exposed by ALL 13 apps from M001** with `agency_id` label. Wire-once approach.
- **D-11:** **Initial Grafana dashboards (M001) = three** — Request rate, Error rate, Latency p50/p95/p99 — each with per-agency `agency_id` drill-down. Provisioned as code in `infra/grafana/`.
- **D-12:** **Pino redact config (REQ-307, REQ-426)** applies to: tokens, emails, phones, secrets, JWT claims, Stripe keys, R2 access keys, Doppler tokens, refresh-token strings, password fields. Redact path list lives in `packages/config/logger.ts`.
- **D-13:** **DB query trace_id injection:** every Drizzle query gets a `/* trace_id=<id> */` SQL comment via a Drizzle middleware/wrapper in `packages/db` (stub at M001, real wrapper in M002).

**Repo strictness + package scaffolding**
- **D-14:** **ESLint preset = `next/core-web-vitals` + `@typescript-eslint/recommended`** + custom rules: forbid `import 'jsonwebtoken'`, forbid `dangerouslyAllowSVG`, forbid `dangerouslySetInnerHTML` from non-sanitized sources, forbid `NEXT_PUBLIC_.*KEY` env names. Prettier alongside.
- **D-15:** **Node version pin = `engines.node >=22.x` in every `package.json` + `.nvmrc` at repo root.** CI fails on mismatch.
- **D-16:** **Bundle-size budget thresholds:** **+10% growth = WARN, +25% growth = HARD FAIL.** Per-app baseline via `next-bundle-analyzer` snapshot diffed against `main`.
- **D-17:** **All 13 `packages/*` scaffolded as empty stubs at M001:** `packages/{ui,db,config,auth,ai,media,cms,crm,email,seo,tools,builder,testing}`. Each gets `package.json` + `tsconfig.json` + `src/index.ts` + a one-paragraph README.
- **D-18:** **npm scope = `@mjagency/*`.** Apps and packages all private (no npm publish).

### Claude's Discretion
- Atomic commit per task within a slice; all commits on `milestone/M001-foundation-infra`; squash to `main` at milestone close.
- Doppler tier: start on **free tier**; backlog upgrade trigger.
- Turborepo pipeline: `build → typecheck → lint → test → bundle-size`. `dev` task `persistent: true`. Local cache only.
- Tailwind v4: single `@theme` block in `packages/ui/styles/theme.css` (placeholders at M001).
- Hosts script: `scripts/setup-hosts.sh` (macOS/Linux), `scripts/setup-hosts.ps1` (Windows).
- PM2: one `ecosystem.config.cjs` at repo root supervising 13 PgBouncer + Promtail + Stripe CLI in dev. Production ecosystem in M012.
- Repo layout: `mjagency/` = canonical spec source, untouched. New code in `apps/`, `packages/`, `scripts/`, `infra/`, `docs/`.
- GitHub Actions: single Linux runner (Ubuntu latest); multi-OS deferred.

### Deferred Ideas (OUT OF SCOPE for Phase 1)
- SaaS APM (Honeycomb / New Relic / Datadog) — Phase 11
- Self-hosted CI runners on prod VPS — Phase 12
- Stripe customer/product/price seeding — Phase 10
- Strict-type-checked ESLint preset upgrade — Phase 8 revisit
- Volta-based Node pin
- Remote Turborepo cache — Phase 8+
- Doppler tier upgrade
- Multi-OS GitHub Actions matrix
- Production VPS provisioning — Phase 12
- Real Drizzle schema or migrations — M002
- Real auth/JWT — M003
- Theme tokens — M004
- Payload collections beyond stub — M005
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-001 | Turborepo + 12 agency apps + shared packages | §2.1 Turborepo + §2.5 Cloudflare scaffolds; §2.17 Repo Structure |
| REQ-002 | Docker Compose (Postgres, Redis, Mailhog) | §2.3 Docker Compose; §2.4 PgBouncer |
| REQ-003 | Cloudflare Images + Stream + R2 + Workers + WAF | §2.5 Cloudflare SDK scaffolds (M001 = scaffolds/types only; Workers/WAF deferred to M008/M011) |
| REQ-004 | OpenTelemetry traces | §2.6 OTel → Tempo |
| REQ-005 | GitHub Actions CI/CD with canary gate | §2.10 GitHub Actions (canary gate is M012 — M001 ships standard CI only) |
| REQ-006 | VPS 8GB+4GB swap | **OUT OF SCOPE** per D-01 — VPS provisioning deferred to M012. Phase 1 documents requirement only. |
| REQ-007 | PM2 cluster mode per app | **PARTIAL** per D-01 — M001 ships dev PM2 ecosystem (PgBouncer + Promtail + Stripe CLI). Prod PM2 cluster mode for app processes lands in M012. |
| REQ-304 | Stock API keys server-side proxy only | §3 Pitfalls + §2.13 ESLint custom rule banning `NEXT_PUBLIC_.*KEY` |
| REQ-307 | Pino redact tokens/emails/phones | §2.7 Pino + redact path list in §2.12 |
| REQ-426 | Pino redact secrets (extended) | §2.7 Pino redact config |
| REQ-427 | `__NEXT_DATA__` audit CI scan | §2.10 CI gates — Playwright + grep test |
| REQ-428 | Doppler per-agency + shared projects | §2.11 Doppler workflow |
| REQ-501 | CI: `pnpm list payload \| grep 3.82.1 \|\| exit 1` | §2.10 CI gates |
| REQ-502 | CI: `grep jsonwebtoken` returns 0 | §2.10 CI gates + §2.13 ESLint custom rule |
| REQ-503 | CI: `grep NEXT_PUBLIC_.*KEY` returns 0 | §2.10 CI gates + §2.13 ESLint custom rule |
</phase_requirements>

## Project Constraints (from mjagency/CLAUDE.md)

These directives apply to every task in this phase and have the same authority as locked decisions:

1. **Payload version locked at exactly `3.82.1`** — no `^`, no `~`. All 13 apps (12 agency + web-main). CI gate REQ-501 enforces. `.github/dependabot.yml` must `ignore: payload` and `@payloadcms/*`. [VERIFIED: mjagency/CLAUDE.md §1; mjagency/specs/security.md SEC-N1]
2. **`jose` only for JWT** — `jsonwebtoken` is banned (Edge runtime incompatible). CI gate REQ-502 enforces. [VERIFIED: mjagency/CLAUDE.md §2; mjagency/specs/security.md]
3. **Server actions: session check as FIRST line** — middleware alone is insufficient. Pattern locked in M003 but ESLint custom rule should be drafted at M001. [VERIFIED: mjagency/CLAUDE.md §3]
4. **Cloudflare/Next middleware matcher MUST exclude `/(payload)/admin/*`, `/api/*`, `/_next/*`** — Payload routes need Node runtime; middleware runs on Edge. [VERIFIED: mjagency/CLAUDE.md §4]
5. **Content-Complete Rule** — never write "TODO", "Coming soon", "[insert]", "Lorem ipsum". Stub READMEs in `packages/*` MUST be one paragraph that points at the milestone that fills the package — not "Coming soon". [VERIFIED: mjagency/CLAUDE.md §5]
6. **No `NEXT_PUBLIC_*KEY` env vars; no `dangerouslyAllowSVG`; no `dangerouslySetInnerHTML` from user content** — CI grep gates + ESLint rules required. [VERIFIED: mjagency/CLAUDE.md §7]
7. **Agency isolation conventions locked at M001** even though no real queries ship: Redis prefix `agency:<id>:cache:*`, BullMQ prefix `agency:<id>:bull:*`, OTel resource attribute `agency.id=<slug>`. Captured in `packages/config` constants. [VERIFIED: mjagency/CLAUDE.md §8; mjagency/specs/architecture.md "REDIS ARCHITECTURE"]
8. **TypeScript strict mode always; no `any`; explicit return types; `import type` for types.** Shared `tsconfig.base.json` in `packages/config`. [VERIFIED: mjagency/CLAUDE.md §9]
9. **Vitest for unit tests; MSW for webhooks; Playwright for e2e.** `packages/testing` ships at M001 as scaffolds + shared utilities. [VERIFIED: mjagency/CLAUDE.md §10]

---

## Summary

Phase 1 is a greenfield scaffold with the entire stack already locked by `mjagency/CLAUDE.md`, `mjagency/PROJECT.md`, and `mjagency/specs/milestone-M001.md`. There is no library selection to do; the research goal is to (a) verify all pinned versions exist and are current, (b) document the proven 2026 integration patterns for the trickier seams (Payload 3 inside Next 15 App Router, OTel NodeSDK across Edge/Node split, PgBouncer transaction mode + Drizzle prepared statements, Pino → Loki via Promtail, Doppler-per-project monorepo wiring, bundle-size CI), and (c) flag pitfalls so the planner doesn't put a custom solution where a known library already exists.

**Primary recommendation:** Plan Phase 1 as **6 plans matching the 6 M001 slices**. Within each plan, group tasks 1:1 with M001 task IDs (Task 1.1, Task 1.2, …). The four highest-risk seams that need extra care in plan writing are: (1) **Payload 3 + Next 15 embedding** (use Payload's `create-payload-app` template as the reference shape; do NOT hand-roll the route-group layout), (2) **OTel instrumentation under Next 15** (NodeSDK guarded by `process.env.NEXT_RUNTIME === 'nodejs'`), (3) **PgBouncer transaction-mode + Drizzle** (need `max_prepared_statements >= 100` AND Drizzle `prepare: false` flag in the wrapper to avoid prepared-statement breakage), (4) **Pino + Edge runtime** (Pino does NOT run in middleware — middleware uses `console.log` JSON only and `packages/config/logger.ts` exposes a separate `edgeLogger`).

**Five things the planner must know:**
- The CI gates in REQ-501/502/503 are simple `grep` lines but they MUST run on every PR — bake them into the GitHub Actions workflow as the FIRST job (fail-fast).
- `packages/*` stubs need TypeScript project references in their `tsconfig.json` so the workspace `tsc --build` works from day one.
- Doppler free tier: confirm 5-project minimum is sufficient (we need 13 projects); plan should include a fallback (use Doppler "configs" within fewer projects) in case free-tier project count is binding. [ASSUMED — needs explicit verification before Doppler signup task lands]
- Promtail + Loki Docker Compose stack adds ~3 services; make sure dev profile is opt-in via `--profile dev` so default `docker compose up` stays fast.
- The 13 PgBouncer instances on ports 6432–6444 mean `userlist.txt` must be generated, not hand-edited — ship a `scripts/gen-pgbouncer-config.sh` that writes 13 `pgbouncer.<slug>.ini` files from a template.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Subdomain routing (dev) | Browser (via /etc/hosts) | OS resolver | No proxy in dev; entries map subdomain → 127.0.0.1; Next dev server picks up Host header |
| Payload admin UI | Frontend Server (SSR Node runtime) | — | `/(payload)/admin/*` rendered by Next.js Node runtime; embedded via `withPayload()` |
| Payload REST/GraphQL API | API/Backend (Node runtime) | — | `/api/[...slug]/route.ts` route handler runs on Node (not Edge) |
| JWT verify in middleware | Frontend Server (Edge runtime) | — | Middleware runs on Edge; jose is Edge-compatible |
| OTel trace propagation | Cross-tier | All | `traceparent` header generated at edge, forwarded to Node, embedded in Pino logs + DB query comments |
| Prometheus `/api/metrics` | API/Backend (Node runtime) | — | prom-client uses Node APIs; route handler runs on Node |
| Pino log emission | API/Backend (Node runtime) | — | Pino does NOT work in Edge; middleware uses console.log fallback |
| Cloudflare Images upload | API/Backend (server-side only) | — | API key in Doppler; client never sees the key (REQ-304) |
| Cloudflare R2 asset storage | CDN/Static (R2) | API/Backend (signing) | S3-compatible reads; signed PUTs from server |
| Postgres (dev) | Database (single container, 13 logical DBs) | — | Per D-04: dev fidelity is acceptable; prod separates clusters in M002 |
| PgBouncer (dev) | Database edge (PM2 supervisor) | — | 13 instances, transaction mode, ports 6432–6444 |
| Redis | Database (shared, namespaced) | — | Single cluster; per-agency key prefix `agency:<id>:*` |
| Doppler secret injection | Build/Deploy time | Runtime (`doppler run`) | Secrets never written to repo; injected at build via `doppler secrets download --no-file --format=env` and at runtime via `doppler run -- pnpm start` |

## Standard Stack

### Core (locked, versions verified against npm registry on 2026-04-25)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `payload` | **3.82.1** (PINNED EXACT) | CMS embedded in Next.js | Locked per CLAUDE.md §1 + SEC-N1. v3.83.0 has a custom-view-routing bug. [VERIFIED: npm registry] |
| `@payloadcms/next` | 3.82.1 (must match `payload`) | `withPayload()` Next plugin | Required for Next.js 15 embedding. Pin to same version as `payload`. [VERIFIED: npm registry shows 3.84.1 latest; we pin to 3.82.1 to match] |
| `@payloadcms/db-postgres` | 3.82.1 | Postgres adapter | Same pin rule. [VERIFIED: npm registry] |
| `@payloadcms/richtext-lexical` | 3.82.1 | Lexical editor | M005 needs it; install at M001 with `0` features wired so Payload boots. [VERIFIED: npm] |
| `next` | **>=15.2.3, <16** (use 15.5.15 latest stable) | Framework | CVE-2025-29927 patch baseline (REQ-029); next 16 is breaking. [VERIFIED: npm registry — 15.5.15 is latest stable 15.x; 16.2.4 is current latest overall] |
| `react` / `react-dom` | 19.x (whatever Next 15.5 requires) | UI runtime | Next 15.5 ships against React 19. [CITED: nextjs.org/docs] |
| `typescript` | 5.6.3 | Language | TS 5.6 is current stable. [VERIFIED: npm shows 6.0.3 — 5.6.x recommended for Next 15.5 ecosystem stability] |
| `tailwindcss` | 4.x (latest 4.2.4) | Styling | v4 is locked. New `@theme` block syntax. [VERIFIED: npm] |
| `turbo` | 2.9.6 | Monorepo orchestrator | Turborepo 2.x uses `tasks` key (not `pipeline`). [VERIFIED: npm; turborepo.dev/docs] |
| `pnpm` | 10.x (10.33.2 latest) | Package manager | pnpm workspaces are the locked monorepo manager. [VERIFIED: npm] |
| `drizzle-orm` | 0.45.2 | ORM (stub at M001, real in M002) | Locked. [VERIFIED: npm] |
| `jose` | 6.2.2 | JWT (stub at M001, real in M003) | Edge-runtime compatible. CLAUDE.md §2. [VERIFIED: npm] |
| `pino` | 10.3.1 | Structured logging | 12-factor: stdout → Promtail → Loki. [VERIFIED: npm] |
| `bullmq` | 5.76.2 | Queue (stub at M001, real in M002+) | Per-agency queue prefix locked at M001 in `packages/config`. [VERIFIED: npm] |
| `ioredis` | 5.10.1 | Redis client | Standard for BullMQ. [VERIFIED: npm] |
| `vitest` | 2.x | Unit tests | Per CLAUDE.md §10. [ASSUMED current; verify on install] |
| `eslint` | 9.x (10.2.1 verified) | Linter | ESLint 9 flat config (`eslint.config.js`). [VERIFIED: npm] |
| `@typescript-eslint/eslint-plugin` | 8.59.0 | TS lint rules | Required by D-14 preset. [VERIFIED: npm] |
| `prettier` | 3.x | Formatter | Standard. [ASSUMED current] |

### Observability (M001)

| Library | Version | Purpose |
|---------|---------|---------|
| `@opentelemetry/sdk-node` | 0.215.0 | NodeSDK (in `packages/config/otel-node.ts`) [VERIFIED: npm] |
| `@opentelemetry/auto-instrumentations-node` | 0.73.0 | Auto-instrument http/fetch/pg/redis [VERIFIED: npm] |
| `@opentelemetry/exporter-trace-otlp-http` | 0.215.0 | OTLP → Tempo (port 4318) [VERIFIED: npm] |
| `@opentelemetry/instrumentation-pino` | 0.61.0 | Pino auto-injects trace_id [VERIFIED: npm] |
| `prom-client` | 15.1.3 | `/api/metrics` Prometheus exporter [VERIFIED: npm] |

### Cloudflare scaffolds (M001 = SDK install + types only)

| Library | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | 3.1037.0 | R2 client (R2 is S3-compatible) [VERIFIED: npm] |
| `cloudflare` (official SDK) | latest | API for Images / Stream metadata [ASSUMED current — verify on install] |
| `blurhash` | latest | BlurHash util in `packages/media` [ASSUMED] |

### CI tooling

| Library | Version | Purpose |
|---------|---------|---------|
| `@next/bundle-analyzer` | 16.2.4 (matches next major) — for Next 15 use **15.x** | Bundle visualization. [VERIFIED: npm] **NOTE:** for Next 15 apps, use `@next/bundle-analyzer@15.5.15` to match. [CITED: npmjs.com/package/@next/bundle-analyzer] |
| `size-limit` | latest | Bundle-size CI gate (better than `@next/bundle-analyzer` for warn/fail thresholds — see §2.14) [CITED: blog.logrocket.com/how-to-analyze-next-js-app-bundles] |

### Installation (root package.json scripts will pin these)

```bash
# Core
pnpm add -w next@15.5.15 react@19 react-dom@19 typescript@5.6.3
pnpm add -w payload@3.82.1 @payloadcms/next@3.82.1 @payloadcms/db-postgres@3.82.1 @payloadcms/richtext-lexical@3.82.1
pnpm add -w tailwindcss@4 @tailwindcss/postcss@4
pnpm add -w turbo@2.9.6
# Observability
pnpm add @opentelemetry/sdk-node@0.215.0 @opentelemetry/auto-instrumentations-node@0.73.0 @opentelemetry/exporter-trace-otlp-http@0.215.0 @opentelemetry/instrumentation-pino@0.61.0 pino@10.3.1 prom-client@15.1.3
# Lint
pnpm add -wD eslint@10.2.1 @typescript-eslint/eslint-plugin@8.59.0 @typescript-eslint/parser@8.59.0 eslint-config-next@15.5.15 prettier@3
# CI
pnpm add -wD size-limit @size-limit/preset-app
```

**Version verification was run via `npm view <pkg> version` on 2026-04-25.** Re-run before the install task lands; pinned versions in package.json should reflect the result of that run.

---

## Per-Focus-Area Recommendations

### 2.1 Turborepo + pnpm workspaces config

**Recommendation:** Turborepo 2.9 with `tasks` key (not deprecated `pipeline`). Single root `turbo.json` + `pnpm-workspace.yaml` enumerating `apps/*` and `packages/*`. Per CLAUDE.md content-complete rule, `packages/*` stubs each ship with a real one-paragraph README pointing at the filling milestone — not "Coming soon".

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**`turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local", "tsconfig.base.json"],
  "globalEnv": ["NODE_ENV", "AGENCY", "DOPPLER_TOKEN"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["DATABASE_URL", "PAYLOAD_SECRET", "JWT_SECRET"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "size-limit": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    }
  }
}
```

[CITED: turborepo.dev/docs/reference/configuration]

**Pitfalls:**
- `dependsOn: ["^build"]` waits for upstream package builds — without it, type errors from `@mjagency/config` won't be caught when an app builds.
- Turborepo 2.x removed the `pipeline` key; agents must use `tasks`. [CITED: turborepo.dev/docs/crafting-your-repository/configuring-tasks]
- Persistent tasks (`dev`) cannot have other tasks depend on them. Use `turbo watch dev` for local dev-with-rebuild flows.
- Root `package.json` config changes invalidate ALL caches. Keep `globalDependencies` minimal (only `tsconfig.base.json` and dotenv files).

### 2.2 Embedding Payload 3.82.1 inside Next.js 15

**Recommendation:** Follow Payload's official `create-payload-app` shape exactly. Reference: [Payload docs — Installation](https://payloadcms.com/docs/getting-started/installation) and [Payload 3.0 launch post](https://payloadcms.com/posts/blog/payload-30-the-first-cms-that-installs-directly-into-any-nextjs-app). Don't hand-roll the route-group layout — Payload owns that surface area and v3.x admin routes have known fragility.

**Required structure (per app, identical for `web-main` + 12 agency apps):**
```
apps/web-main/
├── next.config.mjs              # withPayload() wrapper (ESM)
├── payload.config.ts            # Payload root config (collections imported from packages/cms at M005)
├── tsconfig.json
├── package.json                 # "payload": "3.82.1" EXACT
└── src/
    └── app/
        ├── (frontend)/
        │   ├── layout.tsx
        │   └── page.tsx
        ├── (payload)/           # Payload route group — owned by Payload, do not hand-edit
        │   ├── admin/
        │   │   └── [[...segments]]/
        │   │       ├── page.tsx
        │   │       └── not-found.tsx
        │   ├── api/
        │   │   └── [...slug]/
        │   │       ├── route.ts
        │   │       └── route.ts
        │   ├── layout.tsx
        │   └── custom.scss
        └── api/
            ├── metrics/route.ts # prom-client (Node runtime)
            └── stripe/webhook/route.ts  # stub at M001
```

**`next.config.mjs`:**
```js
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // CRITICAL: dangerouslyAllowSVG MUST stay false (REQ-098, SEC-N4)
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
    ],
  },
  experimental: {
    // Pino + OTel instrumentation work well with serverComponentsExternalPackages
    serverComponentsExternalPackages: ['pino', 'pino-pretty', '@opentelemetry/sdk-node'],
  },
}

export default withPayload(nextConfig)
```

**`payload.config.ts` (M001 stub):**
```ts
// SOURCE: payloadcms.com/docs/getting-started/installation
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users', // collection at M003
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [
    // M001: empty — minimum to boot is zero collections + Payload generates `users`
    // M005 fills these from packages/cms
  ],
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
  }),
})
```

**Compatibility note:** Payload 3.81.0 (April 2026) fixed Next.js `cacheComponents` admin-route bugs. We're on 3.82.1 which inherits that fix. [CITED: bradfarleigh.com/2026/04/payload-cms-3-81-0-whats-new-nextjs]

**M001 boot verification:** `pnpm dev --filter=@mjagency/web-main` → `http://localhost:3000/admin` loads Payload's first-user wizard. That's the gate. The 12 agency apps copy this scaffold (identical structure, AGENCY env var distinguishes config selection at M002+).

### 2.3 Docker Compose

**Recommendation:** Two profiles — `core` (always-on) and `dev` (developer-only). Init SQL creates 13 logical DBs + per-DB roles in a single `init.sql` mounted as `/docker-entrypoint-initdb.d/`.

**`docker-compose.yml` (sketch):**
```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_SUPERUSER_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s

  redis:
    image: redis:7
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports: ["6379:6379"]

  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]
    profiles: ["dev"]

  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: dev@localhost
      PGADMIN_DEFAULT_PASSWORD: dev
    volumes:
      - ./infra/pgadmin/servers.json:/pgadmin4/servers.json
    ports: ["5050:80"]
    profiles: ["dev"]

  stripe-cli:
    image: stripe/stripe-cli
    command: listen --forward-to host.docker.internal:3000/api/stripe/webhook
    environment:
      STRIPE_API_KEY: ${STRIPE_TEST_API_KEY}
    profiles: ["dev"]

  # Observability stack
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    ports: ["9090:9090"]

  loki:
    image: grafana/loki:latest
    ports: ["3100:3100"]
    volumes:
      - ./infra/loki/loki-config.yml:/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./infra/promtail/promtail-config.yml:/etc/promtail/promtail-config.yml
    depends_on: [loki]

  tempo:
    image: grafana/tempo:latest
    command: -config.file=/etc/tempo.yml
    volumes:
      - ./infra/tempo/tempo.yml:/etc/tempo.yml
    ports:
      - "3200:3200"     # Tempo HTTP
      - "4318:4318"     # OTLP HTTP receiver
      - "4317:4317"     # OTLP gRPC receiver

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "true"
    volumes:
      - ./infra/grafana/datasources:/etc/grafana/provisioning/datasources
      - ./infra/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports: ["3001:3000"]

volumes:
  postgres-data:
```

**`infra/postgres/init.sql`:** generated from a template. Creates 13 DBs + 13 roles, each role owns its DB, password from env:
```sql
-- Generated by scripts/gen-postgres-init.sh — do not hand-edit
CREATE ROLE brand_user WITH LOGIN PASSWORD :'BRAND_PW';
CREATE DATABASE brand_db OWNER brand_user;
GRANT ALL PRIVILEGES ON DATABASE brand_db TO brand_user;
-- ... × 13 (brand, ecommerce, growth, webdev, ai, branding, strategy, finance, engineering, product, video, graphic)
```

**Default behavior:** `docker compose up` brings up `core` profile (Postgres, Redis, Prometheus, Loki, Promtail, Tempo, Grafana). `docker compose --profile dev up` adds Mailhog, PgAdmin, Stripe CLI.

[CITED: docs.docker.com/compose/profiles for the `profiles:` flag]

### 2.4 PgBouncer per agency

**Recommendation:** 13 PgBouncer instances, each in transaction mode, `pool_size=20`, `max_prepared_statements=100`, `auth_type=scram-sha-256`. Run via PM2 in dev. Configs generated from a template, not hand-written.

**Per-agency `pgbouncer.<slug>.ini`:**
```ini
[databases]
ecommerce_db = host=127.0.0.1 port=5432 dbname=ecommerce_db

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6433              ; per-agency port: brand=6432, ecommerce=6433, ...
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.ecommerce.txt
max_prepared_statements = 100   ; CRITICAL — see pitfall 3.3
ignore_startup_parameters = extra_float_digits
log_connections = 0
log_disconnections = 0
admin_users = postgres
```

[CITED: pgbouncer.org/config.html; PgBouncer 1.21+ supports prepared statements in transaction mode — pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode]

**`scripts/gen-pgbouncer-config.sh`:** reads agency list (`brand,ecommerce,growth,...`) + base port (6432), writes 13 ini files + 13 userlist files. Idempotent.

**`ecosystem.config.cjs` (root, dev only):**
```js
const agencies = ['brand','ecommerce','growth','webdev','ai','branding','strategy','finance','engineering','product','video','graphic']

module.exports = {
  apps: [
    ...agencies.map((slug, idx) => ({
      name: `pgbouncer-${slug}`,
      script: 'pgbouncer',
      args: `infra/pgbouncer/pgbouncer.${slug}.ini`,
      autorestart: true,
      max_restarts: 10,
      env: { PORT: 6432 + idx },
    })),
    {
      name: 'promtail',
      script: 'promtail',
      args: '-config.file=infra/promtail/promtail-config.yml',
    },
    {
      name: 'stripe-listener',
      script: 'stripe',
      args: 'listen --forward-to localhost:3000/api/stripe/webhook',
      env: { STRIPE_API_KEY: process.env.STRIPE_TEST_API_KEY },
    },
  ],
}
```

**Production note (M002):** Each agency cluster gets its own PgBouncer co-located with its Postgres in M002; the dev config templates are reused.

### 2.5 Cloudflare SDK scaffolding (M001 = scaffolds + types only)

**Recommendation:** `packages/media` ships SDK clients (server-side only) with type-safe wrappers. No real upload happens at M001 — that's M005. But the API surface is wired so M005 doesn't churn package boundaries.

**`packages/media/src/index.ts`:**
```ts
// Re-export types and clients only — never imported in browser code
export type { ImagesUploadResult, BlurHashResult } from './types'
export { createImagesClient } from './cloudflare-images'
export { createR2Client } from './r2'
export { createStreamClient } from './cloudflare-stream'
export { computeBlurHash } from './blurhash'
export { agencyAssetCacheTag } from './cache-tags'  // 'agency:<id>:asset:<id>'
```

**`packages/media/src/cloudflare-images.ts` (M001 = signed-URL generator + types; real upload at M005):**
```ts
import type { ImagesUploadResult } from './types'

export interface ImagesClient {
  /** Generates one-time upload URL. Server-side only — never call from browser. */
  createUploadUrl(opts: { agencyId: string; metadata?: Record<string, string> }): Promise<{ url: string; id: string }>
  /** Returns URL for a delivered variant (e.g. 'public', 'avif', 'thumbnail'). */
  deliveryUrl(imageId: string, variant: string): string
}

export function createImagesClient(env: {
  CLOUDFLARE_API_TOKEN: string
  CLOUDFLARE_IMAGES_ACCOUNT_ID: string
}): ImagesClient {
  // M001: implementation that throws "not configured at M001" if creds missing,
  // otherwise calls Cloudflare Images API. Real test in M005.
  // CRITICAL: never accept this client in client components — REQ-304.
  return { /* ... */ } as ImagesClient
}
```

**`packages/media/src/r2.ts`:** thin S3 wrapper using `@aws-sdk/client-s3` with R2 endpoint. [CITED: developers.cloudflare.com/r2/api/s3/api]

**`packages/builder` + `packages/tools` at M001:** Puck installed (not used), tool calculator interface defined as types only. README states "filled in M010". Per content-complete rule, the README is one paragraph of real text, not a TODO.

### 2.6 OpenTelemetry → Tempo wiring

**Recommendation:** Use Next.js 15's auto-detected `instrumentation.ts` hook. NodeSDK in a separate `instrumentation.node.ts` guarded by `process.env.NEXT_RUNTIME === 'nodejs'`. NodeSDK CANNOT run in Edge.

**`apps/<app>/instrumentation.ts`:**
```ts
// SOURCE: nextjs.org/docs/app/guides/open-telemetry
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
  // Edge runtime: no-op; trace_id propagation only via traceparent header
}
```

**`apps/<app>/instrumentation.node.ts`:**
```ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: `mjagency-${process.env.AGENCY ?? 'main'}`,
    [ATTR_SERVICE_NAMESPACE]: 'mjagency',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? 'development',
    'agency.id': process.env.AGENCY ?? 'main',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable noisy fs instrumentation
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
    new PinoInstrumentation(),
  ],
})

sdk.start()

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OTel SDK shut down'))
    .catch((e) => console.error('OTel shutdown error', e))
    .finally(() => process.exit(0))
})
```

**Environment (per-agency, from Doppler):**
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces  # Tempo OTLP receiver
OTEL_SERVICE_NAME=mjagency-ecommerce
AGENCY=ecommerce
```

[CITED: nextjs.org/docs/app/guides/open-telemetry — "instrumentation.ts is detected automatically" since Next 15; the `experimental.instrumentationHook` flag is removed]

[CITED: signoz.io/blog/opentelemetry-nextjs — confirms NodeSDK Edge incompatibility and the `NEXT_RUNTIME` guard pattern]

**Trace_id propagation across runtimes:**
- Edge middleware reads/forwards `traceparent` header — no SDK needed, just header forwarding.
- Node route handlers / server actions: `@opentelemetry/auto-instrumentations-node` auto-extracts `traceparent` from incoming requests via `@opentelemetry/instrumentation-http`.
- Pino: `@opentelemetry/instrumentation-pino` auto-injects `trace_id`, `span_id`, `trace_flags` into every log line when called inside an active span.

### 2.7 Pino → stdout → Promtail → Loki

**Recommendation:** Per D-09, apps emit JSON to stdout; Promtail tails via Docker log driver (dev) or PM2 logs (prod, M012); Loki ingests; Grafana reads. No `pino-loki` transport — keep apps decoupled from log backend.

**`packages/config/src/logger.ts`:**
```ts
import pino, { type Logger } from 'pino'

export const REDACT_PATHS = [
  // Headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-doppler-token"]',
  'res.headers["set-cookie"]',
  // Generic field names (covers nested objects)
  '*.password', '*.token', '*.secret', '*.apiKey', '*.api_key',
  '*.email', '*.phone', '*.creditCard', '*.ssn',
  '*.refreshToken', '*.accessToken', '*.jti',
  '*.stripeKey', '*.stripeSecret', '*.r2AccessKey', '*.r2SecretKey',
  '*.dopplerToken', '*.jwtSecret',
  // JWT claim payloads
  '*.payload.email', '*.payload.phone',
] as const

export function createLogger(opts: { service: string; agencyId?: string }): Logger {
  return pino({
    level: process.env.PINO_LEVEL ?? 'info',
    redact: { paths: [...REDACT_PATHS], censor: '[REDACTED]' },
    base: {
      service: opts.service,
      'agency.id': opts.agencyId ?? 'unknown',
      env: process.env.NODE_ENV ?? 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  })
}

// Edge-runtime-safe logger (Pino does NOT work in Edge — see pitfall 3.4)
export function edgeLog(level: 'info' | 'warn' | 'error', msg: string, ctx?: Record<string, unknown>) {
  console[level === 'info' ? 'log' : level](JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...ctx,
  }))
}
```

**`infra/promtail/promtail-config.yml`:**
```yaml
server:
  http_listen_port: 9080
clients:
  - url: http://loki:3100/loki/api/v1/push
positions:
  filename: /tmp/positions.yaml
scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        target_label: container
      - source_labels: ['__meta_docker_container_label_com_mjagency_agency']
        target_label: agency_id
    pipeline_stages:
      - json:
          expressions:
            level: level
            trace_id: trace_id
            agency_id: '"agency.id"'
      - labels:
          level:
          agency_id:
```

[CITED: grafana.com/docs/loki/latest/clients/promtail/]

**Container labeling:** add `labels: { com.mjagency.agency: ecommerce }` to each app's docker-compose service so Promtail can extract `agency_id` for log-side filtering.

### 2.8 Prometheus metrics — `/api/metrics` per app

**Recommendation:** Single shared module in `packages/config/src/metrics.ts` exporting a `Registry` per process; each app exposes a `/api/metrics` route handler. Per D-10 this is wired at M001 even though apps are mostly empty.

**`packages/config/src/metrics.ts`:**
```ts
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client'

export function createMetrics(opts: { agencyId: string }) {
  const register = new Registry()
  register.setDefaultLabels({ 'agency.id': opts.agencyId })
  collectDefaultMetrics({ register })

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  })

  const httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  })

  return { register, httpRequestsTotal, httpRequestDurationSeconds }
}
```

**`apps/<app>/src/app/api/metrics/route.ts`:**
```ts
import { NextResponse } from 'next/server'
import { metrics } from '@mjagency/config/metrics'  // singleton per process

// Force Node runtime (prom-client uses Node APIs)
export const runtime = 'nodejs'

export async function GET() {
  // Security: in dev allow open; in prod gate behind Tailscale / network ACL — see pitfall 3.5
  const body = await metrics.register.metrics()
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': metrics.register.contentType },
  })
}
```

**`infra/prometheus/prometheus.yml`:**
```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'mjagency-apps'
    static_configs:
      - targets:
          - 'host.docker.internal:3000'   # web-main
          - 'host.docker.internal:3001'   # ecommerce
          - 'host.docker.internal:3002'
          # ... 13 total
        labels:
          environment: development
    metrics_path: /api/metrics
```

### 2.9 Three basic Grafana dashboards

**Recommendation:** Dashboards-as-code via Grafana provisioning. Three JSON files in `infra/grafana/dashboards/`. Mounted at `/etc/grafana/provisioning/dashboards/`.

**Dashboards (M001):**
1. **`request-rate.json`** — `sum by (agency_id) (rate(http_requests_total[5m]))`
2. **`error-rate.json`** — `sum by (agency_id) (rate(http_requests_total{status_code=~"5.."}[5m])) / sum by (agency_id) (rate(http_requests_total[5m]))`
3. **`latency.json`** — `histogram_quantile(0.50/0.95/0.99, sum by (le, agency_id) (rate(http_request_duration_seconds_bucket[5m])))` — three rows for p50/p95/p99

**`infra/grafana/datasources/datasources.yml`:**
```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    access: proxy
    isDefault: true
  - name: Loki
    type: loki
    url: http://loki:3100
    access: proxy
  - name: Tempo
    type: tempo
    url: http://tempo:3200
    access: proxy
    jsonData:
      tracesToLogs:
        datasourceUid: loki
        tags: ['agency_id', 'service']
```

[CITED: grafana.com/docs/grafana/latest/administration/provisioning/]

**Per-agency drill-down:** every panel uses `$agency_id` template variable bound to `label_values(http_requests_total, agency_id)` so a dropdown filters to one agency.

### 2.10 GitHub Actions CI/CD

**Recommendation:** Two workflows: `pr.yml` (PR gate, fast) and `main.yml` (post-merge, full test). M001 uses GitHub-hosted Ubuntu runners (D-02). Self-hosted migration is M012.

**`.github/workflows/pr.yml`:**
```yaml
name: PR Gate
on: [pull_request]
concurrency:
  group: pr-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # FAIL-FAST: cheapest gates first
  security-grep:
    name: Security pattern gates (REQ-501, 502, 503, 427)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: REQ-502 jose-only (no jsonwebtoken)
        run: |
          if grep -rn "jsonwebtoken" apps packages --include='*.ts' --include='*.tsx' --include='*.js' --include='package.json'; then
            echo "::error::REQ-502 violation: jsonwebtoken found. Use jose."
            exit 1
          fi
      - name: REQ-503 no NEXT_PUBLIC_*KEY env names
        run: |
          if grep -rnE "NEXT_PUBLIC_[A-Z_]*KEY" apps packages --include='*.ts' --include='*.tsx' --include='*.env*'; then
            echo "::error::REQ-503 violation: NEXT_PUBLIC_*KEY env name detected."
            exit 1
          fi
      - name: REQ-N4 no dangerouslyAllowSVG
        run: |
          if grep -rn "dangerouslyAllowSVG" apps packages --include='*.ts' --include='*.tsx' --include='*.mjs'; then
            echo "::error::dangerouslyAllowSVG is forbidden (SEC-N4)."
            exit 1
          fi

  install:
    needs: security-grep
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: REQ-501 Payload version pin
        run: pnpm list payload --depth=0 | grep "payload 3.82.1" || (echo "::error::REQ-501: payload must be 3.82.1 exact" && exit 1)

  lint-typecheck-test:
    needs: install
    runs-on: ubuntu-latest
    strategy:
      matrix:
        task: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run ${{ matrix.task }}

  bundle-size:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # need main for diff
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      # Build with Doppler-injected secrets if needed
      - run: pnpm turbo run build
      # size-limit checks per-app baseline; thresholds in each app's .size-limit.json
      - run: pnpm turbo run size-limit

  npm-audit:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - name: Fail on high/critical vulns (allow moderate with comment)
        run: pnpm audit --audit-level=high

  next-data-secret-audit:
    name: REQ-427 __NEXT_DATA__ secret pattern scan
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build --filter=@mjagency/web-main
      # scan built static HTML for known secret patterns
      - name: Scan __NEXT_DATA__ payloads
        run: pnpm scripts/scan-next-data.ts
```

**`scripts/scan-next-data.ts`:** crawls `apps/*/.next/server/app/**/*.html` and `__NEXT_DATA__` JSON for: `sk_live_`, `sk_test_`, `whsec_`, JWT-shaped strings, `xoxb-`, `AKIA[0-9A-Z]{16}`, `r2_*`, etc.

**Doppler in CI:** for jobs that need real secrets (build, e2e), use the official action:
```yaml
- uses: dopplerhq/cli-action@v3
- run: doppler run --project mjagency-shared --config ci -- pnpm turbo run build
  env:
    DOPPLER_TOKEN: ${{ secrets.DOPPLER_CI_TOKEN }}
```
[CITED: github.com/DopplerHQ/cli-action]

### 2.11 Doppler workflow

**Recommendation:** One project per agency (`mjagency-brand`, `mjagency-ecommerce`, … 12 total) + one shared (`mjagency-shared`) = **13 projects**. Each agency app reads its own project + the shared project at startup.

**Free-tier check (CRITICAL — needs verification before signup task):**
- Doppler free tier historically had a project count limit (5 in older tier docs). 13 projects may push the team beyond free tier. [ASSUMED — verify on doppler.com/pricing before signup]
- **Fallback if free tier doesn't allow 13 projects:** use ONE project `mjagency` with 13 configs (`brand_dev`, `ecommerce_dev`, …). Trade-off: weaker per-tenant rotation; documented as a backlog upgrade item.

**`doppler.yaml` (root):**
```yaml
setup:
  - project: mjagency-shared
    config: dev
    path: .
  # Per-agency: doppler.yaml in each app/ dir overrides
```

**`apps/web-ecommerce/doppler.yaml`:**
```yaml
setup:
  - project: mjagency-ecommerce
    config: dev
```

**Build-time injection:**
```bash
doppler run --project mjagency-ecommerce --config dev -- pnpm build
# Or: doppler secrets download --no-file --format=env > .env.production && pnpm build
```

**Runtime (production via PM2 in M012):**
```bash
doppler run --project mjagency-ecommerce --config prod -- pnpm start
```

**Local dev:** `.env.local` mirror of Doppler (NOT committed; `.gitignore` covers it). Devs run `doppler secrets download --no-file --format=env > apps/web-ecommerce/.env.local` once.

**Secret list (per CONTEXT D-12 + M001 spec slice 6):**
- **Per-agency project (`mjagency-<slug>`):** `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CALCOM_API_KEY`, `DOPPLER_TOKEN` (deploy-time), `PAYLOAD_SECRET`, `AGENCY` (slug)
- **Shared project (`mjagency-shared`):** `REDIS_URL`, `REDIS_PASSWORD`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `LITELLM_API_KEY`, `PINO_LEVEL`, `BULLMQ_ENCRYPTION_KEY`, `STRIPE_TEST_API_KEY` (dev), `OTEL_EXPORTER_OTLP_ENDPOINT`

**Rotation runbook (`docs/runbooks/secrets.md` — written at M001):**
- `JWT_SECRET`: quarterly rotation. New tokens signed with new key; old tokens valid until 7-day refresh expiry. Document overlap window in runbook.
- API keys: on team offboarding within 24h.
- Stripe live keys: annual + on suspected exposure.

[CITED: docs.doppler.com/docs/cli — `doppler run` and `doppler secrets download` patterns]
[CITED: docs.doppler.com/docs/install-cli — monorepo `doppler.yaml` pattern]

### 2.12 Local subdomain routing

**Recommendation:** `/etc/hosts` entries per D-06. The setup script (`scripts/setup-hosts.sh` / `.ps1`) prompts for sudo and appends 13 entries.

**Why not `*.localhost` automatic resolution:** Browsers (Chrome, Firefox) resolve `*.localhost` to 127.0.0.1 BUT Next.js dev server `host` matching can be inconsistent across some Linux distros, and Windows native (without WSL) does NOT route `*.localhost`. `/etc/hosts` is the lowest-common-denominator. [CITED: RFC 6761 §6.3]

**Why not `nip.io` / `xip.io`:** DNS dependency means offline dev breaks. Failure mode is silent (DNS lookup latency).

**`scripts/setup-hosts.sh` (macOS/Linux):**
```bash
#!/usr/bin/env bash
set -euo pipefail
ENTRIES="127.0.0.1 brand.localhost ecommerce.localhost growth.localhost webdev.localhost ai.localhost branding.localhost strategy.localhost finance.localhost engineering.localhost product.localhost video.localhost graphic.localhost"
HOSTS_FILE=/etc/hosts
if grep -q "ecommerce.localhost" "$HOSTS_FILE"; then
  echo "Already configured."
  exit 0
fi
echo "$ENTRIES" | sudo tee -a "$HOSTS_FILE"
echo "Added 13 mjagency entries to /etc/hosts"
```

**`scripts/setup-hosts.ps1` (Windows):**
```powershell
$entries = "127.0.0.1 brand.localhost ecommerce.localhost growth.localhost webdev.localhost ai.localhost branding.localhost strategy.localhost finance.localhost engineering.localhost product.localhost video.localhost graphic.localhost"
$hostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
if (Select-String -Path $hostsFile -Pattern "ecommerce.localhost" -Quiet) {
  Write-Host "Already configured."; exit 0
}
# Requires elevated PowerShell
Add-Content -Path $hostsFile -Value $entries
Write-Host "Added 13 mjagency entries to $hostsFile"
```

**Note on architecture spec divergence:** `mjagency/specs/architecture.md` line 364 says `*.mjagency.local` but CONTEXT D-06 locks `*.localhost`. **CONTEXT D-06 wins** (it's newer and explicit). The spec is stale on this; runbook should follow CONTEXT.

### 2.13 ESLint v9 flat config

**Recommendation:** ESLint 9+ flat config in `packages/config/eslint/index.js`. Each app and package re-exports. D-14 preset: `next/core-web-vitals` + `@typescript-eslint/recommended` + 4 custom rules.

**`packages/config/eslint/index.js`:**
```js
import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'
import noRestrictedImports from 'eslint-plugin-no-restricted-imports'

export default [
  ...tseslint.configs.recommended,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      // REQ-502 + CLAUDE.md §2 — ban jsonwebtoken
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'jsonwebtoken', message: 'Use jose only — jsonwebtoken is Edge-incompatible (CLAUDE.md §2).' },
        ],
      }],
      // SEC-N4 — ban dangerouslyAllowSVG (custom selector)
      'no-restricted-syntax': ['error',
        {
          selector: "Property[key.name='dangerouslyAllowSVG']",
          message: 'dangerouslyAllowSVG is forbidden on Next.js Image (SEC-N4).',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML must only be used with sanitized content (DOMPurify). Move sanitization upstream and add an // eslint-disable-next-line for the verified call site.',
        },
      ],
    },
  },
]
```

**REQ-503 enforcement:** `NEXT_PUBLIC_*KEY` env name patterns are caught by the **CI grep gate** (§2.10) since ESLint can't easily scan `.env*` files. ESLint can additionally lint `process.env.NEXT_PUBLIC_*KEY` access in code via `no-restricted-syntax` matching `MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_.*KEY$/]`.

### 2.14 Bundle-size budget

**Recommendation:** **Use `size-limit` for the warn/fail thresholds; use `@next/bundle-analyzer` only for visualization.** `@next/bundle-analyzer` does not have first-class baseline-diff CI gates; `size-limit` does. [CITED: blog.logrocket.com/how-to-analyze-next-js-app-bundles]

**Per app: `apps/<app>/.size-limit.json`:**
```json
[
  {
    "name": "First Load JS (homepage)",
    "path": ".next/static/chunks/main-*.js",
    "limit": "150 KB",
    "gzip": true
  },
  {
    "name": "Admin chunk",
    "path": ".next/static/chunks/app/(payload)/admin/**/*.js",
    "limit": "500 KB",
    "gzip": true
  }
]
```

**Baseline + warn/fail logic:** `size-limit` natively fails when `limit` exceeded. For **+10% warn / +25% fail** semantics (D-16), wrap with a script:

**`scripts/check-bundle-size.ts`:**
```ts
// 1. Run `pnpm size-limit --json` to get current sizes
// 2. Read previous baseline from `.size-baseline.json` (committed at root, updated on main merge)
// 3. For each entry: compute (current - baseline) / baseline
//    - growth >= 0.25 → exit 1 (HARD FAIL)
//    - growth >= 0.10 → echo ::warning + continue
//    - growth <  0.10 → ok
// 4. On main merges, overwrite .size-baseline.json (separate workflow)
```

**Baseline storage:** `.size-baseline.json` committed to repo. Updated by a `main.yml` job that runs on push to `main`. Initial baseline at M001 = first build of each app on the milestone branch.

**Per-app independence:** each app has its own `.size-limit.json` and its own row in `.size-baseline.json` keyed by `appName`.

### 2.15 Validation Architecture (Nyquist)

**Test Framework:**
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (per CLAUDE.md §10) + Playwright (e2e in M008+) |
| Config file | `packages/testing/vitest.config.ts` (shared) + `apps/<app>/vitest.config.ts` (extends shared) |
| Quick run | `pnpm turbo run test --filter=<package>` |
| Full suite | `pnpm turbo run test` |
| Phase gate | `pnpm turbo run test && pnpm turbo run lint && pnpm turbo run typecheck` green before phase complete |

**Phase Requirements → Test Map:**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-001 | Turborepo + 12 apps + 13 packages | smoke | `pnpm install --frozen-lockfile && pnpm -r exec ls package.json` | ❌ Wave 0 |
| REQ-002 | Docker Compose all services healthy | integration | `docker compose --profile dev up -d && docker compose ps --filter health=healthy \| wc -l` ≥ N services | ❌ Wave 0 |
| REQ-003 | Cloudflare SDK scaffolds typecheck | unit | `pnpm turbo run typecheck --filter=@mjagency/media` | ❌ Wave 0 |
| REQ-004 | OTel trace visible in Tempo | integration | Hit `/api/health` on web-main, query `http://localhost:3200/api/traces?service=mjagency-main` for trace | ❌ Wave 0 |
| REQ-005 | GitHub Actions PR gate green | smoke | `act -W .github/workflows/pr.yml` (locally) | ❌ Wave 0 |
| REQ-006 | VPS spec documented (NOT provisioned) | manual | Verify `docs/runbooks/vps-provisioning.md` exists with 8GB+4GB swap line | ❌ Wave 0 |
| REQ-007 | Dev PM2 ecosystem starts 13 PgBouncers | integration | `pm2 start ecosystem.config.cjs && pm2 jlist \| jq '[.[] \| select(.name \| startswith("pgbouncer-"))] \| length' == 13` | ❌ Wave 0 |
| REQ-304 | No NEXT_PUBLIC_*KEY in code | CI grep | `! grep -rE "NEXT_PUBLIC_[A-Z_]*KEY" apps packages --include='*.ts' --include='*.tsx' --include='*.env*'` | ✅ §2.10 |
| REQ-307 / REQ-426 | Pino redact paths cover required fields | unit | `vitest packages/config/src/__tests__/logger.test.ts` — assert `{password: 'x', email: 'a@b'}` log emits `[REDACTED]` | ❌ Wave 0 |
| REQ-427 | `__NEXT_DATA__` no secret patterns | integration | `pnpm scripts/scan-next-data.ts` exits 0 | ❌ Wave 0 |
| REQ-428 | Doppler 13 projects exist | manual + smoke | `doppler projects list \| grep -c mjagency-` ≥ 13 (or 1+13 configs if free-tier fallback) | ❌ Wave 0 |
| REQ-501 | Payload pinned exactly 3.82.1 | CI grep | `pnpm list payload --depth=0 \| grep "payload 3.82.1"` | ✅ §2.10 |
| REQ-502 | No jsonwebtoken | CI grep | `! grep -rn "jsonwebtoken" apps packages` | ✅ §2.10 |
| REQ-503 | No NEXT_PUBLIC_*KEY | CI grep | covered with REQ-304 | ✅ §2.10 |

**Sampling rate:**
- **Per task commit:** `pnpm turbo run lint typecheck test --filter=<changed>` (Turbo affected detection)
- **Per slice merge:** Full `pnpm turbo run lint typecheck test build size-limit`
- **Per phase gate:** All M001 success criteria verified by automated checks (see Validation Architecture below); manual verification of 6 ROADMAP success criteria.

**Wave 0 gaps (test infrastructure to build during plan execution):**
- [ ] `packages/testing/vitest.config.ts` — shared Vitest config
- [ ] `packages/testing/src/fixtures/agency-fixture.ts` — provides 12 agency slugs + test agency_id UUIDs
- [ ] `packages/testing/src/msw/handlers.ts` — base MSW handlers (Stripe, Cloudflare Images, Cal.com)
- [ ] `apps/web-main/src/__tests__/health.test.ts` — first integration test, exercises OTel + metrics
- [ ] `packages/config/src/__tests__/logger.test.ts` — Pino redact verification (REQ-307, REQ-426)
- [ ] `scripts/scan-next-data.ts` — REQ-427 enforcement script
- [ ] `scripts/check-bundle-size.ts` — D-16 +10/+25% wrapper
- [ ] `.github/workflows/pr.yml` + `.github/workflows/main.yml`

### 2.16 Security Domain

**Applicable ASVS Categories:**

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial (M003 implements) | jose JWT + bcrypt for MFA codes — pattern locked in CLAUDE.md §2 |
| V3 Session Management | partial (M003) | httpOnly + SameSite=Strict + Secure cookies; refresh family revocation |
| V4 Access Control | partial (M002+M003) | RLS + tRPC `agencyProcedure` middleware; M001 establishes the convention |
| V5 Input Validation | yes | zod for tRPC inputs (planned M002+); SVG via DOMPurify+SVGO (M005) |
| V6 Cryptography | yes | jose (JWT), AES-GCM-256 (BullMQ payloads), bcrypt (MFA) — never hand-roll |
| V7 Error Handling | yes | Pino redact (REQ-307, 426); generic client errors |
| V8 Data Protection | yes | Doppler-only secrets; no NEXT_PUBLIC_*KEY (REQ-503); R2 server-side only (REQ-304) |
| V9 Communication | yes | TLS via Cloudflare; HSTS preload; SCRAM-SHA-256 to Postgres |
| V10 Malicious Code | yes | npm audit high-severity gate; Dependabot; Payload pin gate |
| V14 Configuration | yes | `engines.node >=22.x`; Next >=15.2.3; Payload 3.82.1; CSP nonce per-request (M003+) |

**Known Threat Patterns for {Next 15 + Payload 3 + monorepo}:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CVE-2025-29927 (Next middleware bypass via x-middleware-subrequest) | Spoofing | Require Next >=15.2.3; CI gate version check |
| Payload 3.83.0 custom-view route bug | Tampering | Pin payload@3.82.1 exact; Dependabot ignore (REQ-501) |
| `jsonwebtoken` in middleware (Edge crash) | DoS | jose only; CI grep gate (REQ-502) |
| NEXT_PUBLIC_*KEY leaked into client bundle | Info Disclosure | CI grep gate (REQ-503); ESLint rule; doppler.yaml documents banned prefixes |
| `__NEXT_DATA__` secret leak via server props | Info Disclosure | Playwright + grep scan (REQ-427); Pino redact (REQ-307, 426) |
| dangerouslyAllowSVG → SVG XSS | Tampering / XSS | ESLint rule + CI grep (SEC-N4); SVG sanitization is M005 surface |
| Payload admin enumeration | Info Disclosure | `X-Robots-Tag: noindex` on admin routes; `robots.txt: Disallow: /admin` (M001 ships these) |
| Webhook replay | Tampering | HMAC verification + Redis idempotency (M002+, but route stub at M001) |
| Open Postgres exposure | Spoofing / Info Disclosure | Docker Compose binds to 127.0.0.1; `pg_hba.conf` localhost-only |
| Doppler token leak in CI logs | Info Disclosure | Doppler action handles secret masking; do not echo `$DOPPLER_TOKEN` in workflow |

### 2.17 Repo Structure (consolidated reference)

```
ClaudeMJ/                              (existing root — git initialized)
├── .planning/                         (planning artifacts — untouched by code)
├── mjagency/                          (canonical spec source — read-only at M001+)
├── apps/                              (NEW at M001)
│   ├── web-main/                      brand.com (port 3000)
│   ├── web-ecommerce/                 ecommerce.brand.com (port 3001)
│   ├── web-growth/                    (port 3002)
│   ├── web-webdev/                    (port 3003)
│   ├── web-ai/                        (port 3004)
│   ├── web-branding/                  (port 3005)
│   ├── web-strategy/                  (port 3006)
│   ├── web-finance/                   (port 3007)
│   ├── web-engineering/               (port 3008)
│   ├── web-product/                   (port 3009)
│   ├── web-video/                     (port 3010)
│   └── web-graphic/                   (port 3011)
│   (12 agencies + main = 13 apps)
├── packages/                          (NEW at M001 — all 13 stubs)
│   ├── ui/
│   ├── db/                            Drizzle stub + trace_id wrapper interface
│   ├── config/                        ESLint config + tsconfig.base + logger + metrics + OTel + agency constants
│   ├── auth/                          jose stub (M003)
│   ├── ai/
│   ├── media/                         CF Images/Stream/R2 SDKs + types (M001 functional)
│   ├── cms/                           Payload shared config (M005)
│   ├── crm/
│   ├── email/
│   ├── seo/
│   ├── tools/
│   ├── builder/                       Puck installed, types only (M010)
│   └── testing/                       Vitest config + MSW + fixtures (M001 functional)
├── scripts/                           (NEW at M001)
│   ├── setup-hosts.sh
│   ├── setup-hosts.ps1
│   ├── gen-pgbouncer-config.sh
│   ├── gen-postgres-init.sh
│   ├── scan-next-data.ts              REQ-427
│   ├── check-bundle-size.ts           D-16
│   ├── seed/                          (stub — M002+)
│   ├── migrate/                       (stub — M002+)
│   └── validate/                      (stub — M012)
├── infra/                             (NEW at M001)
│   ├── docker-compose.yml
│   ├── postgres/init.sql
│   ├── pgbouncer/                     13 generated .ini + userlist files
│   ├── prometheus/prometheus.yml
│   ├── loki/loki-config.yml
│   ├── promtail/promtail-config.yml
│   ├── tempo/tempo.yml
│   ├── grafana/datasources/datasources.yml
│   ├── grafana/dashboards/            3 JSON dashboards
│   └── pgadmin/servers.json
├── docs/                              (NEW at M001)
│   └── runbooks/
│       ├── local-dev.md               OS-specific hosts setup, docker compose up flow
│       ├── secrets.md                 Doppler usage + rotation
│       └── vps-provisioning.md        REQ-006 spec doc (provisioning is M012)
├── ecosystem.config.cjs               PM2 dev supervisor (PgBouncer×13 + Promtail + Stripe CLI)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                       root, workspace scripts
├── tsconfig.base.json
├── .nvmrc                             "22"
├── .gitignore
├── .github/workflows/pr.yml
├── .github/workflows/main.yml
├── .github/dependabot.yml             ignore: payload, @payloadcms/*
├── doppler.yaml                       root setup → mjagency-shared
├── CLAUDE.md                          root copy of mjagency/CLAUDE.md (per gsd-config.md "single CLAUDE.md")
├── PROJECT.md                         root copy of mjagency/PROJECT.md (per gsd-config.md)
└── README.md
```

**Note:** `gsd-config.md` mandates **single CLAUDE.md and PROJECT.md at repo root**. Phase 1 should copy/symlink `mjagency/CLAUDE.md` → `/CLAUDE.md` and `mjagency/PROJECT.md` → `/PROJECT.md` (or maintain a single source — recommend symlink on Linux/macOS, file copy on Windows; CI verifies content parity).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verify in middleware | Custom HMAC routine | `jose` library | Edge-runtime crypto compat; CLAUDE.md §2 mandates jose |
| Logging in Node runtime | console.log + JSON.stringify | `pino` 10.x with redact | Battle-tested redaction; OTel auto-trace_id injection |
| Payload route group in App Router | Hand-built `app/(payload)/` files | `create-payload-app` template scaffold | Payload owns this surface; v3.x admin routes are fragile |
| Bundle-size CI gates | Custom diff script over `.next/` | `size-limit` + thin wrapper for ±% thresholds | size-limit handles per-chunk budgets and gzip math |
| Postgres connection pooling | Custom Node pool | PgBouncer (transaction mode) | Per-agency isolation, auth ladder, prepared-statement support |
| Webhook signature verification | Custom HMAC | Stripe SDK `constructEvent`, Cal.com SDK `validateSignature`, Twilio SDK `validateRequest` | Each vendor has subtle signature quirks (Stripe needs raw body; Cal.com is HMAC-SHA256 of body+secret) |
| BlurHash | Custom downsample | `blurhash` npm package | DCT-based; correctness matters for placeholder UX |
| Doppler secret injection | Custom .env loader | `doppler run` / `doppler secrets download` | Built for CI/runtime; supports rotation + audit |
| Prometheus exporter | Hand-counted metrics | `prom-client` | Histograms, label cardinality, default Node metrics free |
| OTel propagation | Custom traceparent parser | `@opentelemetry/sdk-node` + auto-instrumentations | W3C-compliant; covers http/pg/redis/fetch automatically |
| Grafana dashboard panels | Hand-edit JSON | Grafana provisioning + JSON model from existing community dashboards | Faster, version-controlled, drift-detectable |
| Local subdomain DNS | nginx reverse proxy / Caddy | `/etc/hosts` + Next.js `Host` header (D-06) | Zero infra; works offline; documented per-OS |

**Key insight:** Every item above is a place where a well-meaning agent could write 100–500 lines of code that a 1-line dependency replaces. The locked stack already covers all of them.

---

## Common Pitfalls

### 3.1 Payload 3.x + Next 15 routing fragility

**What goes wrong:** Custom changes to `app/(payload)/admin/[[...segments]]/page.tsx` break admin in subtle ways. Example: 3.83.0 introduced a custom-view-routing regression — that's why we pin 3.82.1.

**Why it happens:** Payload owns the entire admin surface; the route group is generated by `create-payload-app` and meant to be touched only by Payload upgrades.

**How to avoid:** Use `npx create-payload-app@3.82.1` as the **scaffold reference**; then transplant the generated files. Don't hand-edit. Dependabot rule: ignore payload + @payloadcms/* per `mjagency/specs/security.md` SEC-N1.

**Warning signs:** `/admin` returns 404 or 500; admin loads but custom views don't render; client-side router throws "params is not a function".

### 3.2 Cloudflare/Next middleware matcher must EXCLUDE Payload + API

**What goes wrong:** Middleware runs on Edge; Payload admin needs Node APIs. If middleware matches `/(payload)/admin/*` or `/api/*`, Payload routes silently break (502 or hang).

**How to avoid:** **Lock the matcher pattern at M001 in a shared utility** even though full middleware ships in M003:
```ts
export const PAYLOAD_EXCLUDE_MATCHER = ['/((?!_next|api|\\(payload\\)|admin|_vercel|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)']
```

**Warning signs:** Payload admin shows "Network error" in browser; `pnpm dev` logs `Module not found: 'fs'` from middleware bundle.

### 3.3 PgBouncer transaction mode + Drizzle prepared statements

**What goes wrong:** Drizzle creates server-side prepared statements by default. PgBouncer transaction mode releases connections back to the pool between transactions, breaking the prepared-statement handle. Error: `prepared statement "name" does not exist`.

**Why it happens:** Each transaction can land on a different physical Postgres connection; the prepared statement lives on a different connection than the next query.

**How to avoid:**
- **PgBouncer config:** `max_prepared_statements = 100` (PgBouncer 1.21+ tracks protocol-level prepared statements within transaction mode). [CITED: pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode]
- **Drizzle wrapper:** Pass `prepare: false` on the postgres-js client OR use the new built-in prepared-statement support depending on Drizzle version.
- **At M001:** Document this in the `packages/db` stub README so M002 doesn't hit it cold.

**Warning signs:** Sporadic `prepared statement "<name>" does not exist` in production logs; reproducible only under concurrent load.

### 3.4 Pino does NOT run in Edge runtime

**What goes wrong:** Importing `pino` in `middleware.ts` crashes the Edge bundle: `TypeError: pino.transport is not a function`. [CITED: github.com/vercel/next.js/discussions/33898]

**Why it happens:** Pino's transport mechanism uses `worker_threads`; Edge runtime is a subset of Web APIs.

**How to avoid:** `packages/config/src/logger.ts` exports two loggers: `createLogger()` (Node, full Pino) and `edgeLog()` (console.log JSON wrapper). Middleware uses `edgeLog()` exclusively. Document this split in the `packages/config` README. [CITED: trysmudford.com/blog/nextjs-edge-logging]

**Warning signs:** Build succeeds but runtime crashes when middleware fires; works in dev (Node-mode `next dev`) but not in `next start` Edge mode.

### 3.5 `/api/metrics` MUST NOT be public in production

**What goes wrong:** Default `/api/metrics` reveals internal latencies, error counts, agency identifiers — useful for attackers fingerprinting the platform.

**Why it happens:** prom-client examples typically show open routes.

**How to avoid (M001 doc, M012 enforce):**
- Dev: open is fine.
- Prod: gate behind one of (a) Tailscale/Cloudflare Access (preferred), (b) IP allowlist (Prometheus scraper IP only), or (c) bearer token via `X-Prometheus-Token` header validated against shared Doppler secret. Document choice in `docs/runbooks/observability.md`. **Decide at M008 or M011; M001 ships open with a `// TODO(M008): gate /api/metrics` comment** — but per content-complete rule, frame it as "Metrics route is open in dev; production gating handled in M008/M011 per `docs/runbooks/observability.md`" rather than a TODO.

**Warning signs:** Public IP `curl https://ecommerce.brand.com/api/metrics` returns Prometheus payload.

### 3.6 OTel instrumentation file split for Edge/Node

**What goes wrong:** `import` of `@opentelemetry/sdk-node` at the top of `instrumentation.ts` works in Node but throws in Edge: `Module not found: 'http'` or similar.

**How to avoid:** Two-file pattern (§2.6). Top-level `instrumentation.ts` is a thin async loader that dynamically imports `instrumentation.node.ts` only when `process.env.NEXT_RUNTIME === 'nodejs'`. [CITED: nextjs.org/docs/app/guides/open-telemetry]

**Warning signs:** Next build error "Module not found" pointing at OTel deps; Edge runtime warnings during `next build`.

### 3.7 Doppler secrets leaking into client bundles

**What goes wrong:** A dev refactors a server-only constant into a shared file; webpack inlines it into client chunks. The CI grep gates (REQ-503) catch the env-var-name pattern but NOT a hardcoded secret.

**How to avoid:**
- ESLint rule that flags `process.env.NEXT_PUBLIC_*` access for any name matching `KEY|SECRET|TOKEN|PASSWORD`.
- REQ-427 `__NEXT_DATA__` audit (§2.10) catches built-output secrets.
- Doppler injection via `doppler run` rather than `.env.production` files reduces the surface.

**Warning signs:** `pnpm scripts/scan-next-data.ts` reports a hit on `sk_live_`, `whsec_`, JWT-shaped strings, or AWS-key-shaped strings.

### 3.8 Cloudflare Images: server-side only — never browser

**What goes wrong:** Convenient client-side upload UX leaks the API token (REQ-304 violation).

**How to avoid:** `packages/media` exports clients that take the API token from server-only env. Tag the `cloudflare-images.ts` file with the `'use server'` directive at the top of any function that touches the token, OR put the implementation in a server-only entry point. M005 pattern: client requests a signed upload URL via `/api/media/upload-url`; server (with token) generates one-time URL; browser uploads directly to Cloudflare with that URL.

**Warning signs:** ESLint catches `import { createImagesClient } from '@mjagency/media'` in a `'use client'` file.

### 3.9 BullMQ queue prefix not standardized

**What goes wrong:** Different agencies' jobs collide in Redis because someone forgot the `agency:<id>:bull:` prefix.

**How to avoid:** **Even at M001 (no real queues yet)**, lock the prefix convention in `packages/config/src/agency-constants.ts`:
```ts
export const REDIS_KEY = {
  cache: (agencyId: string, key: string) => `agency:${agencyId}:cache:${key}`,
  session: (agencyId: string, userId: string) => `agency:${agencyId}:session:${userId}`,
  bullPrefix: (agencyId: string) => `agency:${agencyId}:bull`,
  rateLimit: (agencyId: string, ip: string) => `agency:${agencyId}:ratelimit:${ip}`,
} as const
```
M002+ uses these helpers exclusively.

**Warning signs:** Redis MONITOR shows un-prefixed keys; integration test for cross-agency isolation fails.

### 3.10 Stripe CLI in dev needs test-mode keys, not prod

**What goes wrong:** A dev pastes prod `sk_live_*` into Doppler `mjagency-shared` config; webhook forwarding triggers prod side effects.

**How to avoid:** Use Doppler **configs** (not just projects). `mjagency-shared` has configs `dev`, `staging`, `prod`. Stripe key in `dev` config is `sk_test_*` only. CI/dev never reads `prod` config. Document in `docs/runbooks/secrets.md`.

**Warning signs:** Stripe CLI logs show charges going to live customers in dev.

### 3.11 Turborepo cache invalidation on root config changes

**What goes wrong:** Editing `tsconfig.base.json` invalidates every package's typecheck cache, multiplying CI cost.

**How to avoid:** Keep `globalDependencies` minimal. Don't put unstable-changing files there. For files that change a lot (e.g. `pnpm-lock.yaml`), Turborepo already factors them into hashes — don't double-add to `globalDependencies`.

**Warning signs:** Turbo cache hit rate <50%; CI times grow linearly.

### 3.12 (Bonus) Dev startup ordering — Postgres must be ready before app

**What goes wrong:** `pnpm dev` boots before Postgres is ready; Payload throws connection errors and the dev server dies.

**How to avoid:** App start scripts should `wait-on tcp:5432` (or PgBouncer port) before launching. Or document `docker compose up -d && wait-on http://localhost:5050 && pnpm dev` in `docs/runbooks/local-dev.md`. Healthcheck in `docker-compose.yml` already exists for `postgres`; encourage `depends_on: { postgres: { condition: service_healthy } }` for app-side compose if any.

**Warning signs:** First `pnpm dev` after `docker compose up` fails; second invocation succeeds.

---

## Validation Architecture

> **MANDATORY:** This section maps each ROADMAP Phase 1 success criterion to its concrete verification mechanism. Read by Nyquist plan-checker Dimension 8.

### Phase 1 success criteria → automated verification

| # | Success Criterion (ROADMAP) | Verification Mechanism | Artifact Location |
|---|------------------------------|------------------------|-------------------|
| 1 | `pnpm dev --filter=@mjagency/web-main` starts without error | CI job runs `pnpm install --frozen-lockfile && pnpm dev --filter=@mjagency/web-main &` then `wait-on http://localhost:3000 -t 60000` then `curl -fsS http://localhost:3000` returns 200 | `.github/workflows/pr.yml` job `dev-smoke`; helper `scripts/dev-smoke.ts` |
| 2 | Docker Compose: all services healthy | `docker compose --profile dev up -d` + `docker compose ps --format json \| jq -e 'all(.[]; .Health == "healthy" or .State == "running")'` | `.github/workflows/pr.yml` job `compose-smoke`; helper `scripts/compose-smoke.ts` |
| 3 | CF Images test upload returns AVIF URL | Integration test in `packages/media` using a Cloudflare Images **dev account** (creds from Doppler `mjagency-shared` config `ci`); uploads a 1×1 PNG fixture, asserts the response URL ends with `/avif` and the URL is fetchable | `packages/media/src/__tests__/cloudflare-images.integration.test.ts`; gated by `INTEGRATION=cloudflare-images` env so unit-test runs skip it |
| 4 | OTel trace visible in Grafana Tempo end-to-end | Integration test: bring up compose; hit `/api/health` on web-main with a known `traceparent` header; query Tempo at `http://localhost:3200/api/traces/<trace_id>`; assert spans include the route handler + Postgres query (if any). | `apps/web-main/src/__tests__/otel-tempo.integration.test.ts`; helper `packages/testing/src/tempo-client.ts` |
| 5 | CI passes on main branch | `.github/workflows/main.yml` runs full pipeline; branch protection requires green | GitHub branch protection rule on `main` (manual config; documented in `docs/runbooks/github-setup.md`) |
| 6 | `pnpm list payload` shows exactly 3.82.1 across all apps | CI step: `pnpm list payload --depth=0 --json \| jq -e 'all(.[]; .dependencies.payload.version == "3.82.1")'` | `.github/workflows/pr.yml` job `security-grep` step `REQ-501` |

### Per-requirement verification (REQ-001…REQ-503)

| Req ID | Verification Mechanism | Artifact Location |
|--------|------------------------|-------------------|
| REQ-001 | `pnpm install --frozen-lockfile` succeeds; `pnpm -r --workspace-root exec node -e "console.log(require('./package.json').name)"` lists 13 apps + 13 packages | CI job `install` |
| REQ-002 | covered by Success Criterion #2 | as above |
| REQ-003 | `pnpm turbo run typecheck --filter=@mjagency/media` green; integration test gated by `INTEGRATION=cloudflare-images` (Success Criterion #3) | as above |
| REQ-004 | covered by Success Criterion #4 | as above |
| REQ-005 | CI green on main; canary gate is M012 (deferred, documented as out-of-scope at M001) | branch protection |
| REQ-006 | Manual review: `docs/runbooks/vps-provisioning.md` documents 8GB+4GB swap requirement | runbook file existence check in CI |
| REQ-007 | `pm2 start ecosystem.config.cjs && pm2 jlist \| jq '[.[] \| select(.name \| startswith("pgbouncer-"))] \| length' == 13` (dev only at M001; prod app PM2 cluster mode is M012) | `scripts/dev-pm2-smoke.sh` |
| REQ-304 | covered by REQ-503 grep | as above |
| REQ-307 / REQ-426 | Vitest unit test on `createLogger()`: log object containing `password`, `email`, `phone`, `token`, `secret`, `apiKey`, `creditCard`, `ssn`, `refreshToken`, `accessToken`, `jti` — assert each redacts to `[REDACTED]` | `packages/config/src/__tests__/logger.test.ts` |
| REQ-427 | `scripts/scan-next-data.ts` builds web-main, crawls `.next/server/app/**/*.html`, scans for known secret patterns — exits 0 = pass | `.github/workflows/pr.yml` job `next-data-secret-audit` |
| REQ-428 | Manual at signup time: `doppler projects list \| grep -c '^mjagency-' >= 13` (or 1+13 configs if free-tier fallback) | `docs/runbooks/secrets.md` checklist |
| REQ-501 | `pnpm list payload --depth=0 \| grep "payload 3.82.1"` (across workspace) | CI job `install` step |
| REQ-502 | `! grep -rn "jsonwebtoken" apps packages --include='*.ts' --include='*.tsx' --include='package.json'` | CI job `security-grep` |
| REQ-503 | `! grep -rnE "NEXT_PUBLIC_[A-Z_]*KEY" apps packages --include='*.ts' --include='*.tsx' --include='*.env*'` | CI job `security-grep` |

### Sampling rate
- **Per task commit:** Turbo-affected `pnpm turbo run lint typecheck test` (sub-30 second feedback for typical task)
- **Per slice merge to milestone branch:** Full `pnpm turbo run lint typecheck test build size-limit`
- **Per phase gate:** All Wave-0 test files exist + green; CI green on milestone branch; manual sign-off on 6 ROADMAP success criteria; `pnpm headless` not yet implemented (M012)

### Wave 0 Gaps

The following test infrastructure must be created during phase execution before requirement tests can run:

- [ ] `packages/testing/vitest.config.ts` — shared Vitest config + tsconfig + coverage setup
- [ ] `packages/testing/src/fixtures/agency-fixture.ts` — 12 agency slugs + UUIDs for tests
- [ ] `packages/testing/src/msw/handlers.ts` — base MSW handlers (Stripe webhook, CF Images, Cal.com)
- [ ] `packages/testing/src/tempo-client.ts` — Tempo HTTP query helper for OTel integration tests
- [ ] `packages/config/src/__tests__/logger.test.ts` — Pino redact (REQ-307, REQ-426)
- [ ] `apps/web-main/src/__tests__/health.test.ts` — exercises `/api/health` + OTel + metrics
- [ ] `apps/web-main/src/__tests__/otel-tempo.integration.test.ts` — Success Criterion #4
- [ ] `packages/media/src/__tests__/cloudflare-images.integration.test.ts` — Success Criterion #3
- [ ] `scripts/scan-next-data.ts` — REQ-427
- [ ] `scripts/check-bundle-size.ts` — D-16 +10/+25%
- [ ] `scripts/dev-smoke.ts`, `scripts/compose-smoke.ts`, `scripts/dev-pm2-smoke.sh`
- [ ] `.github/workflows/pr.yml` and `.github/workflows/main.yml`
- [ ] `.github/dependabot.yml` — ignore: payload, @payloadcms/*

---

## Runtime State Inventory

> Phase 1 is greenfield — no existing system to migrate from. Categories where state would normally live are listed for completeness with explicit "not applicable at M001" rationale.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Postgres + Redis are created fresh by Docker Compose at M001 | None at M001; data migration concerns begin in M002 |
| Live service config | None — no n8n, no Cal.com, no SaaS APM at M001. Stripe CLI dev mode forwards webhooks but does not register persistent webhook endpoints. Doppler projects ARE created at M001 but they're net-new (not migrated). | Doppler signup task at M001 creates 13 projects fresh; no migration |
| OS-registered state | None at M001; PM2 dev ecosystem registers in-process names (`pgbouncer-brand`, etc.) but these are dev-only and ephemeral | None |
| Secrets / env vars | None pre-existing — secrets are created in Doppler at M001 (slice 6, Task 6.1) | Document creation flow in `docs/runbooks/secrets.md` |
| Build artifacts / installed packages | None — `node_modules`, `.next`, `dist` all created from scratch | None |

**Verified by:** repo `git log` shows only initial commits + planning docs; no `apps/`, `packages/`, `infra/`, or running services exist yet (per `.planning/STATE.md`).

---

## Environment Availability

> Verify before plan execution begins. The planner SHOULD include environment-prep tasks (install missing) in slice 1 / 2.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All apps + scripts | (verify on dev machine) | >=22.x | None — install via nvm before starting |
| pnpm | Package management | (verify) | 10.x | `corepack enable && corepack prepare pnpm@10 --activate` |
| Docker | Compose stack | (verify) | 24+ | Required; no fallback for local dev fidelity |
| docker compose v2 | Profiles support | (verify) | 2.20+ | Required (older `docker-compose` v1 lacks profiles) |
| PgBouncer | 13 dev instances via PM2 | (verify) | 1.21+ | Required — older versions lack `max_prepared_statements` in transaction mode (pitfall 3.3) |
| PM2 | Dev process supervision | (verify) | 5.x | `npm install -g pm2` |
| Stripe CLI | Webhook forwarding (dev profile) | (verify) | latest | Optional — only dev profile uses it |
| Doppler CLI | Secret injection | NOT YET CONFIGURED | — | Required; install per `docs.doppler.com/docs/install-cli` |
| Cloudflare account | Images / Stream / R2 | (verify org has paid CF account) | — | M005 hard requirement; M001 ships SDK scaffolds even without creds |
| GitHub repo | CI/CD | YES (this repo) | — | — |

**Missing dependencies with no fallback:**
- Cloudflare paid account (Images requires Pro+; Stream requires Stream subscription; R2 has free tier). Org-level decision; flag for owner if not already in place. Phase 1 testing of Success Criterion #3 needs CF dev account credentials in Doppler.

**Missing dependencies with fallback:**
- If org doesn't yet have Cloudflare credentials at M001 task execution time, gate the integration test behind `INTEGRATION=cloudflare-images` env; stub the SDK at the type level so build/typecheck pass. CI runs the integration job only when `secrets.CLOUDFLARE_API_TOKEN` is present.

---

## Code Examples

### Verified pattern: `withPayload` next.config.mjs
[Source: payloadcms.com/docs/getting-started/installation]

```js
import { withPayload } from '@payloadcms/next/withPayload'
const nextConfig = { reactStrictMode: true }
export default withPayload(nextConfig)
```

### Verified pattern: Next 15 instrumentation file split
[Source: nextjs.org/docs/app/guides/open-telemetry]

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
```

### Verified pattern: PgBouncer transaction mode + prepared statements
[Source: pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode]

```ini
[pgbouncer]
pool_mode = transaction
max_prepared_statements = 100   # PgBouncer 1.21+ required
```

### Verified pattern: Pino Edge fallback
[Source: trysmudford.com/blog/nextjs-edge-logging]

```ts
// In middleware.ts (Edge runtime) — DO NOT import pino
function edgeLog(level: string, msg: string, ctx?: object) {
  console.log(JSON.stringify({ level, msg, time: Date.now(), ...ctx }))
}
```

### Verified pattern: Turbo 2.x `tasks` config
[Source: turborepo.dev/docs/reference/configuration]

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
    "dev":   { "cache": false, "persistent": true }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `turbo.json` `pipeline` key | `turbo.json` `tasks` key | Turborepo 2.0 (2024) | Plan must use `tasks` |
| Next.js `experimental.instrumentationHook: true` | auto-detected `instrumentation.ts` | Next 15 stable | Remove the experimental flag — it's deprecated |
| Pino `transport: { target: 'pino-loki' }` | Pino → stdout → Promtail → Loki (12-factor) | n/a (architectural choice; D-09) | Decouples app from log backend |
| `@next/bundle-analyzer` for CI thresholds | `size-limit` for thresholds + `@next/bundle-analyzer` for visualization | n/a (industry pattern) | Use `size-limit` for fail/warn |
| ESLint `.eslintrc.json` | ESLint 9 flat config (`eslint.config.js`) | ESLint 9 (2024) | M001 ships flat config |
| PgBouncer transaction mode incompatible with prepared statements | PgBouncer 1.21+ supports `max_prepared_statements` in transaction mode | PgBouncer 1.21 (2023) | Requires version pin in install docs |

**Deprecated/outdated:**
- `experimental.instrumentationHook: true` — remove
- `next/legacy/image` — don't use (M001 doesn't need it; document for M008)
- `pages/` directory routes — Next 15 App Router only
- `jsonwebtoken` library — banned

---

## Assumptions Log

> Claims tagged `[ASSUMED]` requiring user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Doppler free tier supports 13 projects (1 shared + 12 agency) | §2.11 Doppler workflow | Medium — fallback exists (1 project + 13 configs) but reduces per-tenant rotation isolation; flag at signup time |
| A2 | Vitest 2.x is the current stable line for Phase 1 | Standard Stack | Low — verify on install; Vitest 3.x exists but 2.x is mature |
| A3 | Cloudflare paid account is in place at the org level (or will be by Phase 5) | Environment Availability | Medium — M001 SDK scaffolds work without creds; integration test (Success Criterion #3) and M005 require real creds |
| A4 | `prettier` 3.x is current and compatible with all listed plugins | Standard Stack | Low — verify on install |
| A5 | `cloudflare` and `blurhash` npm package versions are current and stable | Standard Stack — Cloudflare scaffolds | Low — verify on install |
| A6 | Existing GSD-2 docs in `mjagency/` should be left untouched (per CONTEXT) AND a copy of `CLAUDE.md` + `PROJECT.md` should also live at repo root (per `mjagency/specs/gsd-config.md`) | §2.17 Repo Structure | Low — recommend symlinks to keep single source of truth; if symlinks unavailable on Windows, planner must decide between copy-with-CI-parity-check or alternative |
| A7 | Tailwind v4 + Next 15.5 + Payload 3.82.1 work together at M001 (no PostCSS/Lightning CSS conflicts) | Standard Stack | Medium — Tailwind v4 changed PostCSS pipeline; if there's a conflict, fall back to Tailwind 3.x (Tailwind v4 is locked but if hard-blocked, escalate) |
| A8 | Node 22.x LTS is the locked version (CONTEXT D-15 says `>=22.x`); current dev machines have Node 22 installed | Environment Availability | Low — `.nvmrc` plus CI gate enforce |

---

## Open Questions

1. **CLAUDE.md / PROJECT.md location: dual-copy or symlink?**
   - What we know: `mjagency/specs/gsd-config.md` mandates single CLAUDE.md + PROJECT.md at repo root. CONTEXT keeps `mjagency/` as canonical spec source.
   - What's unclear: whether to symlink (Linux/macOS easy; Windows native problematic) or duplicate-with-CI-content-check.
   - Recommendation: **Symlink on POSIX, copy + CI parity check on Windows.** Document in `docs/runbooks/local-dev.md`. Either way, both files are present at root for GSD-2 auto-injection.

2. **`/api/metrics` access control in production: Tailscale, IP allowlist, or bearer token?**
   - What we know: must not be public (pitfall 3.5).
   - What's unclear: org's preferred control plane.
   - Recommendation: **Defer to M008 or M011.** M001 ships open with explicit doc note. CONTEXT D-10 requires the route at M001 but doesn't lock auth method.

3. **Doppler tier — confirm free tier covers 13 projects before signup task lands.**
   - What we know: free tier historically capped at 5 projects.
   - What's unclear: 2026 free tier limits.
   - Recommendation: **First plan task in slice 6 = "verify Doppler free-tier project count and signup."** If free tier is insufficient, plan branches to fallback (1 project + 13 configs) or escalate to user for paid-tier purchase.

4. **PM2 ecosystem in dev: are devs expected to run `pm2 start ecosystem.config.cjs` locally, or is this only for the CI smoke test?**
   - What we know: D-05 says PM2 supervises 13 PgBouncers in dev. Hosts script is for one-time setup.
   - What's unclear: whether `pnpm dev` should auto-start PM2 or whether devs run `pm2 start` manually after `docker compose up`.
   - Recommendation: **Document the manual flow** (`docker compose up -d && pm2 start ecosystem.config.cjs && pnpm dev`) in `docs/runbooks/local-dev.md`. Auto-orchestration via a `pnpm dev:full` wrapper script can be a Claude's-discretion add.

5. **Subdomain hostname convention: `*.localhost` (CONTEXT D-06) vs `*.mjagency.local` (architecture spec line 364).**
   - What we know: CONTEXT D-06 is newer and explicit.
   - What's unclear: whether the spec needs an addendum.
   - Recommendation: **CONTEXT D-06 wins.** Note discrepancy in `docs/runbooks/local-dev.md` so the spec line is reconciled at M005-era spec review.

---

## Sources

### Primary (HIGH confidence)
- **Locked stack & rules:** `mjagency/PROJECT.md`, `mjagency/CLAUDE.md`, `mjagency/specs/architecture.md`, `mjagency/specs/security.md`, `mjagency/specs/milestone-M001.md`, `mjagency/specs/cms.md`, `mjagency/specs/media.md`, `mjagency/specs/gsd-config.md`, `mjagency/AGENTS.md`
- **Phase context:** `.planning/phases/01-foundation-infra/01-CONTEXT.md`, `.planning/phases/01-foundation-infra/SEED.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`
- **Version verification (npm registry, 2026-04-25):** `payload@3.82.1`, `next@15.5.15` (stable 15.x), `turbo@2.9.6`, `pino@10.3.1`, `jose@6.2.2`, `@opentelemetry/sdk-node@0.215.0`, `prom-client@15.1.3`, `drizzle-orm@0.45.2`, `eslint@10.2.1`, `tailwindcss@4.2.4`, `pnpm@10.33.2`, `bullmq@5.76.2`, `ioredis@5.10.1`, `@aws-sdk/client-s3@3.1037.0`
- **Payload 3 + Next 15 docs:** [payloadcms.com/docs/getting-started/installation](https://payloadcms.com/docs/getting-started/installation), [Payload 3.0 launch post](https://payloadcms.com/posts/blog/payload-30-the-first-cms-that-installs-directly-into-any-nextjs-app), [Payload 3.81.0 release notes](https://www.bradfarleigh.com/2026/04/payload-cms-3-81-0-whats-new-nextjs/)
- **Next.js OTel docs:** [nextjs.org/docs/app/guides/open-telemetry](https://nextjs.org/docs/app/guides/open-telemetry)
- **Turborepo docs:** [turborepo.dev/docs/reference/configuration](https://turborepo.dev/docs/reference/configuration), [turborepo.dev/docs/crafting-your-repository/configuring-tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)
- **PgBouncer config:** [pgbouncer.org/config.html](https://www.pgbouncer.org/config.html)

### Secondary (MEDIUM confidence — verified against secondary source)
- **PgBouncer 1.21 prepared statements:** [pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode](https://pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode), [crunchydata.com/blog/prepared-statements-in-transaction-mode-for-pgbouncer](https://www.crunchydata.com/blog/prepared-statements-in-transaction-mode-for-pgbouncer)
- **Pino + Edge runtime caveats:** [github.com/vercel/next.js/discussions/33898](https://github.com/vercel/next.js/discussions/33898), [trysmudford.com/blog/nextjs-edge-logging](https://www.trysmudford.com/blog/nextjs-edge-logging/)
- **Doppler monorepo CLI:** [docs.doppler.com/docs/cli](https://docs.doppler.com/docs/cli), [docs.doppler.com/docs/install-cli](https://docs.doppler.com/docs/install-cli)
- **OTel + Next.js practical guide:** [signoz.io/blog/opentelemetry-nextjs](https://signoz.io/blog/opentelemetry-nextjs/), [uptrace.dev/guides/opentelemetry-nextjs](https://uptrace.dev/guides/opentelemetry-nextjs)
- **Bundle-size patterns:** [blog.logrocket.com/how-to-analyze-next-js-app-bundles](https://blog.logrocket.com/how-to-analyze-next-js-app-bundles/), [npmjs.com/package/@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- **PgBouncer SCRAM auth:** [crunchydata.com/blog/pgbouncer-scram-authentication-postgresql](https://www.crunchydata.com/blog/pgbouncer-scram-authentication-postgresql)
- **Promtail config:** [grafana.com/docs/loki/latest/clients/promtail](https://grafana.com/docs/loki/latest/clients/promtail/)
- **Grafana provisioning:** [grafana.com/docs/grafana/latest/administration/provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)

### Tertiary (LOW confidence — flag for validation at execution time)
- Doppler 2026 free-tier project count limit (A1)
- Vitest 2.x vs 3.x current stable line (A2)
- Tailwind v4 + Next 15.5 + Payload 3.82.1 PostCSS interaction (A7)

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all locked by `mjagency/PROJECT.md` and verified against npm registry on 2026-04-25
- Architecture patterns: **HIGH** — sourced from official Payload, Next.js, OTel, Turborepo docs
- Pitfalls: **HIGH** — known issues cross-referenced across multiple authoritative sources
- Doppler tier: **MEDIUM** — A1 needs verification at signup
- Test infrastructure (Wave 0): **HIGH** — requires building during execution but standard patterns

**Research date:** 2026-04-25
**Valid until:** 2026-07-25 (3 months — fast-moving Next/Payload ecosystem; re-verify versions on phase start if delayed)

## RESEARCH COMPLETE
