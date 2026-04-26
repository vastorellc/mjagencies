/**
 * scripts/check-next-version.ts
 *
 * REQ-029 / SEC-N2 — CVE-2025-29927 patch gate.
 *
 * Walks all package.json files in apps/ and packages/ directories.
 * Fails with exit 1 if any has a `next` dependency version < 15.2.3.
 *
 * CVE-2025-29927: Next.js middleware authentication bypass.
 * Fixed in Next.js >= 15.2.3. This gate enforces the minimum version
 * on every PR to prevent accidental downgrade.
 *
 * Three-layer CVE defense (RESEARCH §10.1):
 *   1. CF WAF rule (Plan 03-04 runbook)
 *   2. Next.js >= 15.2.3 CI gate (this script)
 *   3. requireSession() in every server action (Plan 03-05)
 *
 * Run via CI step: `pnpm tsx scripts/check-next-version.ts`
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface PkgJson {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const MIN = { major: 15, minor: 2, patch: 3 }

function parseRange(range: string): { major: number; minor: number; patch: number } | null {
  // Strip version range prefixes: ^, ~, >=, >, <=, <, =, spaces
  const cleaned = range.replace(/^[\^~>=<\s]+/, '')
  const m = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) }
}

function isPatched(v: { major: number; minor: number; patch: number }): boolean {
  if (v.major > MIN.major) return true
  if (v.major < MIN.major) return false
  if (v.minor > MIN.minor) return true
  if (v.minor < MIN.minor) return false
  return v.patch >= MIN.patch
}

/**
 * Walks apps/ and packages/ directories, returning paths to all package.json files.
 */
async function findPackageJsonPaths(root: string): Promise<string[]> {
  const paths: string[] = []
  for (const dir of ['apps', 'packages']) {
    const parent = join(root, dir)
    let entries: string[]
    try {
      entries = await readdir(parent)
    } catch {
      continue // directory doesn't exist — skip
    }
    for (const entry of entries) {
      const pkgPath = join(parent, entry, 'package.json')
      try {
        await readFile(pkgPath, 'utf8') // probe existence
        paths.push(pkgPath)
      } catch {
        // Not a package directory — skip
      }
    }
  }
  return paths
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url)
  const root = join(__filename, '..', '..')

  const pkgJsonPaths = await findPackageJsonPaths(root)

  if (pkgJsonPaths.length === 0) {
    console.warn('check-next-version: no package.json files found in apps/ or packages/ — check working directory')
  }

  const violations: Array<{ pkg: string; nextRange: string }> = []

  for (const p of pkgJsonPaths) {
    const raw = await readFile(p, 'utf8').catch(() => null)
    if (!raw) continue
    let json: PkgJson
    try {
      json = JSON.parse(raw) as PkgJson
    } catch {
      continue
    }
    const allDeps = {
      ...json.dependencies,
      ...json.devDependencies,
      ...json.peerDependencies,
    }
    const nextRange = allDeps['next']
    if (!nextRange) continue // not all packages depend on next

    const parsed = parseRange(nextRange)
    if (!parsed || !isPatched(parsed)) {
      violations.push({ pkg: json.name ?? p, nextRange })
    }
  }

  if (violations.length > 0) {
    console.error('REQ-029 violation: next < 15.2.3 (CVE-2025-29927) detected:')
    for (const v of violations) {
      console.error(`  - ${v.pkg}: next ${v.nextRange}`)
    }
    process.exit(1)
  }

  console.log(
    `REQ-029 OK: all ${pkgJsonPaths.length} package.json have next >= 15.2.3 (or no next dep)`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
