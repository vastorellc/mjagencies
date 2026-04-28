# Phase 12: Launch + QA + Seeds + Runbooks + SLA — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 22 (3 admin views, 1 public page, 2 CI workflows, 1 headless script, 13 runbooks, 2 Playwright suites)
**Analogs found:** 22 / 22

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `packages/cms/src/admin-views/BrandSetupView.tsx` | component (admin view) | request-response | `packages/cms/src/admin-views/DashboardView.tsx` | exact |
| `packages/cms/src/admin-views/brand-setup-view-config.ts` | config | config | `packages/cms/src/admin-views/dashboard-view-config.ts` | exact |
| `packages/cms/src/admin-views/QaReportView.tsx` | component (admin view) | request-response | `packages/cms/src/admin-views/DashboardView.tsx` | exact |
| `packages/cms/src/admin-views/qa-report-view-config.ts` | config | config | `packages/cms/src/admin-views/dashboard-view-config.ts` | exact |
| `apps/web-main/src/app/(payload)/admin/brand-setup/page.tsx` | route (admin) | request-response | `apps/web-main/src/app/(payload)/admin/email-setup/page.tsx` | exact |
| `apps/web-main/src/app/(payload)/admin/qa-report/page.tsx` | route (admin) | request-response | `apps/web-main/src/app/(payload)/admin/email-setup/page.tsx` | exact |
| `apps/web-main/src/app/(frontend)/sla/page.tsx` | component (public page) | request-response | `apps/web-main/src/app/(frontend)/privacy/page.tsx` | exact |
| `.github/workflows/pre-launch-gate.yml` | config (CI) | batch | `.github/workflows/main.yml` + `.github/workflows/pr.yml` | role-match |
| `scripts/gsd-headless.mjs` | utility (CLI) | batch | `scripts/seed-runner.ts` + `scripts/compose-smoke.ts` | role-match |
| `.github/workflows/canary-deploy.yml` | config (CI) | event-driven | `.github/workflows/cloudflare-terraform-plan.yml` + `.github/workflows/main.yml` | role-match |
| `apps/web-*/tests/e2e/agency.spec.ts` (12 files) | test | request-response | `packages/ui/__tests__/theme-switch.spec.ts` | role-match |
| `docs/runbooks/incident-response.md` | docs | — | `docs/runbooks/backup-restore.md` + `docs/runbooks/dr-drill.md` | exact |
| `docs/runbooks/db-failover.md` | docs | — | `docs/runbooks/backup-restore.md` | exact |
| `docs/runbooks/redis-flush.md` | docs | — | `docs/runbooks/backup-restore.md` | role-match |
| `docs/runbooks/cloudflare-waf-toggle.md` | docs | — | `docs/runbooks/cloudflare-waf-rollout.md` | exact |
| `docs/runbooks/ccpa-erasure-manual.md` | docs | — | `docs/runbooks/auth-audit-events.md` | role-match |
| `docs/runbooks/ga4-data-deletion.md` | docs | — | `docs/runbooks/clarity-project-setup.md` | role-match |
| `docs/runbooks/payload-backup-restore.md` | docs | — | `docs/runbooks/backup-restore.md` | role-match |
| `docs/runbooks/dns-cutover.md` | docs | — | `docs/runbooks/migrations.md` | role-match |
| `docs/runbooks/secrets-rotation.md` | docs | — | `docs/runbooks/vault-audit.md` | role-match |
| `docs/runbooks/stripe-webhook-redeliver.md` | docs | — | `docs/runbooks/backup-restore.md` | role-match |
| `docs/runbooks/bullmq-queue-drain.md` | docs | — | `docs/runbooks/backup-restore.md` | role-match |
| `docs/runbooks/ssl-certificate-renewal.md` | docs | — | `docs/runbooks/local-dev.md` | role-match |
| `docs/runbooks/brand-setup-wizard.md` | docs | — | `docs/runbooks/clarity-project-setup.md` | exact |

---

## Pattern Assignments

### `packages/cms/src/admin-views/BrandSetupView.tsx` (component, request-response)

**Analog:** `packages/cms/src/admin-views/DashboardView.tsx`

**Imports pattern** (lines 1-11):
```typescript
import 'server-only'
import type * as React from 'react'
import { redirect } from 'next/navigation'
import { requireSession } from '@mjagency/auth'
```

