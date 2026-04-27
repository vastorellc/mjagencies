/**
 * packages/cms/src/dam/living-brand-book.ts
 *
 * Living brand book: auto-rendered from Phase 4 CSS tokens (REQ-063).
 * Returns structured data that the brand book page component renders.
 * Updates automatically when theme.json tokens or assets change.
 *
 * Sections: logos, colors, typography, voice, imagery, icons, illustrations.
 * Replaces static brand PDF.
 *
 * Phase 5 scope: reads theme.json from packages/ui/themes/default/<agencySlug>.theme.json
 * Phase 8: the living brand book page is served at /brand-book on each agency app.
 */
import type { AgencySlug } from '@mjagency/config'
// Deep imports to avoid loading resolve-theme.ts (which imports 'server-only') via the barrel
// when running in non-Next.js contexts (e.g. Payload migrate CLI). Rule 3 fix — 07-04.
import type { ThemeJson } from '@mjagency/ui/theme/types'
import { assertValidTheme } from '@mjagency/ui/theme/validate-theme'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

export interface LivingBrandBookColor {
  name: string
  token: string
  value: string // resolved CSS var value from theme.json
  usage: string // e.g. "Primary actions, buttons, links"
}

export interface LivingBrandBookFont {
  name: string
  token: string
  family: string
  usage: string
}

export interface LivingBrandBook {
  agencySlug: AgencySlug
  siteName: string
  colors: LivingBrandBookColor[]
  fonts: LivingBrandBookFont[]
  logoUrl?: string
  voiceGuidelines?: string
  generatedAt: string // ISO 8601
}

/**
 * Builds the living brand book data for a given agency slug.
 * Reads from the canonical theme.json file in packages/ui/themes/default/.
 *
 * @param agencySlug - Agency slug (from AGENCIES const)
 * @returns LivingBrandBook structured data
 */
export async function getLivingBrandBook(agencySlug: AgencySlug): Promise<LivingBrandBook> {
  const themeDir = path.resolve(
    fileURLToPath(import.meta.url),
    '../../../../../ui/themes/default'
  )
  const themeFile = path.join(themeDir, `${agencySlug}.theme.json`)

  let themeJson: ThemeJson
  try {
    const raw = await readFile(themeFile, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    assertValidTheme(parsed, themeFile) // validates schema + no hex literals (Phase 4 validator)
    // assertValidTheme is an assertion function — after this line, `parsed` is ThemeJson
    themeJson = parsed as ThemeJson
  } catch (err) {
    console.error(`[DAM] Living brand book: could not read theme for ${agencySlug}:`, err)
    // Return minimal fallback — never throw; brand book is non-blocking
    return {
      agencySlug,
      siteName: agencySlug,
      colors: [],
      fonts: [],
      generatedAt: new Date().toISOString(),
    }
  }

  // Extract color tokens from theme.json scopes.color scope
  // ThemeScopes.color is Record<string, string> (ThemeScope)
  const colorTokens = Object.entries(themeJson.scopes.color).map(([token, value]) => ({
    name: token.replace(/^--mj-color-/, '').replace(/-/g, ' '),
    token,
    value,
    usage: getColorUsage(token),
  }))

  // Extract font tokens from theme.json scopes.type scope
  // ThemeScopes.type is Record<string, string> (ThemeScope) — typography tokens
  const fontTokens = Object.entries(themeJson.scopes.type)
    .filter(([t]) => t.includes('font-'))
    .map(([token, value]) => ({
      name: token.replace(/^--mj-/, '').replace(/-/g, ' '),
      token,
      family: value,
      usage: token.includes('heading') ? 'Headings (H1–H6)' : 'Body text, UI elements',
    }))

  return {
    agencySlug,
    siteName: themeJson.meta.name,
    colors: colorTokens,
    fonts: fontTokens,
    generatedAt: new Date().toISOString(),
  }
}

function getColorUsage(token: string): string {
  if (token.includes('brand-primary') || token.includes('brand-500')) return 'Primary actions, CTA buttons, links'
  if (token.includes('brand-secondary') || token.includes('brand-50')) return 'Secondary actions, hover states'
  if (token.includes('accent-primary')) return 'Accent highlights, badges, tags'
  if (token.includes('accent-secondary')) return 'Accent secondary, supporting highlights'
  if (token.includes('text-primary')) return 'Body text, headings'
  if (token.includes('text-secondary')) return 'Captions, metadata, labels'
  if (token.includes('bg-primary')) return 'Primary page background'
  if (token.includes('bg-secondary')) return 'Secondary backgrounds, cards'
  if (token.includes('bg-inverse')) return 'Inverse backgrounds (dark mode)'
  if (token.includes('border-default')) return 'Default borders, dividers'
  if (token.includes('border-subtle')) return 'Subtle borders, outlines'
  if (token.includes('border-focus')) return 'Focus rings, keyboard navigation'
  if (token.includes('success')) return 'Success states, confirmations'
  if (token.includes('warning')) return 'Warning states, alerts'
  if (token.includes('error')) return 'Error states, validation'
  if (token.includes('info')) return 'Informational states, hints'
  return 'Theme color'
}
