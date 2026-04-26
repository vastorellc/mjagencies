/**
 * packages/ui/src/__tests__/tokens-shape.test.ts
 * Token shape / structural validation tests for the 6-layer CSS token schema.
 * All tests use synchronous fs.readFileSync — no async setup, no DOM, no Tailwind build.
 * Pure text parsing. RESEARCH §1.2, §6.1, §1.3.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Resolve paths relative to the packages/ui root (2 levels up from src/__tests__)
const PKG_ROOT = resolve(__dirname, '../..')

function readToken(relPath: string): string {
  return readFileSync(resolve(PKG_ROOT, relPath), 'utf-8')
}

describe('tokens-shape', () => {
  it('Test 1: Layer 1 has --mj-primitive-* tokens only (no cross-layer refs)', () => {
    const css = readToken('tokens/layer-1-primitives.css')

    // Must have at least 18 primitive tokens (6 blues + 12 neutrals)
    const primitiveLines = css.split('\n').filter((l) => l.includes('--mj-primitive-'))
    expect(primitiveLines.length).toBeGreaterThanOrEqual(18)

    // Layer 1 must NOT reference semantic or spacing layers
    expect(css).not.toMatch(/var\(--mj-color-/)
    expect(css).not.toMatch(/var\(--mj-space-/)
  })

  it('Test 2: Layer 2 references only Layer 1 primitives or own semantic vars', () => {
    const css = readToken('tokens/layer-2-semantic-color.css')

    // Extract all var(--mj-*) references
    const varRefs = [...css.matchAll(/var\(--mj-([\w-]+)/g)].map((m) => m[1])

    for (const ref of varRefs) {
      const isAllowed =
        ref.startsWith('primitive-') || ref.startsWith('color-')
      expect(isAllowed).toBe(true)
    }
  })

  it('Test 3: Layer 3 has font/size/weight/leading/tracking categories + next/font indirection', () => {
    const css = readToken('tokens/layer-3-typography.css')

    expect(css).toContain('--mj-font-sans')
    expect(css).toContain('--mj-font-brand')
    expect(css).toContain('--mj-text-size-base')
    expect(css).toContain('--mj-weight-bold')
    expect(css).toContain('--mj-leading-normal')
    expect(css).toContain('--mj-tracking-normal')

    // Open Q3 resolution: --mj-font-brand must use var(--font-brand, ...) indirection
    const brandFontLine = css.split('\n').find((l) => l.includes('--mj-font-brand'))
    expect(brandFontLine).toBeDefined()
    expect(brandFontLine).toContain('var(--font-brand')
  })

  it('Test 4: Layer 4 has 14+ spacing tokens, 6+ container widths, 8+ radius tokens', () => {
    const css = readToken('tokens/layer-4-layout.css')

    const spaceTokens = css.split('\n').filter((l) => /--mj-space-\d/.test(l))
    expect(spaceTokens.length).toBeGreaterThanOrEqual(14)

    const containerTokens = css.split('\n').filter((l) => l.includes('--mj-container-'))
    expect(containerTokens.length).toBeGreaterThanOrEqual(6)

    const radiusTokens = css.split('\n').filter((l) => l.includes('--mj-radius-'))
    expect(radiusTokens.length).toBeGreaterThanOrEqual(8)
  })

  it('Test 5: Layer 5 shadows use OKLCH alpha, not rgba', () => {
    const css = readToken('tokens/layer-5-effects.css')

    const shadowLines = css.split('\n').filter((l) => l.includes('--mj-shadow-'))
    expect(shadowLines.length).toBeGreaterThan(0)

    for (const line of shadowLines) {
      expect(line).toContain('oklch(')
      expect(line).not.toMatch(/rgba\(/)
    }
  })

  it('Test 6: Layer 6 NEVER references --mj-primitive-* directly (except --mj-ill-neutral)', () => {
    const css = readToken('tokens/layer-6-components.css')

    const primitiveRefLines = css.split('\n').filter((l) => l.includes('--mj-primitive-'))
    // Only allowed: the --mj-ill-neutral line
    for (const line of primitiveRefLines) {
      expect(line).toContain('--mj-ill-neutral')
    }
  })

  it('Test 7: dark-mode.css selector is [data-theme="dark"] and only flips color/card/form tokens', () => {
    const css = readToken('tokens/dark-mode.css')

    // Selector must be present
    expect(css).toMatch(/\[data-theme="dark"\]/)

    // Extract all custom property declarations inside the block
    const declarations = css.split('\n').filter((l) => /^\s+--mj-/.test(l))

    for (const decl of declarations) {
      const propMatch = decl.match(/--mj-([\w-]+)/)
      if (!propMatch) continue
      const prop = propMatch[1]
      const isAllowed =
        prop.startsWith('color-') ||
        prop.startsWith('card-') ||
        prop.startsWith('form-')
      expect(isAllowed).toBe(true)
    }
  })

  it('Test 8: theme.css imports all 7 token files in order + has @theme inline + @custom-variant dark', () => {
    const css = readToken('styles/theme.css')

    // Check presence in order
    const importTailwind = css.indexOf('@import "tailwindcss"')
    const importL1 = css.indexOf('@import "../tokens/layer-1-primitives.css"')
    const importL2 = css.indexOf('@import "../tokens/layer-2-semantic-color.css"')
    const importL3 = css.indexOf('@import "../tokens/layer-3-typography.css"')
    const importL4 = css.indexOf('@import "../tokens/layer-4-layout.css"')
    const importL5 = css.indexOf('@import "../tokens/layer-5-effects.css"')
    const importL6 = css.indexOf('@import "../tokens/layer-6-components.css"')
    const importDark = css.indexOf('@import "../tokens/dark-mode.css"')
    const themeInline = css.indexOf('@theme inline {')
    const customVariant = css.indexOf('@custom-variant dark (')

    expect(importTailwind).toBeGreaterThanOrEqual(0)
    expect(importL1).toBeGreaterThan(importTailwind)
    expect(importL2).toBeGreaterThan(importL1)
    expect(importL3).toBeGreaterThan(importL2)
    expect(importL4).toBeGreaterThan(importL3)
    expect(importL5).toBeGreaterThan(importL4)
    expect(importL6).toBeGreaterThan(importL5)
    expect(importDark).toBeGreaterThan(importL6)
    expect(themeInline).toBeGreaterThan(importDark)
    expect(customVariant).toBeGreaterThan(themeInline)
  })
})
