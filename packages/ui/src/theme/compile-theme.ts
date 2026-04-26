// packages/ui/src/theme/compile-theme.ts
// Build-time only. Plan 04-04 runs this once per agency at build to emit static CSS.
// REQ-043: pure CSS cascade; no JS merging at runtime.
// Pitfall 8: custom-css is appended VERBATIM after the [data-agency] block, NOT inside it.
import { assertValidTheme } from './validate-theme.js';
import type { ThemeJson, ScopeKey } from './types.js';

interface CompileOptions {
  agency: string;        // slug, e.g., 'ecommerce'
  theme:  ThemeJson;
}

const SKIP_DURING_SCOPE_BLOCK: ReadonlySet<ScopeKey> = new Set(['custom-css', 'code-injection']);

/**
 * Emit per-agency CSS:
 *   [data-agency="X"] { --mj-{scope}-{key}: {value}; ... }
 *   [data-agency="X"][data-theme="dark"] { ... }   // optional
 *   {custom-css verbatim}                          // optional, post-block
 *
 * REQ-043. Calls assertValidTheme first — fail fast on invalid input.
 * Pitfall 8: custom-css content appended after agency block (never inside).
 * code-injection scope skipped entirely (SSR head/body injection, Phase 8).
 */
export function compileThemeToCss({ agency, theme }: CompileOptions): string {
  assertValidTheme(theme, `theme-${agency}.json`);

  const lines: string[] = [];
  const { scopes, dark } = theme;

  // Layer 2: agency override block
  lines.push(`[data-agency="${agency}"] {`);
  for (const [scope, values] of Object.entries(scopes) as [ScopeKey, unknown][]) {
    if (SKIP_DURING_SCOPE_BLOCK.has(scope)) continue;
    if (typeof values === 'object' && values !== null) {
      for (const [key, value] of Object.entries(values as Record<string, string>)) {
        lines.push(`  --mj-${scope}-${key}: ${value};`);
      }
    }
  }
  lines.push('}');

  // Layer 4: dark mode override block (only if `dark` overlay is provided)
  if (dark && Object.keys(dark).length > 0) {
    lines.push(`[data-agency="${agency}"][data-theme="dark"] {`);
    for (const [scope, values] of Object.entries(dark)) {
      if (typeof values === 'object' && values !== null) {
        for (const [key, value] of Object.entries(values as Record<string, string>)) {
          lines.push(`  --mj-${scope}-${key}: ${value};`);
        }
      }
    }
    lines.push('}');
  }

  // Custom CSS (admin-only escape hatch — appended verbatim, NOT inside scope block)
  // M004: admin-only; M010 Builder must strip expression(/javascript:/url(data: before widening this scope.
  const customCss = scopes['custom-css'];
  if (typeof customCss === 'string' && customCss.trim().length > 0) {
    lines.push(`/* custom-css for ${agency} (admin-authored, no compile-time interpolation) */`);
    lines.push(customCss);
  }

  return lines.join('\n');
}
