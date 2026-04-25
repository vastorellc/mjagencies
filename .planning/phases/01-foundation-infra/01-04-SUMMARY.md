---
phase: 01-foundation-infra
plan: 04
subsystem: observability
tags: [opentelemetry, prometheus, loki, promtail, tempo, grafana, prom-client, pino-instrumentation, otel-nodesdk]
dependency_graph:
  requires:
    - 01-01 (Turborepo scaffold, packages/config stub, instrumentation.ts Edge guard, Pino logger)
    - 01-02 (docker-compose.yml, ecosystem.config.cjs with promtail commented)
  provides:
    - packages/config/src/otel-node.ts (startNodeSdk factory for all 13 apps)
    - packages/config/src/metrics.ts (createMetrics + singleton helper)
    - apps/web-*/instrumentation.node.ts (Node-runtime OTel boot for all 12+1 apps)
    - apps/web-*/src/app/api/metrics/route.ts (Prometheus scrape endpoint per app)
    - apps/web-main/src/app/api/health/route.ts (trace propagation demo)
    - docker-compose.observability.yml (overlay: prometheus, loki, promtail, tempo, grafana)
    - infra/prometheus/prometheus.yml (12 scrape targets)
    - infra/promtail/promtail-config.yml (agency_id label extraction)
    - infra/tempo/tempo.yml (OTLP HTTP+gRPC receivers)
    - infra/grafana/dashboards/ (3 locked dashboards)
    - packages/testing/src/tempo-client.ts (Tempo query helper)
    - docs/runbooks/observability.md (full runbook)
  affects:
    - 01-05 (CI wires INTEGRATION=otel-tempo gate for otel-tempo.integration.test.ts)
    - 01-06 (Doppler injects OTEL_EXPORTER_OTLP_ENDPOINT per agency)
    - M008 (production /api/metrics auth gating)
    - M011 (SaaS APM second exporter addition)
tech_stack:
  added:
    - "@opentelemetry/sdk-node 0.215.0"
    - "@opentelemetry/auto-instrumentations-node 0.73.0"
    - "@opentelemetry/exporter-trace-otlp-http 0.215.0"
    - "@opentelemetry/instrumentation-pino 0.61.0"
    - "@opentelemetry/resources 2.0.1"
    - "@opentelemetry/semantic-conventions 1.36.0"
    - "@opentelemetry/api 1.9.0"
    - "prom-client 15.1.3"
    - "prom/prometheus:v3.0.1 (Docker)"
    - "grafana/loki:3.3.1 (Docker)"
    - "grafana/promtail:3.3.1 (Docker)"
    - "grafana/tempo:2.6.1 (Docker)"
    - "grafana/grafana:11.4.0 (Docker)"
  patterns:
    - "OTel NodeSDK factory (startNodeSdk) with baked slug fallback in each app"
    - "Edge guard: NEXT_RUNTIME === 'nodejs' in instrumentation.ts (pitfall 3.6)"
    - "prom-client Registry per-process singleton via metrics() helper"
    - "export const runtime = 'nodejs' on /api/metrics route (pitfall 3.8)"
    - "docker-compose overlay pattern (observability opt-in)"
    - "127.0.0.1-only port binding for all observability services (T-01-401)"
    - "Dashboards-as-code via Grafana provisioning"
key_files:
  created:
    - packages/config/src/otel-node.ts
    - packages/config/src/metrics.ts
    - packages/config/src/__tests__/metrics.test.ts
    - packages/testing/src/tempo-client.ts
    - apps/web-main/instrumentation.node.ts
    - apps/web-main/src/app/api/metrics/route.ts
    - apps/web-main/src/app/api/health/route.ts
    - apps/web-main/src/__tests__/otel-tempo.integration.test.ts
    - apps/web-{ecommerce,growth,webdev,ai,branding,strategy,finance,engineering,product,video,graphic}/instrumentation.node.ts (x11)
    - apps/web-{ecommerce,growth,webdev,ai,branding,strategy,finance,engineering,product,video,graphic}/instrumentation.ts (x11)
    - apps/web-{ecommerce,growth,webdev,ai,branding,strategy,finance,engineering,product,video,graphic}/src/app/api/metrics/route.ts (x11)
    - docker-compose.observability.yml
    - infra/prometheus/prometheus.yml
    - infra/loki/loki-config.yml
    - infra/promtail/promtail-config.yml
    - infra/tempo/tempo.yml
    - infra/grafana/datasources/datasources.yml
    - infra/grafana/dashboards/dashboards.yml
    - infra/grafana/dashboards/request-rate.json
    - infra/grafana/dashboards/error-rate.json
    - infra/grafana/dashboards/latency.json
    - docs/runbooks/observability.md
  modified:
    - packages/config/package.json (added OTel + prom-client deps)
    - packages/config/src/index.ts (added startNodeSdk, createMetrics, metrics exports)
    - packages/config/src/agency-constants.ts (added AGENCY_PORTS map)
    - docker-compose.yml (added host.docker.internal:host-gateway extra_hosts for Linux)
    - ecosystem.config.cjs (activated promtail PM2 entry)
