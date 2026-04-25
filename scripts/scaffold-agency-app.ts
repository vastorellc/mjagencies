#!/usr/bin/env tsx
/**
 * scaffold-agency-app.ts
 * Deterministic script that scaffolds the 11 remaining agency apps from the web-main template.
 * Idempotent: re-running on an existing apps/web-<slug> is a no-op (compare-and-skip).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// Agency slugs in port order (brand = 3000 via web-main, remaining start at 3001)
const AGENCY_APPS = [
  { slug: 'ecommerce', port: 3001 },
  { slug: 'growth', port: 3002 },
  { slug: 'webdev', port: 3003 },
  { slug: 'ai', port: 3004 },
  { slug: 'branding', port: 3005 },
  { slug: 'strategy', port: 3006 },
  { slug: 'finance', port: 3007 },
  { slug: 'engineering', port: 3008 },
  { slug: 'product', port: 3009 },
  { slug: 'video', port: 3010 },
  { slug: 'graphic', port: 3011 },
]

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function agencyTitle(slug: string): string {
  const titles: Record<string, string> = {
    ecommerce: 'E-Commerce',
    growth: 'Growth',
    webdev: 'Web Development',
    ai: 'AI',
    branding: 'Branding',
    strategy: 'Strategy',
    finance: 'Finance',
    engineering: 'Engineering',
    product: 'Product',
    video: 'Video',
    graphic: 'Graphic Design',
  }
  return titles[slug] ?? capitalize(slug)
}

function copyDir(src: string, dest: string, slug: string, port: number): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
  }

  const entries = readdirSync(src)
  for (const entry of entries) {
    // Skip Next.js build artifacts and node_modules
    if (['.next', 'node_modules', 'payload-types.ts'].includes(entry)) continue

    const srcPath = join(src, entry)
    const destPath = join(dest, entry)

    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath, slug, port)
    } else {
      const content = readFileSync(srcPath, 'utf-8')
      const transformed = transformContent(content, entry, slug, port)

      if (existsSync(destPath)) {
        // Idempotency: skip if content matches
        const existing = readFileSync(destPath, 'utf-8')
        if (existing === transformed) continue
      }

      writeFileSync(destPath, transformed, 'utf-8')
    }
  }
}

function transformContent(content: string, filename: string, slug: string, port: number): string {
  if (filename === 'package.json') {
    const pkg = JSON.parse(content) as Record<string, unknown>
    pkg.name = `@mjagency/web-${slug}`
    // Update port in scripts
    const scripts = pkg.scripts as Record<string, string>
    scripts.dev = `next dev -p ${port}`
    scripts.start = `next start -p ${port}`
    return JSON.stringify(pkg, null, 2) + '\n'
  }

  if (filename === 'layout.tsx' && content.includes('Brand Hub')) {
    return content.replace(
      'MJAgency Platform — Brand Hub',
      `MJAgency Platform — ${agencyTitle(slug)}`,
    ).replace(
      'MJAgency platform',
      `MJAgency ${agencyTitle(slug)} platform`,
    )
  }

  return content
}

// Main execution
const webMainPath = join(ROOT, 'apps', 'web-main')

if (!existsSync(webMainPath)) {
  console.error('ERROR: apps/web-main does not exist. Run Task 1.2 first.')
  process.exit(1)
}

for (const { slug, port } of AGENCY_APPS) {
  const destPath = join(ROOT, 'apps', `web-${slug}`)
  const exists = existsSync(destPath)

  copyDir(webMainPath, destPath, slug, port)

  if (exists) {
    console.log(`[no-op] apps/web-${slug} already exists — updated in place`)
  } else {
    console.log(`[created] apps/web-${slug} (port ${port})`)
  }
}

console.log('\nDone. All 11 agency apps scaffolded from web-main template.')
