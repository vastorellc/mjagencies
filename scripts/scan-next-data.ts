#!/usr/bin/env tsx
/**
 * scan-next-data.ts — REQ-427 enforcement.
 *
 * Audits built Next.js output for accidentally-serialized secrets.
 * Invoked by .github/workflows/pr.yml `next-data-secret-audit` job after
 * `pnpm turbo run build --filter=@mjagency/web-main`.
 *
 * Scanned paths:
 *   apps/*\/.next/server/app/**\/*.html  (page HTML containing __NEXT_DATA__)
 *   apps/*\/.next/server/app/**\/*.json  (page-props JSON)
 *
 * Patterns covered (pitfall 3.7 + RESEARCH §2.10):
 *   - Stripe live keys:   sk_live_*   (FAIL — catastrophic if leaked)
 *   - Stripe test keys:   sk_test_*   (WARN — may be intentional in test fixtures)
 *   - Stripe webhook:     whsec_*     (FAIL)
 *   - AWS-style keys:     AKIA[0-9A-Z]{16}  (FAIL)
 *   - JWT-shaped strings: ey*.*.* (FAIL — indicates serialized token)
 *   - Slack bot tokens:   xoxb-*    (FAIL)
 *   - R2 access key hint: r2_*      (WARN — Cloudflare R2 key prefix)
 *
 * Exit codes:
 *   0 — no FAIL-severity patterns found in any file
 *   1 — at least one FAIL-severity hit, or no built output found
 */

import { glob } from 'glob'
import { readFile } from 'node:fs/promises'

interface Pattern {
  name: string
  re: RegExp
  severity: 'fail' | 'warn'
}

const PATTERNS: Pattern[] = [
  { name: 'Stripe live key',    re: /\bsk_live_[A-Za-z0-9]{16,}/,                                   severity: 'fail' },
  { name: 'Stripe test key',    re: /\bsk_test_[A-Za-z0-9]{16,}/,                                   severity: 'warn' },
  { name: 'Stripe webhook',     re: /\bwhsec_[A-Za-z0-9]{16,}/,                                     severity: 'fail' },
  { name: 'AWS-style access',   re: /\bAKIA[0-9A-Z]{16}\b/,                                          severity: 'fail' },
  { name: 'JWT-shaped string',  re: /\bey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, severity: 'fail' },
  { name: 'Slack bot token',    re: /\bxoxb-[A-Za-z0-9-]{20,}/,                                     severity: 'fail' },
  { name: 'R2 access key',      re: /\br2_[A-Za-z0-9]{16,}/,                                        severity: 'warn' },
]

const htmlFiles = await glob('apps/*/.next/server/app/**/*.html', { absolute: false })
const jsonFiles = await glob('apps/*/.next/server/app/**/*.json', { absolute: false })
const all = [...htmlFiles, ...jsonFiles]

if (all.length === 0) {
  console.error('::error::REQ-427: No built Next.js output found. Run `pnpm turbo run build` first.')
  process.exit(1)
}

console.log(`REQ-427: scanning ${all.length} built output file(s) for secret patterns...`)

let failed = 0
let warned = 0

for (const f of all) {
  const content = await readFile(f, 'utf8')
  for (const p of PATTERNS) {
    const m = content.match(p.re)
    if (m) {
      const prefix = m[0].slice(0, 12)
      if (p.severity === 'fail') {
        console.log(`::error file=${f}::REQ-427: ${p.name} pattern found in ${f}: ${prefix}…`)
        failed++
      } else {
        console.log(`::warning file=${f}::REQ-427: ${p.name} pattern found in ${f}: ${prefix}… (warn-only)`)
        warned++
      }
    }
  }
}

if (failed > 0) {
  console.error(`REQ-427: FAIL — ${failed} secret-pattern hit(s) in __NEXT_DATA__ output. See annotations above.`)
  process.exit(1)
}

if (warned > 0) {
  console.log(`REQ-427: WARN — ${warned} warning-level pattern(s) found. Review before merging.`)
}

console.log(`REQ-427: scanned ${all.length} files — no FAIL-severity leaks detected.`)