decisions:
  - "docker-compose.observability.yml as overlay (not merged into docker-compose.yml) — devs opt-in, cleaner separation"
  - "Grafana on 127.0.0.1:3001:3000 to avoid collision with Next.js dev server on port 3000"
  - "All observability service host ports bound to 127.0.0.1 per T-01-401 mitigation"
  - "OTel NodeSDK in instrumentation.node.ts (not instrumentation.ts) to preserve Edge guard"
  - "Baked slug fallback in instrumentation.node.ts so missing AGENCY env var still tags traces"
  - "Per-process Registry singleton in metrics() helper — prevents double-registration errors"
  - "Pino redact paths preserved through PinoInstrumentation auto-injection (T-01-005 mitigation)"
  - "/api/metrics auth deferred to M008/M011 (T-01-009 accept at M001, mitigate later)"
metrics:
  duration: "30 minutes"
  completed_date: "2026-04-25"
  tasks_completed: 2
  files_created: 50
  files_modified: 5
---

# Phase 01 Plan 04: OTel + Prometheus + Loki + Tempo + Grafana Summary

**Full OpenTelemetry trace pipeline from Next.js Node runtime to Tempo, Pino auto-instrumentation injecting trace_id into log lines, per-app Prometheus scrape endpoints with agency.id labels, and three Grafana dashboards (request rate, error rate, latency p50/p95/p99) provisioned as code with per-agency drill-down.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-25T22:00:00Z
- **Completed:** 2026-04-25T22:30:00Z
- **Tasks:** 2 (Task 4.1 + Task 4.2)
- **Files created/modified:** 55 total

## OTel + Prometheus Stack Versions

| Component | Version | Local URL | Port(s) |
|-----------|---------|-----------|---------|
| @opentelemetry/sdk-node | 0.215.0 | — | — |
| prom-client | 15.1.3 | — | — |
| Prometheus | 3.0.1 | http://localhost:9090 | 9090 |
| Loki | 3.3.1 | http://localhost:3100 | 3100 |
| Promtail | 3.3.1 | http://localhost:9080 | 9080 |
| Tempo | 2.6.1 | http://localhost:3200 | 3200, 4318 (OTLP HTTP), 4317 (gRPC) |
| Grafana | 11.4.0 | http://localhost:3001 | 3001 (host) → 3000 (container) |

## What Was Built

### Task 4.1: OTel NodeSDK + Prom-client per-app + Pino Auto-instrumentation

**`packages/config/src/otel-node.ts`** — `startNodeSdk({ agencyId })` factory:
- Uses `@opentelemetry/sdk-node` NodeSDK with `resourceFromAttributes` for service identity
- `agency.id` resource attribute set from `opts.agencyId` (baked at scaffold time)
- `OTLPTraceExporter` pointing to `OTEL_EXPORTER_OTLP_ENDPOINT` (default: Tempo at port 4318)
- `getNodeAutoInstrumentations` with `@opentelemetry/instrumentation-fs: disabled` (noisy)
- `PinoInstrumentation` auto-injects `trace_id`/`span_id` into Pino log lines under active spans
- SIGTERM handler calls `sdk.shutdown()` gracefully

**`packages/config/src/metrics.ts`** — `createMetrics({ agencyId })` factory + `metrics()` singleton:
- `Registry` per process with `setDefaultLabels({ 'agency.id': agencyId })`
- `collectDefaultMetrics` provides Node.js process + heap metrics
- `http_requests_total` Counter (labelNames: method, route, status_code)
- `http_request_duration_seconds` Histogram (11 buckets from 5ms to 10s)
- `metrics()` singleton prevents double-registration errors across imports

**13 app instrumentation files:**
- `apps/web-<slug>/instrumentation.ts` — Edge guard: `if (NEXT_RUNTIME === 'nodejs') await import('./instrumentation.node')` (Plan 01-01 pattern preserved)
- `apps/web-<slug>/instrumentation.node.ts` — `startNodeSdk({ agencyId: process.env.AGENCY ?? '<slug>' })` with literal baked fallback

**13 `/api/metrics` routes:**
- `export const runtime = 'nodejs'` forces Node runtime (prom-client requires Node APIs)
- Per-process `createMetrics` instance with baked agency slug fallback
- Returns `register.metrics()` with `Content-Type: register.contentType`

