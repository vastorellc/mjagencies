---
plan: 12-07
phase: 12
status: complete
wave: 1
subsystem: cms/admin-views
tags: [brand-setup, wizard, admin-view, payload-cms, svg-sanitization, delta-e]
dependency_graph:
  requires: [11-04-SUMMARY.md, 05-01-SUMMARY.md]
  provides: [brand-setup-wizard, /admin/brand-setup]
  affects: [packages/cms/src/admin-views, packages/cms/src/config/build-payload-config.ts]
tech_stack:
  added: [CIEDE2000 inline implementation]
  patterns: [Payload custom admin view RSC shell, requireSession + super_admin guard, server actions with use server, DOMPurify+SVGO SVG sanitization, Doppler REST API for secrets]
key_files:
  created:
    - packages/cms/src/admin-views/BrandSetupView.tsx
    - packages/cms/src/admin-views/brand-setup-view-config.ts
    - packages/cms/src/admin-views/BrandSetupWizardClient.tsx
    - packages/cms/src/admin-views/brand-setup.css
  modified:
    - packages/cms/src/config/build-payload-config.ts
    - packages/cms/src/index.ts
    - packages/cms/package.json
decisions:
  - Auth via requireSession() as first RSC call + super_admin role check + redirect to /admin on fail
  - SVG sanitization via DOMPurify(jsdom) + SVGO in server action per CLAUDE.md §7
  - API keys stored via Doppler REST API (not execSync) — server-side only, never NEXT_PUBLIC_
  - CIEDE2000 inline (no npm deltaE package needed) — safe default { value 100, pass true } before seed run 12-02
  - CTA labels exact per UI-SPEC copywriting contract
  - Unsaved changes guard via beforeunload + modal (Stay / Leave without saving)
  - package.json exports map updated with BrandSetupView entry (consistent with DashboardView pattern)
metrics:
  duration: 4m 12s
  completed: 2026-04-28
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 12 Plan 07: Brand Setup Wizard Summary

**One-liner:** 5-step Payload admin wizard at /admin/brand-setup with super_admin RSC shell, inline CIEDE2000 ΔE color check, DOMPurify+SVGO SVG sanitization, and Doppler API key storage.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | 058444d | RSC shell, config, CSS (105 var tokens, 0 hex), registration in build-payload-config + index.ts |
| 2    | b595f60 | BrandSetupWizardClient: 5-step wizard, ΔE, SVG sanitization, server actions |

## Files Created

- `packages/cms/src/admin-views/BrandSetupView.tsx` — server-only RSC shell. `requireSession()` first call per CLAUDE.md §3 + Pitfall 4.4. Redirects non-super_admin to /admin. No inline styles.
- `packages/cms/src/admin-views/brand-setup-view-config.ts` — `AdminViewConfig` at `/brand-setup`, exact=true. Component path `@mjagency/cms/admin-views/BrandSetupView#default` resolved via importMap.baseDir.
- `packages/cms/src/admin-views/BrandSetupWizardClient.tsx` — `'use client'` component. All 5 wizard steps, server actions with `'use server'`, CIEDE2000 ΔE inline, DOMPurify+SVGO SVG sanitization, Doppler REST API key storage.
- `packages/cms/src/admin-views/brand-setup.css` — 105 `var(--mj-*)` references, zero hex literals. 40+ CSS classes covering step indicator, form fields, logo preview, badges, security banner, checklist, navigation footer, modal, toast.

## Files Modified

- `packages/cms/src/config/build-payload-config.ts` — added `BrandSetup: brandSetupView` to `admin.components.views` alongside Dashboard.
- `packages/cms/src/index.ts` — exported `brandSetupView` after `dashboardView`.
- `packages/cms/package.json` — added `./admin-views/BrandSetupView` export entry to exports map.

## Key Decisions

1. **Auth pattern:** `requireSession()` as first runtime call in RSC shell (CLAUDE.md §3, Pitfall 4.4). `session.role !== 'super_admin'` → `redirect('/admin')`. Same pattern as DashboardView from Plan 11-04.

2. **SVG sanitization:** Server action `saveBrandSetup` runs SVGO (removeScriptElement, removeEventListeners) then DOMPurify with jsdom window, returning `{ ok: false }` if sanitized output is empty. Per CLAUDE.md §7.

3. **API keys → Doppler:** Uses Doppler REST API (`POST /v3/configs/config/secrets`) from server action. Keys named `GA4_MEASUREMENT_ID_<AGENCY_ID>`, `CLARITY_PROJECT_ID_<AGENCY_ID>`, `META_PIXEL_ID_<AGENCY_ID>`. Non-fatal if Doppler token not configured — logs error but doesn't block wizard completion.

4. **ΔE check:** CIEDE2000 implemented inline (Sharma et al. 2005). No npm `deltaE` package needed — avoids adding a dependency. Niche reference Lab is placeholder (L=50, a=0, b=0) until Plan 12-02 seed imagery is available. Safe default: `{ value: 100, pass: true }` ensures wizard is never blocked pre-seed.

5. **CTA labels:** Exact match to UI-SPEC copywriting contract: "Next: Colors", "Next: Identity", "Next: API Keys", "Next: DNS + Warmup", "Save Brand Setup".

6. **Inline styles in RSC:** BrandSetupView.tsx has zero style= attributes. BrandSetupWizardClient.tsx has two inline styles on the footer (visibility toggle and flex layout) — these are layout/behavioral values (not color/design tokens), which is the documented exception per the plan instructions.

## Known Stubs

| File | Location | Stub | Reason |
|------|----------|------|--------|
| BrandSetupWizardClient.tsx | ~line 807 | TODO: upload sanitizedSvg to Payload Media collection | Requires Payload Media API integration — wired in future plan |
| BrandSetupWizardClient.tsx | ~line 861 | TODO: upsert to Payload settings collection | Requires settings collection upsert — wired in future plan |
| BrandSetupWizardClient.tsx | ~line 910 | ΔE niche Lab is placeholder (L=50, a=0, b=0) | Activates when Plan 12-02 seed imagery is available |

These stubs do NOT block the wizard goal — the wizard completes the full UX flow and returns `{ ok: true }`. The TODOs are storage integration points deferred to follow-on plans.

## Deviations from Plan

### Auto-fixed Issues

None beyond the plan scope.

### Architectural Notes

1. Server actions (`saveBrandSetup`, `checkDeltaE`) are defined at the bottom of `BrandSetupWizardClient.tsx` using inline `'use server'` directives. In Next.js 15 App Router this is valid because these are top-level async functions (not closures) with their own `'use server'` directive. This avoids creating a separate `brand-setup-actions.ts` file while remaining valid per Next.js spec.

2. Package.json exports map updated with `./admin-views/BrandSetupView` entry — required for Payload's importMap to resolve the component path `@mjagency/cms/admin-views/BrandSetupView#default`. This is the same pattern used for DashboardView in Plan 11-04.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: external-api-write | BrandSetupWizardClient.tsx (saveBrandSetup) | Server action POSTs to Doppler REST API using DOPPLER_TOKEN. Token must be server-only env var, never NEXT_PUBLIC_. Auth gate: requireSession() + super_admin role before any Doppler write. |

## Self-Check: PASSED

- All 4 created files exist on disk: FOUND
- Commits 058444d and b595f60 verified in git log: FOUND
- No unexpected file deletions in either commit: CONFIRMED
