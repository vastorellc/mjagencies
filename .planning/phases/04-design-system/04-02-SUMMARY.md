---
plan: 04-02
phase: 04
status: complete
started: 2026-04-26
completed: 2026-04-26
tasks_total: 2
tasks_complete: 2
commits:
  - 238daf9
  - b48476c
  - 938cdea
  - 9b7a889
  - 711f0b8
requirements_addressed:
  - REQ-041
  - REQ-042
  - REQ-047
---

# Plan 04-02 Summary — theme.json Manifest + AJV Validator

## What Was Built

### Task 2.1 — theme.schema.json + AJV Validator + Types

- `packages/ui/themes/schemas/theme.schema.json` — JSON Schema Draft-07 document:
  - Requires ALL 20 customization scopes: `brand`, `color`, `type`, `spacing`, `layout`, `components`, `header`, `footer`, `hero`, `blocks`, `templates`, `motion`, `icons`, `imagery`, `theme`, `a11y`, `perf`, `seo-defaults`, `custom-css`, `code-injection` (REQ-042).
  - `noHexValue` `$def` rejects hex literals (`#[0-9a-fA-F]{3,8}`) AND `url()` references in every scope value (REQ-047 + SSRF block).
  - `imageryScope` `$def` permits `object-fit`, `aspect-ratio`, and enum strings — does not allow hex in image tokens.
  - `additionalProperties: false` on all scopes — unknown keys are rejected.
  - `$schema` property added to allowed schema root properties for editor inline validation tooling.

- `packages/ui/src/theme/validate-theme.ts` — AJV 8.20.0 validator:
  - AJV singleton compiled once at module init (Pitfall 4 — avoids recompilation overhead).
  - `assertValidTheme(data: unknown, filename: string)`: TypeScript assertion function — throws `Error` with formatted AJV error list on failure (REQ-041).
  - `assertNoHexLiterals(svgContent: string, filename: string)`: SVG hex scanner — belt-and-suspenders for REQ-047 against niche illustration SVGs (Phase 12 content sprint).

- `packages/ui/src/theme/types.ts` — Full `ThemeJson` interface replacing 04-01 stub:
  - `ScopeKey` union type (20 scope keys).
  - `AgencyNiche` enum (12 niche slugs from `@mjagency/config`).
  - `ThemeMeta`, `ThemeScopes`, `ThemeDarkOverrides`, `ThemeJson` interfaces.

- `packages/ui/src/index.ts` — Added `assertValidTheme`, `assertNoHexLiterals`, `ThemeJson`, `ThemeScopes`, `ScopeKey`, `AgencyNiche` exports. Phase 04-01 exports preserved.

- All 28 tests pass (8 from 04-01 + 20 new validator tests).

### Task 2.2 — CI Validate Script

- `scripts/validate-themes.ts` — CI entry script:
  - Iterates `packages/ui/themes/default/*.json` and calls `assertValidTheme` on each.
  - Iterates `packages/ui/assets/illustrations/*.svg` and calls `assertNoHexLiterals` on each.
  - Graceful empty-directory handling via `existsSync` — exits 0 when Plan 04-04 theme files don't yet exist (Plan 04-04 ships them).
  - Tracks `errorCount`; `process.exit(1)` on any failure.

- `package.json` (root) — `theme:validate` script: `pnpm tsx scripts/validate-themes.ts`.

## Key Files Created

- `packages/ui/themes/schemas/theme.schema.json`
- `packages/ui/src/theme/validate-theme.ts`
- `packages/ui/src/theme/types.ts` (replaced 04-01 stub)
- `scripts/validate-themes.ts`

## Key Files Modified

- `packages/ui/src/index.ts` — validator + type exports added
- `packages/ui/package.json` — `ajv@8.20.0` + `ajv-formats@3.0.1` (exact pins, production deps)
- `package.json` — `theme:validate` script

## Deviations

1. **Test 4 enum regex** — AJV 8.20 formats enum error messages differently from 8.x earlier. Regex in `validate-theme.test.ts` adjusted to match AJV 8.20 error format.
2. **$schema in allowed properties** — Added `$schema` to schema root `allowedProperties` so editors can self-reference the schema without AJV rejecting the file it validates.

## Self-Check: PASSED

Acceptance criteria verified:
- `grep "assertValidTheme" packages/ui/src/theme/validate-theme.ts` ✓
- `grep "assertNoHexLiterals" packages/ui/src/theme/validate-theme.ts` ✓
- `grep "noHexValue" packages/ui/themes/schemas/theme.schema.json` ✓
- 20 required scopes in schema `required` array ✓
- `pnpm theme:validate` exits 0 on empty dirs, exits 1 on bad theme ✓
- All 28 tests pass ✓