**`apps/web-main/src/app/api/health/route.ts`** — Trace propagation demo:
- Uses `trace.getActiveSpan().spanContext().traceId` to read the active trace ID
- Logs via Pino with `trace_id` in log line (PinoInstrumentation auto-injects too)
- Returns `{ ok, service, agency, trace_id }` — integration test asserts this

**TDD tests** (`packages/config/src/__tests__/metrics.test.ts`):
- `createMetrics` returns correct shape
- `register.contentType` matches `text/plain; version=0.0.4`
- `register.metrics()` output contains `agency.id="ecommerce"` after counter increment
- Default Node metrics present in output

**Integration test** (`apps/web-main/src/__tests__/otel-tempo.integration.test.ts`):
- Gated by `process.env.INTEGRATION === 'otel-tempo'`
- Sends known `traceparent` to `/api/health`, waits 2s, queries Tempo at `localhost:3200`
- Plan 01-05 wires the CI gate

### Task 4.2: Prometheus + Loki + Tempo + Grafana Compose Stack + 3 Dashboards

**`docker-compose.observability.yml`** — overlay merge file:
- All 5 observability services with pinned major versions
- All host ports bound to `127.0.0.1:` (T-01-401 loopback enforcement)
- Grafana on host port 3001 → container port 3000 (avoids Next.js 3000 collision)
- Tempo OTLP HTTP on `127.0.0.1:4318:4318` (matches `OTEL_EXPORTER_OTLP_ENDPOINT` default)

**`infra/prometheus/prometheus.yml`** — 12 scrape targets:
- All 12 agency apps at `host.docker.internal:3000-3011`
- `metrics_path: /api/metrics`
- `scrape_interval: 15s`

**`infra/promtail/promtail-config.yml`** — Docker SD with label extraction:
- `agency_id` extracted from container label `com.mjagency.agency`
- JSON pipeline extracts `agency.id` field from Pino stdout
- `level` label extracted from JSON log field

**`infra/tempo/tempo.yml`** — single-binary:
- OTLP HTTP receiver on `0.0.0.0:4318`, gRPC on `0.0.0.0:4317`
- Local filesystem storage, 24h block retention
- WAL at `/var/tempo/wal`

**Three Grafana dashboards** (provisioned-as-code):

| Dashboard | UID | Key Query |
|-----------|-----|-----------|
| `request-rate.json` | mjagency-request-rate | `sum by (agency.id) (rate(http_requests_total[5m]))` |
| `error-rate.json` | mjagency-error-rate | `sum by (agency.id) (rate(http_requests_total{status_code=~"5.."}[5m])) / sum by (agency.id) (rate(http_requests_total[5m]))` |
| `latency.json` | mjagency-latency | `histogram_quantile(0.50/0.95/0.99, sum by (le, agency.id) (rate(http_request_duration_seconds_bucket[5m])))` |

Each dashboard has `templating.list[0].name == "agency_id"` bound to `label_values(http_requests_total, agency.id)`.

**`ecosystem.config.cjs`** — Promtail activated:
- `promtailApp` entry is now active (was commented until `infra/promtail/promtail-config.yml` existed)

## Exporter-Pluggable Contract (Phase 11)

The `startNodeSdk` factory in `packages/config/src/otel-node.ts` accepts the full `NodeSDK` constructor options. At M011, a second exporter can be added using `MultiSpanExporter` without re-architecting:

```ts
// M011 extension (do not apply until M011 — D-08 Tempo-only at M001):
traceExporter: new MultiSpanExporter([
  new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }),  // Tempo
  new DatadogTraceExporter({ ... }),  // SaaS APM added at M011
])
```

Per CONTEXT D-08: Tempo-only at M001. SaaS APM (Phase 11) adds second exporter.

## `/api/metrics` Auth Deferral (T-01-009)

At M001, `/api/metrics` is protected by:
- Next.js dev server binding to `127.0.0.1` only
- Prometheus scrapes via `host.docker.internal` (Docker bridge, internal)

**Production gating deferred to M008/M011** per CONTEXT D-08 + security spec roadmap (Open Q2). In production, the endpoint will be gated behind network ACL (Tailscale) or a Prometheus push-gateway. This is a planned, documented deferral — not a gap in the M001 design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added @opentelemetry/api as explicit dependency**
- **Found during:** Task 4.1 — `apps/web-main/src/app/api/health/route.ts` imports `trace` from `@opentelemetry/api`
- **Issue:** The plan's `packages/config/package.json` spec didn't include `@opentelemetry/api` but the health route uses it directly
- **Fix:** Added `"@opentelemetry/api": "1.9.0"` to `packages/config/package.json` dependencies
- **Files modified:** `packages/config/package.json`

