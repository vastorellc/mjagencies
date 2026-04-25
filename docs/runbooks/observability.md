# Observability Runbook — MJAgency M001

## Stack Overview

| Component  | Image                    | Version | Local URL                    | Purpose                          |
|------------|--------------------------|---------|------------------------------|----------------------------------|
| Prometheus | prom/prometheus          | 3.0.1   | http://localhost:9090        | Metrics collection + PromQL      |
| Loki       | grafana/loki             | 3.3.1   | http://localhost:3100        | Log aggregation backend          |
| Promtail   | grafana/promtail         | 3.3.1   | http://localhost:9080        | Docker log shipper → Loki        |
| Tempo      | grafana/tempo            | 2.6.1   | http://localhost:3200        | Distributed tracing backend      |
| Grafana    | grafana/grafana          | 11.4.0  | http://localhost:3001        | Unified dashboards (metrics/logs/traces) |

## Boot Sequence

Start the full observability stack (requires Docker and the dev profile):

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml --profile dev up -d
```

Verify all services are healthy:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml ps
```

Start Next.js dev servers (separate terminal, or via PM2):

```bash
pnpm dev --filter=@mjagency/web-main
```

Verify Prometheus scrape targets are up (after dev servers start):

```bash
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
# Expected: 12 (one per agency app)
```

## Wire-Once Invariant (D-10)

Every one of the 13 apps exposes `/api/metrics` as of Plan 01-04 (M001). This endpoint returns
Prometheus exposition format with per-app `agency.id` labels. The observability surface is
"wire-once" — no revisit at M008 for the metrics pipeline itself.

All 12 agency apps + web-main are registered in `infra/prometheus/prometheus.yml` and will be
scraped every 15 seconds once their dev servers are running.

## Metrics Endpoint Security (Pitfall 3.5 — M008/M011 Follow-up)

At M001, the `/api/metrics` endpoint is protected by the Next.js dev server binding to
`127.0.0.1` only (no LAN exposure). Prometheus scrapes via `host.docker.internal` over the
Docker bridge network — this is internal-only.

**Production gating** is deferred to M008/M011 per the security spec roadmap. In production,
the metrics endpoint will be gated behind network ACL (Tailscale) or moved to a Prometheus
push-gateway that is not publicly accessible. This is explicitly tracked in the security
requirements and is not a gap in the M001 design — it is a planned, documented deferral.

## Trace Propagation Invariant

The full trace propagation chain for every request:

1. **Edge middleware** — reads and forwards `traceparent` header (no SDK needed at Edge)
2. **Node route handler** — `@opentelemetry/auto-instrumentations-node` auto-extracts `traceparent`
   from incoming requests via `@opentelemetry/instrumentation-http`
3. **Pino logger** — `@opentelemetry/instrumentation-pino` auto-injects `trace_id`, `span_id`,
   and `trace_flags` into every Pino log line when called inside an active span
4. **Tempo** — receives OTLP traces from all apps at `http://localhost:4318/v1/traces`
5. **Grafana** — Tempo datasource configured with `tracesToLogs` pointing to Loki for
   correlated log viewing

### Verifying End-to-End Trace Propagation

```bash
# Send a request with a known traceparent
curl -s -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" \
  http://localhost:3000/api/health

# Expected response includes trace_id
# { "ok": true, "service": "mjagency-main", "trace_id": "0af7651916cd43dd8448eb211c80319c" }

# Wait 2 seconds for Tempo ingestion, then query
sleep 2
curl -s http://localhost:3200/api/traces/0af7651916cd43dd8448eb211c80319c | jq '.batches | length'
# Expected: >= 1
```

## Grafana Dashboards

Three dashboards are provisioned automatically from `infra/grafana/dashboards/`:

| Dashboard | File | Key PromQL |
|-----------|------|-----------|
| Request Rate | `request-rate.json` | `sum by (agency.id) (rate(http_requests_total[5m]))` |
| 5xx Error Rate | `error-rate.json` | `sum by (agency.id) (rate(http_requests_total{status_code=~"5.."}[5m])) / sum by (agency.id) (rate(http_requests_total[5m]))` |
| Latency p50/p95/p99 | `latency.json` | `histogram_quantile(0.50/0.95/0.99, sum by (le, agency.id) (rate(http_request_duration_seconds_bucket[5m])))` |

Each dashboard has an `agency_id` template variable dropdown (D-11) — select one or more
agencies to filter panels.

### Dashboard Editing

Edit JSON files directly in `infra/grafana/dashboards/`. Grafana auto-reloads every 30 seconds
(configured in `infra/grafana/dashboards/dashboards.yml` `updateIntervalSeconds: 30`).

**Never edit dashboards via the Grafana UI** — edits made in the UI are not persisted to disk
and will be overwritten on the next reload. The `infra/grafana/dashboards/` directory is the
version-controlled source of truth.

## Loki Log Queries

Promtail extracts `agency_id` and `level` labels from Docker container logs.

```
# All logs from any MJAgency container
{container=~"mjagency-.*"}

# Logs from a specific agency with level filter
{agency_id="ecommerce", level="error"}

# Logs correlated with a specific trace ID
{agency_id="main"} | json | trace_id="0af7651916cd43dd8448eb211c80319c"
```

## Adding a SaaS APM Exporter (M011)

The OTel NodeSDK is exporter-pluggable. At M001, the only trace exporter is Tempo via OTLP
HTTP. At M011, a second exporter (e.g. Datadog, New Relic, Honeycomb) can be added to the
SDK initialization in `packages/config/src/otel-node.ts` without re-architecting the pipeline.

The `startNodeSdk` factory accepts the `NodeSDK` constructor options — adding a second exporter
is a one-line change:

```ts
// M011 extension pattern (do not apply until M011):
import { MultiSpanExporter } from '@opentelemetry/sdk-trace-base'
const sdk = new NodeSDK({
  traceExporter: new MultiSpanExporter([
    new OTLPTraceExporter({ url: '...' }),      // Tempo (existing)
    new DatadogTraceExporter({ ... }),           // SaaS APM (M011 addition)
  ]),
  // ... rest unchanged
})
```

Per CONTEXT D-08: Tempo-only at M001. SaaS APM integration is Phase 11.

## Prometheus Target Map

| Target | App | Host Port | Agency Port |
|--------|-----|-----------|-------------|
| host.docker.internal:3000 | web-main (brand) | 3000 | — |
| host.docker.internal:3001 | web-ecommerce | 3001 | — |
| host.docker.internal:3002 | web-growth | 3002 | — |
| host.docker.internal:3003 | web-webdev | 3003 | — |
| host.docker.internal:3004 | web-ai | 3004 | — |
| host.docker.internal:3005 | web-branding | 3005 | — |
| host.docker.internal:3006 | web-strategy | 3006 | — |
| host.docker.internal:3007 | web-finance | 3007 | — |
| host.docker.internal:3008 | web-engineering | 3008 | — |
| host.docker.internal:3009 | web-product | 3009 | — |
| host.docker.internal:3010 | web-video | 3010 | — |
| host.docker.internal:3011 | web-graphic | 3011 | — |

All targets use `metrics_path: /api/metrics` (not the default `/metrics`).

## OTLP Receiver Ports (Tempo)

| Port | Protocol | Purpose |
|------|----------|---------|
| 4318 | HTTP | OTLP traces (default for `@opentelemetry/exporter-trace-otlp-http`) |
| 4317 | gRPC | OTLP traces (alternative, for gRPC-based exporters) |
| 3200 | HTTP | Tempo query API + Grafana datasource |
