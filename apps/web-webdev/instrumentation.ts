// SOURCE: nextjs.org/docs/app/guides/open-telemetry
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
  // Edge runtime: no-op; trace_id propagation only via traceparent header
}