**Auth + super_admin guard pattern** (lines 94-104):
```typescript
export default async function DashboardView(
  props: DashboardViewProps,
): Promise<React.ReactElement> {
  // CLAUDE.md §3 + Pitfall 4.4: requireSession FIRST. Throws via redirect()
  // for unauthenticated requests (handled by Next.js).
  const session = await requireSession()

  // T-11-04-02: only super_admin may view the platform rollup.
  if (isPlatformRequested && session.role !== 'super_admin') {
    redirect('/admin/dashboard')
  }
```

For BrandSetupView, the guard becomes:
```typescript
const session = await requireSession()
if (session.role !== 'super_admin') {
  redirect('/admin')
}
```

**Core RSC shell pattern** (lines 112-133):
```typescript
return (
  <main className="dashboard-page" aria-label="Analytics dashboard">
    <header className="dashboard-page__header">
      <h1 className="dashboard-page__title">
        {isPlatform ? 'Platform overview' : 'Dashboard'}
      </h1>
    </header>
    {/* child client component takes over interactive duties */}
    <DashboardPolling initial={initialMetrics} viewMode={...} />
    <DataSourcesFooter />
  </main>
)
```

BrandSetupView follows this shell: RSC renders the page frame + any server-fetched initial state; a `'use client'` child component (e.g., `BrandSetupWizardClient`) owns step navigation and form state.

**File path convention:** `packages/cms/src/admin-views/BrandSetupView.tsx` — matches `DashboardView.tsx` placement exactly. Referenced from config via `'@mjagency/cms/admin-views/BrandSetupView#default'`.

---

### `packages/cms/src/admin-views/brand-setup-view-config.ts` (config)

**Analog:** `packages/cms/src/admin-views/dashboard-view-config.ts` (lines 1-19 — full file)

```typescript
import type { AdminViewConfig } from 'payload'

export const dashboardView: AdminViewConfig = {
  Component: '@mjagency/cms/admin-views/DashboardView#default',
  path: '/dashboard',
  exact: true,
}
```

Copy verbatim, replacing name, Component path, and path:
```typescript
import type { AdminViewConfig } from 'payload'

export const brandSetupView: AdminViewConfig = {
  Component: '@mjagency/cms/admin-views/BrandSetupView#default',
  path: '/brand-setup',
  exact: true,
}
```

**Registration** — wire into `build-payload-config.ts` alongside `dashboardView` in the `admin.components.views` map (lines 86-89 of `packages/cms/src/config/build-payload-config.ts`):
```typescript
views: {
  Dashboard: dashboardView,
  BrandSetup: brandSetupView,   // ← add
},
```

---

### `packages/cms/src/admin-views/QaReportView.tsx` (component, request-response)

**Analog:** `packages/cms/src/admin-views/DashboardView.tsx`

Same auth + super_admin guard as BrandSetupView (see above). QA report is read-only server data — no client component needed unless live-poll is desired.

**Table rendering pattern:** follows the `dashboard-table` CSS class pattern referenced in `packages/ui/src/dashboard/dashboard.css`. Render a `<table>` with `<th scope="col">` per column, `<th scope="row">` on the agency name cell, and badge pills styled with `var(--mj-color-success)` / `var(--mj-color-error)` / `var(--mj-color-warning)` per QA check state (from UI-SPEC Surface 3).

---

### `packages/cms/src/admin-views/qa-report-view-config.ts` (config)

**Analog:** `packages/cms/src/admin-views/dashboard-view-config.ts` (full file)

```typescript
import type { AdminViewConfig } from 'payload'

export const qaReportView: AdminViewConfig = {
  Component: '@mjagency/cms/admin-views/QaReportView#default',
  path: '/qa-report',
  exact: true,
}
```

Register in `build-payload-config.ts` `admin.components.views` alongside `brandSetupView`.

---

### `apps/web-main/src/app/(payload)/admin/brand-setup/page.tsx` (route, request-response)

**Analog:** `apps/web-main/src/app/(payload)/admin/email-setup/page.tsx` (lines 1-163 — full file)

**Imports + metadata pattern** (lines 1-17):
```typescript
import { requireSession } from '@mjagency/auth'
import type { Metadata } from 'next'
import type React from 'react'

export const metadata: Metadata = {
  title: 'Email DNS Setup — MJ Agency Admin',
}
```

**Auth pattern** (lines 23-25):
```typescript
export default async function EmailSetupPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  await requireSession()
```

