import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client'

export function createMetrics(opts: { agencyId: string }): {
  register: Registry
  httpRequestsTotal: Counter<string>
  httpRequestDurationSeconds: Histogram<string>
} {
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

let _metrics: ReturnType<typeof createMetrics> | undefined

export function metrics(opts?: { agencyId: string }): ReturnType<typeof createMetrics> {
  if (!_metrics) {
    if (!opts) throw new Error('metrics() requires { agencyId } on first call')
    _metrics = createMetrics(opts)
  }
  return _metrics
}
