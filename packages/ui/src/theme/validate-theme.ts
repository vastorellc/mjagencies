// packages/ui/src/theme/validate-theme.ts
// AJV 8.20.0 module-singleton validator for theme.json files.
// Pitfall 4 mitigation: schema compiled once at module init, reused forever.
// Server-only / build-only — never bundled to browser.
// REQ-041 (assertValidTheme assertion function), REQ-047 (no-hex enforcement).
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeJson } from './types.js';

// Load schema synchronously at module init — readFileSync is safe here because
// validate-theme.ts is server-only / build-only (never bundled to browser).
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '../../themes/schemas/theme.schema.json');
const themeSchema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8')) as object;

// AJV singleton — compile once, reuse forever (Pitfall 4)
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validateTheme: ValidateFunction<ThemeJson> = ajv.compile<ThemeJson>(themeSchema);

/**
 * TypeScript assertion: narrows `unknown` to `ThemeJson` on success.
 * Throws Error with formatted error list on failure (REQ-041).
 */
export function assertValidTheme(data: unknown, filename: string): asserts data is ThemeJson {
  const valid = validateTheme(data);
  if (!valid) {
    const errors = validateTheme.errors ?? [];
    const messages = errors
      .map(e => `  ${e.instancePath || '(root)'}: ${e.message}${e.params ? ' — ' + JSON.stringify(e.params) : ''}`)
      .join('\n');
    throw new Error(`Invalid theme "${filename}":\n${messages}`);
  }
}

/**
 * Standalone hex-literal scanner — used for SVG illustrations.
 * Belt-and-suspenders: AJV catches hex in theme.json values; this catches hex in SVG XML (REQ-047, Pitfall 7).
 */
const HEX_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b/g;
export function assertNoHexLiterals(content: string, filename: string): void {
  const matches = content.match(HEX_LITERAL_RE);
  if (matches && matches.length > 0) {
    const unique = Array.from(new Set(matches));
    throw new Error(
      `Hex literal(s) detected in "${filename}": ${unique.join(', ')}. ` +
      `Use var(--mj-ill-*) instead. See packages/ui/tokens/layer-6-components.css for available illustration tokens.`,
    );
  }
}
