// scripts/validate-themes.ts
// Runs in CI: pnpm theme:validate
// Validates all theme.json files against theme.schema.json (AJV 8.20.0).
// Scans all SVG illustrations for hex literals (REQ-047 belt-and-suspenders).
// Handles missing directories gracefully — Plan 04-04 ships 12 themes; Phase 12 ships 30+ SVGs/agency.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { assertValidTheme, assertNoHexLiterals } from '../packages/ui/src/theme/validate-theme.js';

const THEMES_DIR = 'packages/ui/themes/default';
const SVG_DIR    = 'packages/ui/assets/illustrations';

let errorCount = 0;
let okCount    = 0;

// Validate all theme.json files (Plan 04-04 ships 12 of these)
if (existsSync(THEMES_DIR)) {
  const files = readdirSync(THEMES_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(THEMES_DIR, file), 'utf-8'));
      assertValidTheme(data, file);
      console.log(`  theme OK: ${file}`);
      okCount++;
    } catch (err) {
      console.error(`  theme FAIL: ${file}\n${(err as Error).message}\n`);
      errorCount++;
    }
  }
} else {
  console.log(`  (no themes directory yet at ${THEMES_DIR} — Plan 04-04 ships 12 niche themes)`);
}

// Check all SVG files for hex literals (Phase 12 content sprint ships 30+/agency)
if (existsSync(SVG_DIR)) {
  const files = readdirSync(SVG_DIR).filter(f => f.endsWith('.svg'));
  for (const file of files) {
    try {
      const content = readFileSync(join(SVG_DIR, file), 'utf-8');
      assertNoHexLiterals(content, file);
      console.log(`  svg OK: ${file}`);
      okCount++;
    } catch (err) {
      console.error(`  svg FAIL: ${file}\n${(err as Error).message}\n`);
      errorCount++;
    }
  }
} else {
  console.log(`  (no illustrations directory yet at ${SVG_DIR} — Phase 12 content sprint)`);
}

if (errorCount > 0) {
  console.error(`\n  ${errorCount} validation error(s); ${okCount} OK`);
  process.exit(1);
}
console.log(`\n  ${okCount} item(s) validated. No hex literals found. No invalid themes.`);