**2. [Rule 2 - Missing functionality] Added logger.ts and agency-constants.ts to packages/config**
- **Found during:** Task 4.1 — `index.ts` needs to export `createLogger` and `AGENCIES`; `health/route.ts` imports `createLogger`
- **Issue:** The worktree was branched from `a341254` (pre-Plan 01-01) and these files from Plan 01-01 did not exist in the worktree
- **Fix:** Created `packages/config/src/logger.ts` and `packages/config/src/agency-constants.ts` matching Plan 01-01 spec verbatim
- **Files modified:** Created both files; they will merge cleanly with Plan 01-01's versions on main

**3. [Rule 3 - Context] Worktree base mismatch**
- **Found during:** Worktree branch check at plan start
- **Issue:** Worktree was branched from `a341254` (before Plans 01-01/02/03 commits). `git reset --hard fb2280560f` was blocked by the Bash safety system's destructive git prohibition.
- **Fix:** Created all Plan 01-04 files as new files in the worktree. Files that overlap with prior plans (docker-compose.yml, ecosystem.config.cjs) include the Plan 01-02 base content + Plan 01-04 additions. Orchestrator merge will need to resolve `docker-compose.yml` and `ecosystem.config.cjs` conflicts since both branches "add" these files from different ancestry points.
- **Impact:** The orchestrator should use `git checkout main -- docker-compose.yml ecosystem.config.cjs` and then re-apply Plan 01-04 changes (extra_hosts + promtail activation) during merge if conflicts arise.

## Known Stubs

None — all files contain real implementation. Integration test is gated (not stubbed) — `describe.skip` is the correct pattern for opt-in integration tests per plan spec.

## Threat Flags

No new threat surface beyond what the plan's threat model covers.

- T-01-401: All observability service host ports bound to `127.0.0.1` — enforced
- T-01-402: Edge guard preserved — `instrumentation.ts` keeps `NEXT_RUNTIME === 'nodejs'` check
- T-01-403: OTel auto-instrumentations capture headers/URL/status only, no request bodies
- T-01-005: Pino redact paths unchanged through PinoInstrumentation — no new exposure
- T-01-009: `/api/metrics` dev-only localhost binding at M001, deferred to M008/M011

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 4.1 | 9c27ffb | 46 files: packages/config (otel-node, metrics, index, tests), apps/web-* (instrumentation.ts, instrumentation.node.ts, /api/metrics routes, /api/health), packages/testing/tempo-client.ts |
| 4.2 | 3d688ad | 13 files: docker-compose.observability.yml, docker-compose.yml, ecosystem.config.cjs, infra/ (prometheus, loki, promtail, tempo, grafana), docs/runbooks/observability.md |

## Self-Check: PASSED

**Created files verified:**
- packages/config/src/otel-node.ts — FOUND (contains NodeSDK, startNodeSdk, agency.id, OTEL_EXPORTER_OTLP_ENDPOINT)
- packages/config/src/metrics.ts — FOUND (contains Registry, createMetrics, http_requests_total)
- packages/config/src/__tests__/metrics.test.ts — FOUND (4 test cases)
- packages/testing/src/tempo-client.ts — FOUND (exports fetchTrace, defaults localhost:3200)
- 12 instrumentation.node.ts files — FOUND (all contain startNodeSdk)
- 12 /api/metrics route.ts files — FOUND (all contain register.metrics(), runtime = 'nodejs')
- apps/web-main/src/app/api/health/route.ts — FOUND (contains trace_id, trace.getActiveSpan)
- apps/web-main/src/__tests__/otel-tempo.integration.test.ts — FOUND (gated by INTEGRATION=otel-tempo)
- infra/prometheus/prometheus.yml — FOUND (12 targets including host.docker.internal:3011)
- infra/promtail/promtail-config.yml — FOUND (agency_id label extraction)
- infra/tempo/tempo.yml — FOUND (otlp: http: 4318, grpc: 4317)
- infra/grafana/datasources/datasources.yml — FOUND (Prometheus, Loki, Tempo datasources)
- infra/grafana/dashboards/latency.json — FOUND (3x histogram_quantile queries: 0.50, 0.95, 0.99)
- docker-compose.observability.yml — FOUND (tempo:, loki:, prometheus:, 127.0.0.1:3001:3000)
- docs/runbooks/observability.md — FOUND (all 4 service URLs, pitfall 3.5 deferral, M011 SaaS APM path)

**Commits verified:**
- 9c27ffb feat(01-04): otel nodesdk + prom-client per-app + pino auto-instrumentation (Task 4.1) — PRESENT
- 3d688ad feat(01-04): prometheus + loki + tempo + grafana stack + 3 dashboards (Task 4.2) — PRESENT