For `/admin/brand-setup/page.tsx`, the auth check additionally asserts `super_admin`:
```typescript
const session = await requireSession()
if (session.role !== 'super_admin') redirect('/admin')
```

This route is a thin RSC shell that delegates rendering to `BrandSetupView` from `packages/cms`. The component path `'@mjagency/cms/admin-views/BrandSetupView#default'` is resolved by Payload's importMap — the `page.tsx` route should either import and render `BrandSetupView` directly, or let Payload's `admin.components.views` registration handle routing (same as DashboardView which does NOT have a manual `page.tsx` in `apps/`).

**Decision:** Follow DashboardView — no manual `page.tsx` in `apps/web-main/src/app/(payload)/admin/brand-setup/`. Registration via `brand-setup-view-config.ts` + `build-payload-config.ts` is sufficient. Payload routes the view automatically.

---

### `apps/web-main/src/app/(payload)/admin/qa-report/page.tsx` (route, request-response)

Same pattern as `/admin/brand-setup/page.tsx` above — no manual `page.tsx` needed; view registration handles routing. If a standalone RSC wrapper is needed, copy `email-setup/page.tsx` structure exactly.

---

### `apps/web-main/src/app/(frontend)/sla/page.tsx` (component, request-response)

**Analog:** `apps/web-main/src/app/(frontend)/privacy/page.tsx` (lines 1-137 — full file)

**Style object pattern** (lines 24-65):
```typescript
const pageStyle: React.CSSProperties = {
  maxWidth: 'var(--mj-container-md)',
  margin: '0 auto',
  padding: 'var(--mj-space-16) var(--mj-space-6) var(--mj-space-12)',
  color: 'var(--mj-color-text-primary)',
}
const h1Style: React.CSSProperties = { fontSize: '36px', fontWeight: 700, margin: 0 }
const updatedStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--mj-color-text-secondary)',
  margin: 0,
  marginBottom: 'var(--mj-space-8)',
}
const tocStyle: React.CSSProperties = {
  background: 'var(--mj-color-bg-secondary)',
  borderRadius: 'var(--mj-radius-lg)',
  padding: 'var(--mj-space-6)',
  marginBottom: 'var(--mj-space-12)',
}
const h2Style: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  ...
  scrollMarginTop: 'var(--mj-space-16)',
}
```

All size values match `privacy/page.tsx` exactly — 36px h1, 24px h2, 16px body, 14px secondary. No hex literals anywhere.

**ToC + section structure pattern** (lines 70-134):
```tsx
<main id="main-content" style={pageStyle}>
  <h1 style={h1Style}>Privacy</h1>
  <p style={updatedStyle}>Last updated: {lastUpdated}</p>
  <nav aria-label="On this page" style={tocStyle}>
    <strong>On this page</strong>
    <ol style={listStyle}>
      <li><a href="#section-anchor">Section Name</a></li>
      ...
    </ol>
  </nav>
  <h2 id="section-anchor" style={h2Style}>Section Name</h2>
  <p style={bodyStyle}>...</p>
</main>
```

SLA page copies this structure with anchors: `#uptime`, `#recovery`, `#severity`, `#maintenance`, `#credits`, `#contact`.

**Metadata pattern** (lines 18-22):
```typescript
export const metadata: Metadata = {
  title: `Privacy · ${AGENCY_NAME}`,
  description: `...`,
  robots: { index: true, follow: true },
}
```

SLA page uses `robots: { index: true, follow: true }` (public page, indexable).

---

### `.github/workflows/pre-launch-gate.yml` (CI config, batch)

**Analog:** `.github/workflows/main.yml` (full file, lines 1-59) + `.github/workflows/pr.yml` (lines 1-243)

**Preamble + setup block pattern** (main.yml lines 1-28):
```yaml
name: Main
on:
  push:
    branches: [main]
jobs:
  full-suite:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "pnpm"
      - uses: dopplerhq/cli-action@v3
      - run: pnpm install --frozen-lockfile
```

**REQ gate step pattern** (main.yml lines 21-24):
```yaml
      - name: REQ-501 Payload version pin
        run: pnpm list payload --depth=0 | grep "payload 3.82.1" || (echo "::error::REQ-501: payload must be 3.82.1 exact" && exit 1)
```

**Turbo parallel run pattern** (main.yml line 25):
```yaml
      - run: pnpm turbo run lint typecheck test build size-limit
```

