# Phase 1: Foundation + Infra - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Working monorepo with all 13 apps scaffolded (12 agency apps + web-main). Docker Compose for local dev running (Postgres, Redis, Mailhog, Stripe CLI, PgAdmin). Cloudflare pipeline connected (Images + Stream + R2 SDK scaffolds in `packages/media`; Puck and tools as types-only stubs). OpenTelemetry traces flowing to Grafana Tempo. Prometheus + Loki + Grafana stack live. CI/CD pipeline live (GitHub-hosted runners) with full test/typecheck/secret-pattern/version-pin gates. All secrets in Doppler.

Out of scope for Phase 1 (deferred to their own milestones): production VPS provisioning (M012), self-hosted CI runners (M012 migration), per-agency Postgres clusters (M002 in prod), full implementations of `packages/{auth,db,cms,crm,builder,tools,...}` (their respective milestones), Stripe customer/product seeding (M010), SaaS APM integration (M011).

</domain>

<decisions>
## Implementation Decisions

### VPS + CI runner provisioning

- **D-01:** Production VPS is provisioned in **Phase 12 only** (launch milestone). Phases 1–11 stay local-only (Docker Compose) and rely on GitHub-hosted CI.
- **D-02:** **CI runners are GitHub-hosted through Phase 12.** As part of M012 we migrate CI to self-hosted runners on the production VPS. This is the user's stated end-state.
- **D-03:** **Stripe CLI in Docker Compose at M001 = webhook forwarding only.** Single Stripe CLI container forwards to all 13 apps' `/api/stripe/webhook` endpoints in test mode. No customer/product/price seeding at M001 — that lands in M010. Test-mode keys via Doppler `mjagency-shared`.

### Local DB topology + subdomain routing

- **D-04:** **Local Postgres = ONE Postgres 17 container with 13 logical databases** (`brand_db`, `ecommerce_db`, `growth_db`, `webdev_db`, `ai_db`, `branding_db`, `strategy_db`, `finance_db`, `engineering_db`, `product_db`, `video_db`, `graphic_db`). Each has its own role + RLS. Matches the M001 spec exactly. Production topology (separate clusters per agency) lives in M002; PgBouncer + RLS behavior is identical at the connection-string level so dev fidelity is acceptable.
- **D-05:** **PgBouncer per agency:** 13 PgBouncer instances (transaction mode, `pool_size=20`, ports `6432`–`6444`). Run via PM2 in dev. M001 ships configs + PM2 ecosystem files; full per-cluster prod variant tunes in M002.
- **D-06:** **Subdomain routing in dev = `/etc/hosts` entries** documented per-OS in `docs/runbooks/local-dev.md` (macOS, Linux, Windows-WSL2, Windows native). 13 entries: `127.0.0.1 brand.localhost ecommerce.localhost growth.localhost webdev.localhost ai.localhost branding.localhost strategy.localhost finance.localhost engineering.localhost product.localhost video.localhost graphic.localhost`. Simplest approach, works offline, no third-party dependencies.
- **D-07:** **PgAdmin in Docker Compose** (dev profile only) with pre-configured connections to all 13 DBs. New devs get a working GUI on first `docker compose up`. Per the M001 spec.

### Observability scope at M001

- **D-08:** **OTel exporter target = Tempo only** at M001. SaaS APM (Honeycomb / New Relic / Datadog) explicitly deferred to Phase 11 (Analytics + Compliance + Security). No SaaS APM secrets in Doppler at M001.
- **D-09:** **Pino log transport = `Pino → stdout → Promtail → Loki`.** Apps write JSON to stdout; PM2 (prod) and Docker (dev) capture; Promtail tails container/PM2 logs and ships to Loki. 12-factor pattern, decouples app from log transport, log delivery survives Loki outages.
- **D-10:** **`/api/metrics` Prometheus scrape endpoint exposed by ALL 13 apps from M001.** Prometheus scrapes each on an `agency_id` label. Wire-once approach — even though apps are mostly empty at M001, no revisit needed in M008.
- **D-11:** **Initial Grafana dashboards (M001) = three** — Request rate, Error rate, Latency p50/p95/p99 — each with per-agency `agency_id` drill-down. Provisioned as code in `infra/grafana/` (JSON files committed to repo).
- **D-12:** **Pino redact config (REQ-307, REQ-426)** applies to: tokens, emails, phones, secrets, JWT claims, Stripe keys, R2 access keys, Doppler tokens, refresh-token strings, password fields. Redact path list lives in `packages/config/logger.ts`.
- **D-13:** **DB query trace_id injection:** every Drizzle query gets a `/* trace_id=<id> */` SQL comment via a Drizzle middleware/wrapper in `packages/db` (stub at M001, real wrapper in M002). At M001 we ship the OTel SDK + traceparent propagation + Pino trace_id binding.

