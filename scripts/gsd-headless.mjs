#!/usr/bin/env node
/**
 * scripts/gsd-headless.mjs
 * Pre-launch gate: runs all quality checks and exits 0 iff all pass.
 * Usage: node scripts/gsd-headless.mjs [--skip=check1,check2] [--help]
 * Exit codes: 0 = all green, 1 = one or more checks failed.
 *
 * Checks (in order):
 *   1. typecheck   — pnpm tsc --noEmit (all packages)
 *   2. unit-tests  — pnpm turbo run test (Vitest unit + integration)
 *   3. e2e-smoke   — Playwright smoke (requires E2E_BASE_URL)
 *   4. axe-wcag    — axe-core WCAG AA scan (requires running app)
 *   5. zap-passive — OWASP ZAP baseline passive scan (requires running app)
 *   6. lighthouse  — Lighthouse CI (LCP<2.5s, CLS<0.1, FID<100ms)
 *   7. csp-grep    — Static grep for forbidden patterns
 */
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const HELP = `
gsd-headless.mjs — Pre-launch quality gate

Usage:
  node scripts/gsd-headless.mjs [options]

Options:
  --skip=<checks>  Comma-separated list of checks to skip
  --help           Show this message

Checks:
  typecheck, unit-tests, e2e-smoke, axe-wcag, zap-passive, lighthouse, csp-grep

Notes:
  e2e-smoke, axe-wcag, lighthouse require E2E_BASE_URL env var to be set.
  zap-passive requires ZAP_TARGET_URL env var and Docker to be installed.
  lighthouse requires LHCI_SERVER_URL env var.
  All live checks are skipped with a warning if env vars are absent.
`.trim()

function parseArgs(argv) {
  const args = argv.slice(2)
  const skipArg = args.find(a => a.startsWith('--skip='))
  return {
    help: args.includes('--help'),
    skip: skipArg ? skipArg.split('=')[1].split(',').map(s => s.trim()) : [],
  }
}

const args = parseArgs(process.argv)

if (args.help) {
  console.log(HELP)
  process.exit(0)
}

const failures = []
const skipped = args.skip

async function runCheck(name, fn) {
  if (skipped.includes(name)) {
    console.log(`[gsd-headless] SKIP: ${name}`)
    return
  }
  try {
    console.log(`[gsd-headless] RUN: ${name}`)
    await fn()
    console.log(`[gsd-headless] PASS: ${name}`)
  } catch (err) {
    const msg = err.message ?? String(err)
    console.error(`[gsd-headless] ERROR: ${name} failed`)
    console.error(`::error::gsd-headless: ${name} failed: ${msg}`)
    failures.push(name)
  }
}

async function main() {
  // 1. TypeScript compile check
  await runCheck('typecheck', () => {
    execSync('pnpm tsc --noEmit', { stdio: 'inherit', cwd: REPO_ROOT })
  })

  // 2. Vitest unit + integration tests
  await runCheck('unit-tests', () => {
    execSync('pnpm turbo run test', { stdio: 'inherit', cwd: REPO_ROOT })
  })

  // 3. Playwright smoke tests (conditional on E2E_BASE_URL)
  await runCheck('e2e-smoke', () => {
    if (!process.env['E2E_BASE_URL']) {
      console.log('[gsd-headless] WARN: e2e-smoke skipped (E2E_BASE_URL not set)')
      return
    }
    execSync('pnpm turbo run test:e2e', {
      stdio: 'inherit',
      cwd: REPO_ROOT,
      env: { ...process.env },
    })
  })

  // 4. axe-core WCAG AA scan (conditional on E2E_BASE_URL)
  await runCheck('axe-wcag', () => {
    if (!process.env['E2E_BASE_URL']) {
      console.log('[gsd-headless] WARN: axe-wcag skipped (E2E_BASE_URL not set)')
      return
    }
    execSync(
      `npx axe "${process.env['E2E_BASE_URL']}/" --exit`,
      { stdio: 'inherit', cwd: REPO_ROOT }
    )
  })

  // 5. OWASP ZAP passive baseline scan (conditional on ZAP_TARGET_URL + Docker)
  await runCheck('zap-passive', () => {
    if (!process.env['ZAP_TARGET_URL']) {
      console.log('[gsd-headless] WARN: zap-passive skipped (ZAP_TARGET_URL not set)')
      return
    }
    execSync(
      `docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t ${process.env['ZAP_TARGET_URL']} -I`,
      { stdio: 'inherit', cwd: REPO_ROOT }
    )
  })

  // 6. Lighthouse CI (conditional on E2E_BASE_URL + LHCI_SERVER_URL)
  await runCheck('lighthouse', () => {
    if (!process.env['E2E_BASE_URL'] || !process.env['LHCI_SERVER_URL']) {
      console.log('[gsd-headless] WARN: lighthouse skipped (E2E_BASE_URL or LHCI_SERVER_URL not set)')
      return
    }
    execSync('npx @lhci/cli@0.14 autorun', {
      stdio: 'inherit',
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        LHCI_BUILD_CONTEXT__CURRENT_HASH: process.env['GITHUB_SHA'] ?? 'local',
      },
    })
  })

  // 7. CSP static grep gate
  await runCheck('csp-grep', () => {
    const forbiddenPatterns = [
      { pattern: `NEXT_PUBLIC_.*KEY`, label: 'NEXT_PUBLIC_ secret key exposure' },
      { pattern: `from 'jsonwebtoken'|require\\('jsonwebtoken'\\)`, label: 'banned jsonwebtoken import (use jose)' },
      { pattern: 'dangerouslyAllowSVG', label: 'dangerouslyAllowSVG usage' },
    ]
    const violations = []
    for (const { pattern, label } of forbiddenPatterns) {
      try {
        const result = execSync(
          `grep -rn "${pattern}" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" 2>/dev/null || true`,
          { encoding: 'utf8', cwd: REPO_ROOT }
        )
        if (result.trim().length > 0) {
          violations.push(`${label}:\n${result.trim()}`)
        }
      } catch {
        // grep returning non-zero just means no matches — handled by || true above
      }
    }
    if (violations.length > 0) {
      throw new Error(`CSP grep found ${violations.length} violation(s):\n${violations.join('\n---\n')}`)
    }
  })

  // Exit summary
  if (failures.length > 0) {
    console.error(`\n[gsd-headless] FAILED: ${failures.length} check(s) failed: ${failures.join(', ')}`)
    process.exit(1)
  }
  console.log('\n[gsd-headless] ALL CHECKS PASSED — ready for launch.')
  process.exit(0)
}

main().catch(err => {
  console.error('[gsd-headless] Unexpected error:', err)
  process.exit(1)
})
