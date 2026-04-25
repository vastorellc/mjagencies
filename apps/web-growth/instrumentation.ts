// Next.js 15 instrumentation hook — Edge-safe loader.
// The full Node SDK body lives in instrumentation.node.ts (Plan 01-04).
// This file must exist from day one so Next.js detects the hook on first boot.
// Per pitfall 3.6: NEXT_RUNTIME guard is mandatory — Pino and @opentelemetry/sdk-node
// are Node-only and will crash if imported in the Edge runtime.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