### Repo strictness + package scaffolding

- **D-14:** **ESLint preset = `next/core-web-vitals` + `@typescript-eslint/recommended`** + custom rules: forbid `import 'jsonwebtoken'`, forbid `dangerouslyAllowSVG`, forbid `dangerouslySetInnerHTML` from non-sanitized sources, forbid `NEXT_PUBLIC_.*KEY` env names. Prettier alongside. Strict-type-checked deferred — too noisy during scaffold-heavy phases.
- **D-15:** **Node version pin = `engines.node >=22.x` in every `package.json` + `.nvmrc` at repo root.** CI job fails on mismatch. Volta deferred (overhead > benefit).
- **D-16:** **Bundle-size budget thresholds:** **+10% growth = WARN, +25% growth = HARD FAIL.** Enforced via `next-bundle-analyzer` snapshot diffed against `main` baseline. Per-app baseline (each of the 13 apps tracked independently). M001 establishes baseline = first commit on each app.
- **D-17:** **All 13 `packages/*` scaffolded as empty stubs at M001:** `packages/{ui,db,config,auth,ai,media,cms,crm,email,seo,tools,builder,testing}`. Each gets `package.json` + `tsconfig.json` + `src/index.ts` + a one-paragraph README pointing at the milestone that fills it. Avoids "add new workspace" churn later. Workspaces enumerated in `pnpm-workspace.yaml` from day one.
- **D-18:** **npm scope = `@mjagency/*`.** Apps: `@mjagency/web-main`, `@mjagency/web-ecommerce`, … Packages: `@mjagency/db`, `@mjagency/auth`, etc. Private packages (no npm publish).

### Claude's Discretion

