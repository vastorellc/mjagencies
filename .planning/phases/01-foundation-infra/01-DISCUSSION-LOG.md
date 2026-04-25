# Phase 1: Foundation + Infra - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 01-foundation-infra
**Areas discussed:** VPS + CI runner provisioning, Local DB topology + subdomain routing, Observability scope at M001, Repo strictness + package scaffolding

---

## Gray Area Selection

| Area | Description | Selected |
|------|-------------|----------|
| VPS + CI runner provisioning | When to provision VPS; CI runner location | ✓ |
| Local DB topology & subdomain routing | 1 vs 13 Postgres instances; hosts strategy; DB GUI | ✓ |
| Observability scope at M001 | OTel target, Pino transport, dashboards depth | ✓ |
| Repo strictness & package scaffolding | ESLint, Node pin, bundle budget, packages/* coverage | ✓ |

User selected ALL FOUR areas.

---

## VPS + CI Runner Provisioning

### Q1: When does the production VPS get provisioned?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 12 only | Defer until launch milestone. Phase 1 stays local-only. Lowest cost during build. | ✓ |
| Phase 11 | Provision alongside WAF/security hardening for prod-like analytics testing. | |
| Phase 1 (early) | Provision now so OTel + CI can deploy to a real target. Highest cost. | |

**User's choice:** Phase 12 only

### Q2: Where do CI runners live?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub-hosted | Free for public, $0.008/min private. Zero infra to manage. | |
| Self-hosted on VPS | Cheaper at high CI volume; requires VPS + hardening. | ✓ |
| GitHub-hosted now, revisit later | Hosted now, switch later if costs justify. | |

**User's choice:** Self-hosted on VPS

### Conflict detected
Self-hosted CI requires a VPS, but VPS was deferred to Phase 12.

### Q3: Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub-hosted through Phase 12, then migrate | Use hosted during build, migrate to self-hosted on prod VPS at M012. | ✓ |
| Provision a small build-only VPS at Phase 1 | Two VPSes long-term or decommission build VPS later. | |
| Pull production VPS forward to Phase 1 | Single box from day one, but costs run for the full build duration. | |
| GitHub-hosted permanently | Drop self-hosted plan entirely. | |

**User's choice:** GitHub-hosted through Phase 12, then migrate

**Final resolution:** CI = GitHub-hosted runners through Phases 1–11. M012 includes a migration task to self-hosted runners on the production VPS.

### Q4: Stripe CLI in Docker Compose — scope at M001?

| Option | Description | Selected |
|--------|-------------|----------|
| Webhook forwarding only | Single container forwarding to all 13 apps' webhook endpoints. | ✓ |
| Forwarding + seed test fixtures | Also seed sample customers/products/prices. | |
| Skip Stripe CLI at M001 | Defer entirely to M010. | |

**User's choice:** Webhook forwarding only

---

## Local DB Topology & Subdomain Routing

### Q1: Confirm the local Postgres deployment shape?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 Postgres 17 instance + 13 logical DBs | Matches M001 spec; simplest local dev. | ✓ |
| 13 separate Postgres containers | Mirrors prod topology exactly; heavy on local resources. | |
| 1 cluster + 1 'edge case' second cluster | Hybrid; complexity without clear payoff. | |

**User's choice:** 1 Postgres 17 instance + 13 logical DBs

### Q2: Local subdomain routing for the 13 apps in dev?

| Option | Description | Selected |
|--------|-------------|----------|
| /etc/hosts entries with per-OS docs | Document entries in a runbook for macOS/Linux/Windows. Offline-capable. | ✓ |
| *.localhost wildcard (RFC 6761) | Modern browsers/Node resolve automatically; potential middleware issues. | |
| *.nip.io / sslip.io magic DNS | Always resolves correctly; depends on third-party service. | |
| dnsmasq + local CA | Mirrors prod TLS most closely; highest setup overhead. | |

**User's choice:** /etc/hosts entries with per-OS docs

### Q3: Local DB GUI in Docker Compose?

| Option | Description | Selected |
|--------|-------------|----------|
| PgAdmin in Compose | Pre-configured; new devs get a GUI on first `docker compose up`. | ✓ |
| No GUI in Compose, doc DBeaver/TablePlus | Lighter footprint; devs use whatever they prefer. | |
| Both — PgAdmin default + alternates docs | Most flexibility; doc maintenance overhead. | |

**User's choice:** PgAdmin in Compose

---

## Observability Scope at M001

### Q1: OTel exporter target at M001?

| Option | Description | Selected |
|--------|-------------|----------|
| Tempo only | Single local exporter; defer SaaS APM to Phase 11. | ✓ |
| Tempo + SaaS APM dual export | Configure dual exporters from M001 for early debugging. | |
| Tempo locally + OTel Collector vendor-neutral | Most flexible but adds a moving part. | |

**User's choice:** Tempo only

### Q2: Pino log transport in dev + prod?

| Option | Description | Selected |
|--------|-------------|----------|
| Pino → stdout, Promtail → Loki | 12-factor; log delivery survives Loki outages. | ✓ |
| Pino → Loki direct (pino-loki) | One less infra moving part; couples app to Loki availability. | |
| Pino → file rotation → Loki via Promtail | Most durable; requires log rotation + disk budgeting. | |

**User's choice:** Pino → stdout (PM2/Docker captures), Promtail → Loki

### Q3: /api/metrics Prometheus endpoint scope at M001?

| Option | Description | Selected |
|--------|-------------|----------|
| All 13 apps, scraped by Prometheus | Wire-once; per-agency observability from day one. | ✓ |
| web-main only at M001, expand in M008 | Smaller M001 footprint; revisit OTel/Prometheus config in M008. | |
| Skip Prometheus, OTel metrics only | More modern but Grafana still needs a backend. | |

**User's choice:** All 13 apps, scraped by Prometheus

### Q4: Initial Grafana dashboards in M001?

| Option | Description | Selected |
|--------|-------------|----------|
| Three basic dashboards | Request rate, error rate, latency; per-agency drill-down. Matches spec. | ✓ |
| Basic three + Trace explorer + Log explorer | ~1 extra hour; useful from Phase 2 onward. | |
| Skeleton only | Provision data sources only; build dashboards lazily. | |

**User's choice:** Three basic dashboards

---

## Repo Strictness & Package Scaffolding

### Q1: ESLint preset for the monorepo?

| Option | Description | Selected |
|--------|-------------|----------|
| next/core-web-vitals + @typescript-eslint/recommended | Standard; catches important issues without stylistic noise. | ✓ |
| Add @typescript-eslint/strict-type-checked | Catches more bugs; higher friction during refactors. | |
| Biome instead of ESLint+Prettier | Single Rust-based tool; smaller plugin ecosystem. | |

**User's choice:** next/core-web-vitals + @typescript-eslint/recommended

### Q2: Node version pinning?

| Option | Description | Selected |
|--------|-------------|----------|
| engines.node >=22.x + .nvmrc | Document Node 22 LTS floor; CI fails on mismatch. | ✓ |
| Strict pin via Volta | Auto-switches per-project; cross-platform. | |
| engines.node only, no .nvmrc/Volta | Loosest; devs handle versions. | |

**User's choice:** engines.node >=22.x in package.json + .nvmrc

### Q3: Bundle-size budget enforcement?

| Option | Description | Selected |
|--------|-------------|----------|
| +10% growth = warn, +25% = hard fail | Catches bloat; doesn't block legitimate work. | ✓ |
| +5% growth = hard fail (strict) | Tightest gate; high friction during scaffolding. | |
| Warn-only at any threshold for M001 | Track size; never fail until M008. | |
| No bundle-size CI at M001 | Skip until M008. | |

**User's choice:** +10% growth = warn, +25% = hard fail

### Q4: Which packages/* get scaffolded as empty stubs at M001?

| Option | Description | Selected |
|--------|-------------|----------|
| All 13 packages scaffolded as empty stubs | Avoids 'add new workspace' churn later. | ✓ |
| Only M001-relevant packages | Cleaner M001 PR; more workspace churn across milestones. | |
| Hybrid: all 13 + per-package CONVENTIONS.md | Self-documenting; slightly more M001 work. | |

**User's choice:** All 13 packages scaffolded as empty stubs at M001

---

## Final Wrap-up

### Q: Ready to write CONTEXT.md, or any remaining gray areas to discuss?

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Defaults captured for npm scope, Doppler tier, commit cadence as Claude's discretion. | ✓ |
| Discuss Doppler tier + commit cadence + npm scope | Spend 2-3 more questions before writing. | |
| Add other gray area I'm missing | List 2-3 more candidates and pick. | |

**User's choice:** Ready for context

---

## Claude's Discretion

The user did not weigh in on these — captured in CONTEXT.md as defaults:

- npm scope: `@mjagency/*`
- Commit cadence: atomic commit per task within a slice
- Doppler tier: free tier at start, upgrade only on hitting limits
- Turborepo pipeline: standard `build → typecheck → lint → test → bundle-size`
- Tailwind v4 config: single `@theme` block in `packages/ui`
- Hosts-file install scripts: `setup-hosts.sh`/`setup-hosts.ps1` for dev convenience
- PM2 ecosystem file: dev-only at M001, prod variant in M012
- Repo layout: `mjagency/` stays untouched as canonical spec source; new code at repo root
- GitHub Actions OS: single Linux runner (Ubuntu latest); multi-OS matrix deferred

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section — none surfaced as scope creep, all decisions stayed within the M001 boundary.
