---
phase: "10"
plan: "03"
subsystem: tools-pitch-builder
tags: [react-components, tool-pages, isr-routes, seed-script, email-gate, calculator-form]
dependency_graph:
  requires: [10-01, 10-02]
  provides: [tool-page-components, per-agency-tool-routes, tool-page-seed-script]
  affects: [all-12-agency-apps, packages/tools]
tech_stack:
  added:
    - React client components with var(--mj-*) token system
    - per-agency ISR tool routes (generateStaticParams)
    - seed script with word count enforcement (Node.js ESM)
  patterns:
    - 'use client' + fetch to API route (public form pattern from Phase 9)
    - inline result section (id=tool-result, no separate result page)
    - email gate modal with WCAG role=dialog, aria-modal, focus-trap, ESC
key_files:
  created:
    - packages/tools/src/pages/BenchmarkBadge.tsx
    - packages/tools/src/pages/ToolResultSection.tsx
    - packages/tools/src/pages/EmailGateModal.tsx
    - packages/tools/src/pages/CalculatorForm.tsx
    - packages/tools/src/pages/PdfConfirmationPage.tsx
    - packages/tools/src/pages/tool-page-template.tsx
    - packages/tools/src/pages/index.ts
    - scripts/seed-tool-pages.ts
    - apps/web-ecommerce/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-realestate/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-healthcare/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-legal/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-homeservices/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-fitness/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-dental/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-automotive/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-restaurant/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-education/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-financial/src/app/(frontend)/tools/[slug]/page.tsx
    - apps/web-petcare/src/app/(frontend)/tools/[slug]/page.tsx
  modified:
    - packages/tools/src/index.ts (added pages barrel re-export)
    - packages/tools/package.json (added peerDep react, devDep @types/react, ./pages export)
    - apps/web-ecommerce/package.json (added @mjagency/tools workspace dep)
decisions:
  - BenchmarkBadge uses var(--mj-color-text-on-warning) instead of plan's fallback #000 — pure CSS token
  - CalculatorForm handles select field type (type='select') for full ToolInputField support
  - EmailGateModal uses var(--mj-color-overlay) for backdrop (CSS token, no hex literal)
  - ToolPageTemplate dangerouslySetInnerHTML is intentional for Payload CMS pre-sanitized bodyHtml only
  - Added React 19 peerDependency + @types/react devDependency to packages/tools for JSX components
  - Rule 3 auto-fix: Added @mjagency/tools workspace dependency to web-ecommerce package.json
metrics:
  duration: "~25 minutes"
  completed: "2026-04-28"
  tasks: 3
  files: 22
---

# Phase 10 Plan 03: Tool Content — Full Page per Tool, 2200+ Words, SEO/AIO Content Summary

One-liner: React tool page components (CalculatorForm, EmailGateModal, BenchmarkBadge, ToolResultSection, PdfConfirmationPage) + 12 per-agency ISR routes + 2200-word seed script with word count enforcement.

## Tasks Completed

### T-01: 5 React Page Components

All components use only `var(--mj-*)` CSS tokens — zero hex literals. No `dangerouslySetInnerHTML` in the 5 client components.

| Component | Key Feature | ARIA/REQ |
|-----------|------------|---------|
| BenchmarkBadge.tsx | Yellow pill shown when expired=true | role="status", var(--mj-color-warning) |
| ToolResultSection.tsx | Inline result render | id="tool-result", data-print-region="tool-result" |
| EmailGateModal.tsx | Email gate dialog | role="dialog" aria-modal="true", autofocus email, ESC closes |
| CalculatorForm.tsx | Wires runCalculator() | Calls engine/calculator.ts, inline result via ToolResultSection |
| PdfConfirmationPage.tsx | Resend form | fetch /api/tools/resend-pdf, honeypot included |

Also created:
- `tool-page-template.tsx` — server component rendering tool page with CalculatorForm + Payload CMS bodyHtml (pre-sanitized, dangerouslySetInnerHTML intentionally allowed per plan)
- `pages/index.ts` — barrel export for all 6 components

### T-02: 12 Per-Agency Next.js Tool Routes

Created all 12 files at `apps/web-{agency}/src/app/(frontend)/tools/[slug]/page.tsx`:

| Agency | AGENCY_SLUG |
|--------|------------|
| web-ecommerce | ecommerce |
| web-realestate | realestate |
| web-healthcare | healthcare |
| web-legal | legal |
| web-homeservices | homeservices |
| web-fitness | fitness |
| web-dental | dental |
| web-automotive | automotive |
| web-restaurant | restaurant |
| web-education | education |
| web-financial | financial |
| web-petcare | petcare |

Each file:
- `generateStaticParams()` for ISR pre-rendering
- `if (!tool || tool.agencySlug !== AGENCY_SLUG) { notFound() }` cross-agency guard
- Calls `loadBenchmarks()` server-side
- Renders `<ToolPageTemplate>`

### T-03: Seed Script

`scripts/seed-tool-pages.ts` (Node.js ESM):
- `MIN_WORD_COUNT = 2200` — enforced before any CMS write
- `MAX_FAILURES = 3` — exits 1 if threshold exceeded
- `--agency=<slug>` and `--all` flags
- Uses `generateContent()` from `@mjagency/ai` with `pageType: 'tool'`
- Upserts via Payload REST API (PATCH if exists, POST if new)
- AIO TL;DR truncated to ≤120 characters before save
- 5 FAQ pairs per tool included in page data
- No Python, no CommonJS — Node.js ESM only (STATE.md decision)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added React peerDependency to packages/tools**
- Found during: T-01
- Issue: packages/tools had no React dependency but new .tsx components use React types/hooks
- Fix: Added `"react": "^18 || ^19"` as peerDependency, `"react": "19.0.0"` and `"@types/react": "19.0.0"` to devDependencies
- Files modified: packages/tools/package.json

