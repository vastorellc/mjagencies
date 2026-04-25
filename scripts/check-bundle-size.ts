#!/usr/bin/env tsx
/**
 * check-bundle-size.ts — D-16 enforcement wrapper around size-limit.
 *
 * Thresholds (D-16 per .planning/phases/01-foundation-infra/01-CONTEXT.md):
 *   Growth >= +25% vs baseline → exit 1 (HARD FAIL — blocks PR merge)
 *   Growth >= +10% vs baseline → ::warning annotation, continue (PR still mergeable)
 *   Growth <  +10%             → OK
 *
 * Modes:
 *   pnpm tsx scripts/check-bundle-size.ts
 *     Reads .size-baseline.json and current size-limit output, emits warnings/errors.
 *     Used by .github/workflows/pr.yml `bundle-size` job.
 *
 *   pnpm tsx scripts/check-bundle-size.ts --update-baseline <path-to-size-current.json>
 *     Reshapes size-limit JSON output and writes it to .size-baseline.json.
 *     Used by .github/workflows/main.yml `update-size-baseline` job post-merge.
 *
 * .size-baseline.json format:
 *   { "First Load JS (homepage)": 143360, "Admin chunk": 409600, ... }
 *   Keys are the `name` fields from .size-limit.json. Values are byte counts.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execaSync } from 'execa'

interface SizeLimitEntry {
  name: string
  size: number
  passed?: boolean
  limit?: string
}

type Baseline = Record<string, number>

const args = process.argv.slice(2)
const baselinePath = '.size-baseline.json'

function reshape(arr: SizeLimitEntry[]): Baseline {
  return Object.fromEntries(arr.map((e) => [e.name, e.size]))
}

// --update-baseline mode (used by main.yml after merge)
if (args[0] === '--update-baseline') {
  const currentPath = args[1]
  if (!currentPath) {
    console.error('Usage: --update-baseline <path-to-size-current.json>')
    process.exit(1)
  }
  const raw = readFileSync(currentPath, 'utf8')
  const current = JSON.parse(raw) as SizeLimitEntry[]
  const reshaped = reshape(current)
  writeFileSync(baselinePath, JSON.stringify(reshaped, null, 2) + '\n')
  console.log(`Updated ${baselinePath} with ${Object.keys(reshaped).length} bundle entries.`)
  process.exit(0)
}

// Standard mode — run size-limit and compare against baseline
console.log('D-16: running pnpm turbo run size-limit to get current bundle sizes...')
const result = execaSync('pnpm', ['turbo', 'run', 'size-limit', '--', '--json'], { encoding: 'utf8' })

let current: SizeLimitEntry[]
try {
  current = JSON.parse(result.stdout) as SizeLimitEntry[]
} catch {
  console.error('D-16: Failed to parse size-limit JSON output. Raw stdout:')
  console.error(result.stdout)
  process.exit(1)
}

const baseline: Baseline = existsSync(baselinePath)
  ? (JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline)
  : {}

if (Object.keys(baseline).length === 0) {
  console.log('D-16: No baseline found in .size-baseline.json — recording current sizes as initial baseline.')
  console.log('      The main.yml job will populate .size-baseline.json after the first merge to main.')
  for (const c of current) {
    console.log(`::notice::Bundle "${c.name}" = ${c.size} bytes (initial — no baseline comparison yet)`)
  }
  process.exit(0)
}

let warnings = 0
let hardFails = 0

for (const c of current) {
  const base = baseline[c.name]
  if (typeof base !== 'number') {
    console.log(`::notice::D-16: No baseline for "${c.name}" — size is ${c.size} bytes (new bundle, no comparison)`)
    continue
  }

  const growth = (c.size - base) / base
  const growthPct = (growth * 100).toFixed(1)

  if (growth >= 0.25) {
    console.log(
      `::error::D-16 HARD FAIL: Bundle "${c.name}" grew ${growthPct}% (threshold: +25%). ` +
      `Baseline=${base} bytes, current=${c.size} bytes. Reduce bundle size or update baseline with explicit review.`
    )
    hardFails++
  } else if (growth >= 0.10) {
    console.log(
      `::warning::D-16 WARN: Bundle "${c.name}" grew ${growthPct}% (threshold: +10%). ` +
      `Baseline=${base} bytes, current=${c.size} bytes. Consider reviewing before merging.`
    )
    warnings++
  } else if (growth < 0) {
    console.log(`D-16: Bundle "${c.name}" shrank ${Math.abs(growth * 100).toFixed(1)}% — ${c.size} bytes (was ${base} bytes).`)
  } else {
    console.log(`D-16: Bundle "${c.name}" OK — ${c.size} bytes (growth: +${growthPct}%).`)
  }
}

if (hardFails > 0) {
  console.error(`D-16: ${hardFails} hard-fail bundle(s). See annotations above. PR must reduce bundle size or obtain explicit review sign-off.`)
  process.exit(1)
}

console.log(`D-16: bundle-size check complete — ${warnings} warning(s), ${hardFails} hard fail(s). OK.`)