**Matrix strategy pattern** (pr.yml lines 54-71):
```yaml
  lint-typecheck-test:
    needs: install
    runs-on: ubuntu-latest
    strategy:
      matrix:
        task: [lint, typecheck, test]
    steps:
      ...
      - run: pnpm turbo run ${{ matrix.task }}
```

Pre-launch gate uses `workflow_dispatch` + `push: branches: [main]`. It wraps all existing PR checks plus Playwright smoke (5 paths per agency), Lighthouse CI, ZAP passive, axe-core WCAG. Exits 0 = all green.

**ZAP step pattern** (zap-pr-scan.yml lines 83-90):
```yaml
      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.15.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          fail_action: true
          allow_issue_writing: false
          cmd_options: '-a'
```

---

### `scripts/gsd-headless.mjs` (utility / CLI, batch)

**Analog:** `scripts/seed-runner.ts` (full file) + `scripts/compose-smoke.ts` (full file)

**CLI entry pattern with help text** (seed-runner.ts lines 1-85):
```typescript
#!/usr/bin/env tsx
/**
 * scripts/seed-runner.ts
 * ...
 * Usage: pnpm tsx scripts/seed-runner.ts [flags]
 * Exit codes:
 *   0 — all targeted agencies seeded successfully
 *   1 — one or more agencies failed
 */
const HELP = `...`.trim()
```

**Arg parsing pattern** (seed-runner.ts lines 99-130):
```typescript
function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') { result.help = true }
    else if (arg.startsWith('--agency=')) { result.agency = arg.slice('--agency='.length) }
    ...
    else {
      console.error(`seed-runner: unknown flag: ${arg}`)
      process.exit(1)
    }
  }
}
```

**Main with exit codes** (seed-runner.ts lines 199-275):
```typescript
async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  if (args.help) { console.log(HELP); process.exit(0) }
  ...
  process.exit(0)
}
main().catch((err) => {
  console.error('seed-runner: unexpected error:', err)
  process.exit(1)
})
```

**Poll-with-timeout pattern** (compose-smoke.ts lines 96-133):
```typescript
for (let i = 1; i <= MAX_ITERATIONS; i++) {
  await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  ...
  if (allHealthy) { process.exit(0) }
}
console.error(`TIMEOUT: not all containers healthy after ${...}s`)
process.exit(1)
```

`gsd-headless.mjs` is an `.mjs` file (not `.ts`) so it runs as a raw Node ESM script without tsx. Use `import { execSync } from 'node:child_process'` and the same `#!/usr/bin/env node` shebang. Each check step runs a sub-process and captures exit code; if any fails, accumulate failures and exit 1 at the end.

---

### `.github/workflows/canary-deploy.yml` (CI config, event-driven)

**Analog:** `.github/workflows/cloudflare-terraform-plan.yml` (full file) + `.github/workflows/main.yml`

**Artifact upload pattern** (cloudflare-terraform-plan.yml lines 78-88):
```yaml
      - name: Upload plan artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: terraform-plan
          path: infra/cloudflare/tfplan
          if-no-files-found: ignore
          retention-days: 7
```

**Conditional step + exit code handling pattern** (cloudflare-terraform-plan.yml lines 65-76):
```yaml
        run: |
          set +e
          terraform plan -detailed-exitcode -out=tfplan -no-color
          EXIT=$?
          set -e
          if [ "$EXIT" = "1" ]; then
            echo "::error::Terraform plan failed (exit 1)."
            exit 1
          fi
```

**Doppler secrets injection pattern** (main.yml lines 25-28):
```yaml
      - run: pnpm turbo run lint typecheck test build size-limit
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_CI_TOKEN }}
```

**Health check poll pattern** (zap-pr-scan.yml lines 72-81):
```yaml
      - name: Wait for app to listen
        run: |
          for i in $(seq 1 60); do
            if curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
              echo "app is up"
              break
            fi
            sleep 1
          done
```

Canary pipeline structure:
1. `build` job — `pnpm turbo run build`, tag image/deployment.
2. `deploy-canary` job (needs: build) — set Cloudflare/Vercel weight to 5%.
3. `health-check` job (needs: deploy-canary) — 30s poll `GET /api/health` per agency; fail if any non-200.
4. `promote` job (needs: health-check, if: success) — weight to 100%.
5. `rollback` job (needs: health-check, if: failure) — weight back to 0%, exit 1.

Respect `concurrency: group: canary-${{ github.ref }}` to prevent parallel canary runs.

---

