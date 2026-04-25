#!/usr/bin/env tsx
/**
 * dev-smoke.ts — Boots web-main via Turbo dev, polls /api/health until 200 + ok:true.
 *
 * Used by .github/workflows/pr.yml `dev-smoke` job.
 *
 * Exit codes:
 *   0 — /api/health returned { ok: true } within 60s
 *   1 — timeout or error
 *
 * Usage:
 *   pnpm tsx scripts/dev-smoke.ts
 */

import { execa } from 'execa'
import { setTimeout as sleep } from 'node:timers/promises'

const port = 3000
const healthUrl = `http://localhost:${port}/api/health`
const timeoutMs = 60_000
const pollIntervalMs = 2_000

const child = execa('pnpm', ['turbo', 'run', 'dev', '--filter=@mjagency/web-main'], {
  stdio: 'inherit',
})

console.log(`[dev-smoke] Starting web-main on port ${port}...`)
console.log(`[dev-smoke] Polling ${healthUrl} for up to ${timeoutMs / 1000}s`)

try {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch(healthUrl)
      if (r.ok) {
        const body = (await r.json()) as { ok?: boolean }
        if (body.ok === true) {
          console.log('[dev-smoke] OK', body)
          process.exit(0)
        } else {
          console.log('[dev-smoke] /api/health returned ok=false, retrying...')
        }
      } else {
        console.log(`[dev-smoke] /api/health returned HTTP ${r.status}, retrying...`)
      }
    } catch {
      // Server not yet ready — continue polling
    }
    await sleep(pollIntervalMs)
  }
  console.error(`[dev-smoke] TIMEOUT: /api/health did not return ok:true within ${timeoutMs / 1000}s`)
  process.exit(1)
} finally {
  child.kill('SIGTERM')
}
