#!/usr/bin/env node
/**
 * Wires Plan 11-05 ConsentProvider + CookieHintBanner + OptOutModal into each
 * agency app's (frontend)/layout.tsx.
 *
 * Strategy:
 *   - Apps WITHOUT layout.tsx → create a minimal canonical layout with the wrapper.
 *   - Apps WITH layout.tsx (web-main, web-ecommerce):
 *       * If layout already includes ConsentProvider → skip
 *       * Otherwise apply a SAFE patch:
 *           - add cookies() + ConsentProvider/CookieHintBanner/OptOutModal imports
 *           - promote function to async
 *           - wrap return JSX in <ConsentProvider initial=...> ...children... <OptOutModal /> {!hint && <CookieHintBanner />} </ConsentProvider>
 *
 * The patch operates on the literal `<body>{children}</body>` or
 * `<>{children}</>` (or similar). When it cannot find a safe wrap target,
 * the original is backed up to layout.before-11-05.tsx and a canonical layout
 * is written instead — visible diff for human review.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const APPS = [
  'web-main',
  'web-ecommerce',
  'web-realestate',
  'web-healthcare',
  'web-legal',
  'web-homeservices',
  'web-fitness',
  'web-dental',
  'web-automotive',
  'web-restaurant',
  'web-education',
  'web-financial',
  'web-petcare',
]

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

function freshLayout(slug) {
  return `/**
 * apps/${slug}/src/app/(frontend)/layout.tsx
 * Plan 11-05 / REQ-144 — public-app layout wrapped in ConsentProvider.
 * SSR-computed initial value from mj_consent cookie (D-02 — no flash).
 */
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import {
  ConsentProvider,
  CookieHintBanner,
  OptOutModal,
  type ConsentState,
} from '@mjagency/compliance'

const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? '${slug}'

export const metadata: Metadata = {
  title: \`MJAgency — \${AGENCY_NAME}\`,
  description: \`MJAgency platform — \${AGENCY_NAME}.\`,
}

export default async function FrontendLayout({ children }: { children: ReactNode }): Promise<React.JSX.Element> {
  const cookieJar = await cookies()
  const consent: ConsentState =
    cookieJar.get('mj_consent')?.value === 'tracking_blocked' ? 'tracking_blocked' : 'tracking_allowed'
  const hintDismissed = cookieJar.get('mj_consent_hint_dismissed')?.value === '1'

  return (
    <ConsentProvider initial={consent}>
      {children}
      <OptOutModal />
      {!hintDismissed && <CookieHintBanner />}
    </ConsentProvider>
  )
}
`
}

function patchLayout(slug, original) {
  if (original.includes('ConsentProvider')) {
    return null
  }

  const importLine = `import { cookies } from 'next/headers'
import {
  ConsentProvider,
  CookieHintBanner,
  OptOutModal,
  type ConsentState,
} from '@mjagency/compliance'
`

  let patched = original

  // Insert imports after the last existing import statement
  const importBlock = patched.match(/(?:^import [^\n]+\n)+/m)
  if (importBlock) {
    patched = patched.replace(importBlock[0], importBlock[0] + importLine)
  } else {
    patched = importLine + patched
  }

  // Promote default function to async if not already
  patched = patched.replace(
    /export default function (\w+)/,
    'export default async function $1',
  )

  // Promote the return type to Promise<React.JSX.Element> if it's React.JSX.Element / ReactNode
  patched = patched.replace(
    /(export default async function \w+\([^)]*\)):\s*ReactNode\b/,
    '$1: Promise<React.JSX.Element>',
  )

  // Insert the cookie reads at the top of the function body. Find the first '{'
  // after 'export default async function ...'.
  const fnHeaderMatch = patched.match(
    /(export default async function \w+\([^)]*\)\s*(?::\s*[^\n{]+)?\s*\{)/,
  )
  if (fnHeaderMatch) {
    const insertion = `
  const cookieJar = await cookies()
  const consent: ConsentState =
    cookieJar.get('mj_consent')?.value === 'tracking_blocked' ? 'tracking_blocked' : 'tracking_allowed'
  const hintDismissed = cookieJar.get('mj_consent_hint_dismissed')?.value === '1'
`
    patched = patched.replace(fnHeaderMatch[1], fnHeaderMatch[1] + insertion)
  }

  // Wrap the return JSX with ConsentProvider. Heuristic: locate the outermost
  // returned element. We add the wrapper around `<html lang="en">` if present
  // (web-ecommerce pattern), or around the existing top-level fragment.
  if (patched.includes('<html lang="en">')) {
    // Wrap inside <body> — the ConsentProvider must wrap children, OptOutModal,
    // and CookieHintBanner so the dialog and banner mount in the same React tree.
    patched = patched.replace(
      /<body>\s*([\s\S]*?)\s*<\/body>/,
      (m, inner) => `<body>
        <ConsentProvider initial={consent}>
          ${inner.trim()}
          <OptOutModal />
          {!hintDismissed && <CookieHintBanner />}
        </ConsentProvider>
      </body>`,
    )
  } else if (patched.match(/return\s*\(\s*<>/)) {
    // Fragment top-level — replace fragments with ConsentProvider
    patched = patched.replace(
      /return\s*\(\s*<>([\s\S]*?)<\/>\s*\)/,
      (_m, inner) => `return (
    <ConsentProvider initial={consent}>
      ${inner.trim()}
      <OptOutModal />
      {!hintDismissed && <CookieHintBanner />}
    </ConsentProvider>
  )`,
    )
  } else {
    // Cannot find a safe wrap target — return null to signal canonical-rewrite path.
    return null
  }

  return patched
}

for (const slug of APPS) {
  const layoutPath = join(repoRoot, 'apps', slug, 'src', 'app', '(frontend)', 'layout.tsx')
  if (!existsSync(layoutPath)) {
    mkdirSync(dirname(layoutPath), { recursive: true })
    writeFileSync(layoutPath, freshLayout(slug))
    console.log(`  ${slug}: wrote new layout`)
    continue
  }

  const original = readFileSync(layoutPath, 'utf8')
  const patched = patchLayout(slug, original)
  if (patched === null) {
    if (original.includes('ConsentProvider')) {
      console.log(`  ${slug}: already has ConsentProvider — skipping`)
    } else {
      const backupPath = layoutPath.replace(/\.tsx$/, '.before-11-05.tsx')
      writeFileSync(backupPath, original)
      writeFileSync(layoutPath, freshLayout(slug))
      console.log(`  ${slug}: could not patch — backed up & wrote canonical layout`)
    }
  } else {
    writeFileSync(layoutPath, patched)
    console.log(`  ${slug}: patched layout`)
  }
}
console.log('done')