- **Commit cadence:** atomic commit per task within a slice (rough heuristic: each `Task X.Y` from M001 spec → 1 commit, sometimes 2 if a task naturally splits). All commits land on `milestone/M001-foundation-infra` branch; squash to `main` at milestone close.
- **Doppler tier:** start on **free tier** (sufficient for v1's user count and this number of projects). Upgrade only if required by a feature we hit. Capture as a backlog item in case we hit tier limits.
- **Turborepo pipeline:** `build → typecheck → lint → test → bundle-size`. Dependencies ordered via `dependsOn`. `dev` task `persistent: true`. Cache enabled, remote cache deferred until CI volume justifies it.
- **Tailwind v4 config:** single `@theme` block in `packages/ui/styles/theme.css`, imported by every app. Tokens are placeholders at M001 (real values in M004).
- **Hosts file install script:** include a `scripts/setup-hosts.sh` (macOS/Linux) and `scripts/setup-hosts.ps1` (Windows) to auto-append the 13 entries with sudo prompt. Reduces friction for new devs.
- **PM2 ecosystem file:** one `ecosystem.config.cjs` at repo root supervising 13 PgBouncer processes + Promtail + Stripe CLI in dev. Production ecosystem file is built in M012.
- **Repo layout:** keep `mjagency/` (existing GSD-2 docs) untouched and treat it as the canonical spec source. New code lives at repo root in `apps/`, `packages/`, `scripts/`, `infra/`, `docs/`.
- **GitHub Actions matrix:** single Linux runner at M001 (Ubuntu latest). Multi-OS matrix (Windows/macOS) deferred — VPS is Linux, prod parity wins.

### Folded Todos

None — no pending todos at this point.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 source spec (authoritative for goal + slices)
- `mjagency/specs/milestone-M001.md` — full M001 spec: 6 slices × tasks, success criteria, secret list (this CONTEXT extracted from it)
- `.planning/phases/01-foundation-infra/SEED.md` — pre-discuss seed extracted from M001 spec, lists locked decisions and open questions

### Project-level context (required reading)
- `mjagency/PROJECT.md` — locked stack, architecture model, per-agency isolation, constraints
- `mjagency/CLAUDE.md` — non-negotiable coding rules: Payload pin, jose-only, server-action auth pattern, content-complete rule, anti-fab rules, security mandatory patterns, agency isolation, TypeScript strict
- `mjagency/AGENTS.md` — GSD-2 agent routing per task type
- `.planning/PROJECT.md` — `.planning/` mirror with constraints + key decisions
- `.planning/REQUIREMENTS.md` — REQ-001…REQ-507 with phase traceability (Phase 1 covers REQ-001…007, REQ-304, REQ-307, REQ-426, REQ-427, REQ-428, REQ-501, REQ-502, REQ-503)
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, plan list

### Topical specs (read for cross-cutting decisions)
- `mjagency/specs/architecture.md` — architecture spec
- `mjagency/specs/security.md` — security spec (informs Pino redact, secret-pattern CI checks, agency isolation)
- `mjagency/specs/gsd-config.md` — GSD-2 config baseline
- `mjagency/specs/cms.md` — Payload 3.82.1 embedding pattern (relevant for `web-main` base template at M001)

### README / Repo intro
- `mjagency/README.md` — project orientation + critical rules summary

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- None — Phase 1 is a greenfield scaffold. The repository currently contains only `mjagency/` (planning docs), `.planning/` (this), `.gitignore`, and `README.md`. Apps and packages are created BY this phase.

### Established Patterns

- **GSD-2 spec authoring style** — verbatim, declarative, ASCII-banner section headers. Maintain in any docs we add (`docs/runbooks/*.md`).
- **`mjagency/` is the canonical spec source.** Treat it as read-only for the duration of Phase 1. New planning artifacts go in `.planning/`. Code goes in `apps/`, `packages/`, `scripts/`, `infra/`, `docs/`.

### Integration Points

- **Future Phase 2** consumes: Drizzle middleware/wrapper stubs in `packages/db`, agency_id field convention, RLS hooks
- **Future Phase 3** consumes: `packages/auth` stub, Cloudflare middleware excluder pattern (matcher must exclude `/(payload)/admin/*` and `/api/*`), Pino redact config in `packages/config/logger.ts`
- **Future Phase 5** consumes: Payload 3.82.1 embedded via `withPayload()` in `apps/web-main` (this pattern is established in M001 slice 1.2 and reused in all 12 agency apps)
- **Future Phase 8** consumes: every-app `/api/metrics` endpoint (already wired at M001 per D-10), bundle-size baseline per app, hosts-routing convention
- **Future Phase 11** consumes: OTel collector configurability — must be able to add SaaS APM exporter without re-architecting Phase 1's exporter wiring
- **Future Phase 12** consumes: PM2 dev ecosystem file (templated for prod), GitHub Actions workflows (refactored for self-hosted runner), Doppler injection pattern

</code_context>

<specifics>
## Specific Ideas

- **Spec compliance:** every M001 slice and task in `mjagency/specs/milestone-M001.md` must be honored. Plan tasks should map 1:1 to the M001 task list (Task 1.1, Task 1.2, …, Task 6.2).
- **Docker Compose dev profile:** Compose `profiles:` flag — `dev` profile includes PgAdmin + Stripe CLI + Mailhog (developer convenience); `core` profile is just Postgres + Redis + Promtail + observability stack. `docker compose --profile dev up` for full local; `docker compose up` for minimal.
- **Local subdomain UX:** the `setup-hosts.sh/.ps1` script is non-negotiable — the user's stated goal is "walk away" automation, and 13 manual `/etc/hosts` edits per dev machine is friction we should eliminate.
- **Doppler injection:** at deploy time use `doppler run -- pnpm start`. At build time use `doppler secrets download --no-file --format=env > .env.production` followed by `pnpm build`. Pattern documented in `docs/runbooks/secrets.md`.
- **OTel resource attributes:** every app sets `service.name=mjagency-<agency>`, `service.namespace=mjagency`, `deployment.environment=<dev|prod>`, `agency.id=<slug>`. Standardized so dashboards filter cleanly across all 13 apps.

</specifics>

<deferred>
## Deferred Ideas

- **SaaS APM (Honeycomb / New Relic / Datadog) integration** → Phase 11 (Analytics + Compliance + Security). OTel collector config at M001 should be exporter-pluggable so Phase 11 just adds another exporter, not re-architects.
- **Self-hosted CI runners on prod VPS** → Phase 12 (Launch). M012 includes a CI migration task.
- **Stripe customer/product/price seeding for test mode** → Phase 10 (Tools + Pitch + PDF + Builder).
- **Strict-type-checked ESLint preset upgrade** → revisit at Phase 8 once apps are fleshed out and false-positive rate is known.
- **Volta-based Node version pin** → not needed if `engines.node` + `.nvmrc` work; revisit only if cross-platform Node version drift causes real issues.
- **Remote Turborepo cache** → defer until CI volume justifies it (likely Phase 8+ when 13 apps are actually building real code).
- **Doppler tier upgrade (free → team)** → revisit only if we hit a feature/seat limit. Capture as a backlog item.
- **Multi-OS GitHub Actions matrix (Windows + macOS runners)** → not needed if all devs and prod are Linux/WSL2. Revisit only if a non-Linux dev environment becomes the default.
- **Real-time observability for builder/CMS edits** → Phase 5 (CMS) consideration, not Phase 1.

</deferred>

---

*Phase: 01-foundation-infra*
*Context gathered: 2026-04-25*