### `apps/web-*/tests/e2e/agency.spec.ts` (test, request-response)

**Analog:** `packages/ui/__tests__/theme-switch.spec.ts` (full file, 47 lines)

**Test file header + graceful skip pattern** (lines 1-19):
```typescript
// @ts-check
/**
 * packages/ui/__tests__/theme-switch.spec.ts
 * Playwright e2e — REQ-045: ...
 */
import { test, expect } from '@playwright/test';

test.skip(
  !process.env['PLAYWRIGHT_AVAILABLE'],
  'Playwright chromium not installed — set PLAYWRIGHT_AVAILABLE=1 to run',
);
```

Per-agency suites use the same `test.skip` guard. The env var becomes `E2E_BASE_URL` being set — skip if not set.

**Test body pattern** (lines 21-47):
```typescript
test('theme switch is instant (< 16ms) — REQ-045', async ({ page }) => {
  await page.setContent(`...`)
  const deltaMs = await page.evaluate<number>(() => { ... })
  expect(deltaMs).toBeLessThan(16)
})
```

Per-agency test pattern:
```typescript
test('home page returns 200', async ({ page }) => {
  const baseUrl = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000'
  const response = await page.goto(`${baseUrl}/`)
  expect(response?.status()).toBe(200)
})

test('auth: unauthenticated /admin redirects to /login', async ({ page }) => {
  const baseUrl = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000'
  await page.goto(`${baseUrl}/admin`)
  await expect(page).toHaveURL(/\/login/)
})
```

**Playwright config** (packages/ui/playwright.config.ts — full file):
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '__tests__',
  testMatch: '**/*.spec.ts',
  use: { browserName: 'chromium' },
  fullyParallel: true,
});
```

Per-agency `playwright.config.ts` in `apps/web-*/tests/e2e/` replaces `testDir: '__tests__'` with `testDir: '.'` and adds `baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000'`.

---

### Runbooks (13 files in `docs/runbooks/`) (docs)

**Analog:** `docs/runbooks/backup-restore.md` and `docs/runbooks/clarity-project-setup.md`

**Frontmatter + header pattern** (backup-restore.md lines 1-8):
```markdown
# Backup and Restore Runbook

**Audience:** On-call engineers and operators responsible for ...
**Last updated:** 2026-04-28 (Plan 12-0N)
**Related:** `docs/runbooks/related-runbook.md`, `scripts/related-script.ts`
```

**Overview section pattern** (backup-restore.md lines 9-20):
```markdown
## Overview

Short description of what this runbook covers. ...

**SLA targets (PROJECT.md):** RPO 1h, RTO 4h.
```

**Prerequisites section pattern** (backup-restore.md lines 22-60 / migrations.md lines 1-60):
```markdown
## Prerequisites

### Required role / access
Text describing what you need before starting.
```
```bash
# Verify role exists / tool available
<verification command>
```

**Numbered procedure pattern** (backup-restore.md lines 62-100):
```markdown
## Restore Procedure

### Restore Latest Backup

```bash
# 1. Stop service
# 2. Execute restore
# 3. Start service
```
```

**Failure diagnostics section pattern** (backup-restore.md lines 170-220):
```markdown
## Failure Diagnostics

**Symptom:** <symptom text>.
**Check:** <what to inspect>.
**Fix:** <remediation steps>.
```

**Per-agency env var table pattern** (clarity-project-setup.md lines 68-78):
```markdown
## env var summary (Doppler)

Per-agency (13 sets):

| Var | Scope | Purpose |
|-----|-------|---------|
| `NEXT_PUBLIC_X` | Browser | ... |
| `X_SECRET` | Server | ... |
```

**Verification section pattern** (clarity-project-setup.md lines 79-114):
```markdown
## Verification

After deploy, on each of the 13 public agency hosts:

1. **Check 1:** Steps.
2. **Check 2:** Steps.
```

All 13 new runbooks copy these sections in order: Overview → Prerequisites → Procedure → Verification → Failure Diagnostics. The `clarity-project-setup.md` structure (step-numbered procedure + per-agency env table) is the primary template for operational runbooks. The `backup-restore.md` structure (deeper sections + symptom/fix diagnostics) is the template for incident runbooks.

---

## Shared Patterns

### Authentication Guard (all admin views)

**Source:** `packages/auth/src/require-session.ts` (full file, 95 lines) + `packages/cms/src/admin-views/DashboardView.tsx` (lines 94-104)