**2. [Rule 2 - Missing] Added ./pages export subpath to packages/tools**
- Found during: T-02
- Issue: per-agency routes import from `@mjagency/tools/pages` — this requires the `exports` map to include `"./pages"` entry
- Fix: Added `"./pages": { types: "./src/pages/index.ts", default: "./src/pages/index.ts" }` to package.json exports
- Files modified: packages/tools/package.json

**3. [Rule 3 - Blocking] Added @mjagency/tools dep to web-ecommerce**
- Found during: T-02
- Issue: web-ecommerce/package.json did not list @mjagency/tools as a dependency, blocking TS resolution
- Fix: Added `"@mjagency/tools": "workspace:*"` to dependencies
- Files modified: apps/web-ecommerce/package.json
- Note: The other 11 agency apps (web-realestate through web-petcare) could not be read/updated as their package.json files appear to be in a parallel agent worktree (agent-accfc500ad0137dde). Their package.json files need `@mjagency/tools: workspace:*` added before build.

**4. [Rule 1 - Bug] Replaced plan's hex fallback with CSS token in BenchmarkBadge**
- Found during: T-01
- Issue: Plan code had `color: 'var(--mj-color-text-on-warning, #000)'` — hex fallback violates zero-hex rule
- Fix: Changed to `color: 'var(--mj-color-text-on-warning)'` — CSS-token-only
- Files modified: packages/tools/src/pages/BenchmarkBadge.tsx

**5. [Rule 2 - Missing] Added select field support in CalculatorForm**
- Found during: T-01
- Issue: ToolInputField type includes `type: 'select'` with options array; plan template only showed `<input>` handling
- Fix: Added `<select>` rendering branch for field.type === 'select'
- Files modified: packages/tools/src/pages/CalculatorForm.tsx

## Verification Results

| Check | Result |
|-------|--------|
| Zero hex literals in pages/ | PASS — grep returned 0 results |
| dangerouslySetInnerHTML in 5 client components | PASS — 0 results in CalculatorForm, EmailGateModal, BenchmarkBadge, ToolResultSection, PdfConfirmationPage |
| dangerouslySetInnerHTML in tool-page-template.tsx | PRESENT — intentional (Payload CMS pre-sanitized content) |
| id="tool-result" in ToolResultSection | PASS |
| role="dialog" in EmailGateModal | PASS |
| 12 per-agency route files | PASS — 12 files created |
| MIN_WORD_COUNT = 2200 in seed script | PASS |
| MAX_FAILURES = 3 in seed script | PASS |
| generateStaticParams in ecommerce route | PASS |
| notFound() in ecommerce route | PASS |

## TypeScript Typecheck

Could not run `pnpm typecheck --filter=@mjagency/tools` — Bash access denied during execution. Manual review confirms:
- All imports use explicit `.js` extensions (ESM)
- All functions have explicit return types
- No `any` types used
- `verbatimModuleSyntax` compatibility: only `import type` used for type-only imports
- `React.JSX.Element` return types match @types/react 19.0.0 definitions

## Known Stubs

None. All components are fully implemented with real logic.

## Threat Flags

None. All threat model mitigations from the plan are implemented:
- T-10-03-01: CalculatorForm validates via runCalculator() engine
- T-10-03-02: Honeypot field present in EmailGateModal
- T-10-03-04: PAYLOAD_API_KEY sourced from process.env in seed script
- T-10-03-06: notFound() guard on all 12 per-agency routes

## Self-Check: PASSED

All key files exist at expected paths:
- packages/tools/src/pages/BenchmarkBadge.tsx ✓
- packages/tools/src/pages/ToolResultSection.tsx ✓
- packages/tools/src/pages/EmailGateModal.tsx ✓
- packages/tools/src/pages/CalculatorForm.tsx ✓
- packages/tools/src/pages/PdfConfirmationPage.tsx ✓
- packages/tools/src/pages/tool-page-template.tsx ✓
- packages/tools/src/pages/index.ts ✓
- packages/tools/src/index.ts (updated) ✓
- packages/tools/package.json (updated) ✓
- scripts/seed-tool-pages.ts ✓
- All 12 apps/web-{agency}/src/app/(frontend)/tools/[slug]/page.tsx ✓

## Pending Action (Bash Access Required)

Commit all files with:
```
git add packages/tools/src/pages/
git add packages/tools/src/index.ts
git add packages/tools/package.json
git add apps/web-ecommerce/package.json
git add apps/web-realestate/src/app/\(frontend\)/tools/
git add apps/web-healthcare/src/app/\(frontend\)/tools/
git add apps/web-legal/src/app/\(frontend\)/tools/
git add apps/web-homeservices/src/app/\(frontend\)/tools/
git add apps/web-fitness/src/app/\(frontend\)/tools/
git add apps/web-dental/src/app/\(frontend\)/tools/
git add apps/web-automotive/src/app/\(frontend\)/tools/
git add apps/web-restaurant/src/app/\(frontend\)/tools/
git add apps/web-education/src/app/\(frontend\)/tools/
git add apps/web-financial/src/app/\(frontend\)/tools/
git add apps/web-petcare/src/app/\(frontend\)/tools/
git add scripts/seed-tool-pages.ts
git commit -m "feat(10-03): tool content pages — 5 components, 12 agency routes, seed script"
```

Also required for the other 11 agency apps:
- Add `"@mjagency/tools": "workspace:*"` to their package.json dependencies
