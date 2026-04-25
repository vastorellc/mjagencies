#!/usr/bin/env tsx
/**
 * compose-smoke.ts — Wave-0 helper: brings up docker compose with --profile dev,
 * polls until all containers report Health=healthy or State=running, then exits.
 *
 * Used by Plan 01-05 CI job `compose-smoke`.
 *
 * Exit codes:
 *   0 — all containers healthy/running within timeout
 *   1 — timeout or unexpected container state
 *
 * Usage:
 *   pnpm tsx scripts/compose-smoke.ts
 *   pnpm tsx scripts/compose-smoke.ts --no-up   # skip docker compose up, just poll
 */

import { execSync, spawnSync } from 'node:child_process'

const POLL_INTERVAL_MS = 5_000
const MAX_ITERATIONS = 24  // 24 × 5s = 120s total timeout
const SKIP_UP = process.argv.includes('--no-up')

interface ContainerStatus {
  Name: string
  Service: string
  State: string
  Health: string
}

function run(cmd: string, args: string[]): { stdout: string; status: number } {
  const result = spawnSync(cmd, args, { encoding: 'utf-8', shell: false })
  return {
    stdout: result.stdout ?? '',
    status: result.status ?? 1,
  }
}

function dockerComposeUp(): void {
  console.log('[compose-smoke] Running: docker compose --profile dev up -d')
  const result = spawnSync('docker', ['compose', '--profile', 'dev', 'up', '-d'], {
    stdio: 'inherit',
    encoding: 'utf-8',
  })
  if (result.status !== 0) {
    console.error('[compose-smoke] ERROR: docker compose up failed')
    process.exit(1)
  }
}

function getContainerStatuses(): ContainerStatus[] {
  const result = run('docker', ['compose', 'ps', '--format', 'json'])
  if (result.status !== 0) {
    return []
  }

  const raw = result.stdout.trim()
  if (!raw) return []

  // docker compose ps --format json outputs one JSON object per line (NDJSON)
  const statuses: ContainerStatus[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as Partial<ContainerStatus>
      statuses.push({
        Name: parsed.Name ?? '',
        Service: parsed.Service ?? '',
        State: parsed.State ?? '',
        Health: parsed.Health ?? '',
      })
    } catch {
      // Skip non-JSON lines
    }
  }
  return statuses
}

function isHealthy(container: ContainerStatus): boolean {
  // Containers with healthchecks report State=running, Health=healthy
  // Stateless containers (no healthcheck) report State=running, Health='' (empty)
  if (container.Health === 'healthy') return true
  if (container.State === 'running' && container.Health === '') return true
  return false
}

function dumpLogs(): void {
  console.error('[compose-smoke] === Container logs (last 50 lines) ===')
  try {
    execSync('docker compose logs --tail=50', { stdio: 'inherit' })
  } catch {
    console.error('[compose-smoke] Failed to retrieve logs')
  }
}

async function main(): Promise<void> {
  if (!SKIP_UP) {
    dockerComposeUp()
  }

  console.log(`[compose-smoke] Polling for healthy containers (${MAX_ITERATIONS} × ${POLL_INTERVAL_MS / 1000}s = ${MAX_ITERATIONS * POLL_INTERVAL_MS / 1000}s timeout)...`)

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

    const statuses = getContainerStatuses()

    if (statuses.length === 0) {
      console.log(`[compose-smoke] [${i}/${MAX_ITERATIONS}] No containers found yet, waiting...`)
      continue
    }

    const allHealthy = statuses.every(isHealthy)
    const unhealthy = statuses.filter((c) => !isHealthy(c))

    console.log(`[compose-smoke] [${i}/${MAX_ITERATIONS}] ${statuses.length} containers, ${unhealthy.length} not yet healthy`)

    if (unhealthy.length > 0) {
      for (const c of unhealthy) {
        console.log(`  - ${c.Service} (${c.Name}): State=${c.State || '(none)'}, Health=${c.Health || '(none)'}`)
      }
    }

    if (allHealthy && statuses.length > 0) {
      console.log('[compose-smoke] All containers healthy. Stack is ready.')
      for (const c of statuses) {
        console.log(`  + ${c.Service} (${c.Name}): State=${c.State}, Health=${c.Health || 'n/a'}`)
      }
      process.exit(0)
    }
  }

  console.error(`[compose-smoke] TIMEOUT: not all containers healthy after ${MAX_ITERATIONS * POLL_INTERVAL_MS / 1000}s`)
  const statuses = getContainerStatuses()
  const unhealthy = statuses.filter((c) => !isHealthy(c))
  if (unhealthy.length > 0) {
    console.error('[compose-smoke] Unhealthy containers:')
    for (const c of unhealthy) {
      console.error(`  - ${c.Service}: State=${c.State}, Health=${c.Health}`)
    }
  }
  dumpLogs()
  process.exit(1)
}

main().catch((err: unknown) => {
  console.error('[compose-smoke] Unhandled error:', err)
  process.exit(1)
})