**Apply to:** `BrandSetupView.tsx`, `QaReportView.tsx`, and any `apps/web-main/src/app/(payload)/admin/*/page.tsx`

```typescript
import 'server-only'
import { requireSession } from '@mjagency/auth'
import { redirect } from 'next/navigation'

// FIRST call in every admin RSC — CLAUDE.md §3 + Pitfall 4.4
const session = await requireSession()
if (session.role !== 'super_admin') {
  redirect('/admin')
}
```

`requireSession()` throws via `redirect()` for unauthenticated requests — never wrap in try/catch.

### CSS Token Discipline (all UI surfaces)

**Source:** `apps/web-main/src/app/(frontend)/privacy/page.tsx` (lines 24-65)

**Apply to:** `sla/page.tsx`, `BrandSetupView.tsx`, `QaReportView.tsx`

- Zero hex literals. All color/size references use `var(--mj-*)` tokens.
- Admin views (brand-setup, qa-report) must use CSS classes with external stylesheets — NOT inline `style` attributes — because the per-request CSP nonce blocks inline styles in admin routes (Pitfall 4.5 from UI-SPEC).
- Exception: `sla/page.tsx` (public RSC, outside nonce scope) may use React `style={{ ... }}` with `var(--mj-*)` values, following `privacy/page.tsx` exactly.

### GitHub Actions Setup Block (all CI workflows)

**Source:** `.github/workflows/main.yml` (lines 10-27) + `.github/workflows/pr.yml` (lines 38-46)

**Apply to:** `pre-launch-gate.yml`, `canary-deploy.yml`

```yaml
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "pnpm"
      - uses: dopplerhq/cli-action@v3
      - run: pnpm install --frozen-lockfile
```

Always inject `DOPPLER_TOKEN: ${{ secrets.DOPPLER_CI_TOKEN }}` on steps that need env vars.

### Payload Admin View Registration (all new admin views)

**Source:** `packages/cms/src/config/build-payload-config.ts` (lines 84-89) + `packages/cms/src/admin-views/dashboard-view-config.ts` (full file)

**Apply to:** `brand-setup-view-config.ts`, `qa-report-view-config.ts`

```typescript
// In packages/cms/src/config/build-payload-config.ts
components: {
  views: {
    Dashboard: dashboardView,
    BrandSetup: brandSetupView,   // ← Phase 12 addition
    QaReport:   qaReportView,     // ← Phase 12 addition
  },
},
```

Also export new view configs from `packages/cms/src/index.ts` following the `dashboardView` export at line 78:
```typescript
export { brandSetupView } from './admin-views/brand-setup-view-config.js'
export { qaReportView }   from './admin-views/qa-report-view-config.js'
```

### Script Exit Code Contract (CLI scripts)

**Source:** `scripts/seed-runner.ts` (lines 199-275) + `scripts/compose-smoke.ts` (lines 96-144)

**Apply to:** `scripts/gsd-headless.mjs`

- Exit 0 = all checks passed.
- Exit 1 = one or more checks failed.
- Never `throw` unhandled — always `.catch((err) => { console.error(...); process.exit(1) })`.
- Print `[script-name] ERROR: <message>` format for failures (matches compose-smoke pattern).
- Use `::error::` prefix for GitHub Actions annotation compatibility.

### Runbook Structure Contract (all 13 new runbooks)

**Source:** `docs/runbooks/backup-restore.md` + `docs/runbooks/clarity-project-setup.md`

**Apply to:** all 13 new `docs/runbooks/*.md` files

Mandatory section order:
1. `# <Title> Runbook` — h1 title
2. `**Audience:**`, `**Last updated:**`, `**Related:**` — header metadata
3. `## Overview` — what this runbook does, SLA/REQ references
4. `## Prerequisites` — required roles, tools, secrets
5. `## Procedure` (or named equivalent, e.g., `## Restore Procedure`) — numbered steps with bash code blocks
6. `## Verification` — how to confirm success
7. `## Failure Diagnostics` — Symptom / Check / Fix triads

---

## No Analog Found

All Phase 12 files have close analogs in the codebase. No files require fallback to RESEARCH.md patterns.

---

## Metadata

**Analog search scope:** `packages/cms/src/`, `apps/web-main/src/`, `.github/workflows/`, `docs/runbooks/`, `scripts/`, `packages/auth/src/`, `packages/ui/__tests__/`
**Files scanned:** 28
**Pattern extraction date:** 2026-04-28
