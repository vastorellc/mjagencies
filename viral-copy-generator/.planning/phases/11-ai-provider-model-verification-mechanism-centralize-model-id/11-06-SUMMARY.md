---
phase: 11
plan: 6
subsystem: frontend-ui
tags: [settings-ui, admin-ui, providers-tab, model-dropdown, capability-badges, model_not_found-banner, render-tests]
requires:
  - 11-02 (MODELS_BY_PROVIDER, defaultModelFor)
  - 11-03 (validate-key returns ValidateKeyResponse with error_kind + capabilities)
  - 11-05 (GET /api/admin/provider-health endpoint)
provides:
  - AdminProviderHealth type in types.ts
  - ValidateKeyResponse type in types.ts
  - fetchAdminProviderHealth() in api.ts
  - SettingsPage model dropdown + capability chips + discriminated banners
  - AdminPage 6th Providers tab with manual Refresh
affects:
  - frontend/src/lib/types.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/models.ts
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/AdminPage.tsx
tech-stack:
  added: []
  patterns:
    - discriminated-banner-by-error_kind
    - tab-scoped-data-loading-pattern
    - capability-chip-true-values-only
key-files:
  created:
    - frontend/src/pages/AdminPage.providerHealth.test.tsx
  modified:
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/models.ts
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/pages/AdminPage.tsx
decisions:
  - ModelCapabilities defined in types.ts (not models.ts) to break circular import; models.ts re-exports it from types.ts
  - selectedModelId state initialized to '' and resolved via defaultModelFor() fallback to avoid dependency on async data load timing
  - font-semibold removed from old validation banner (2-weight rule enforced); replaced with font-bold
metrics:
  duration: 6m
  completed_at: "2026-05-16T04:53:00Z"
  tasks_completed: 3
  tasks_total: 4
  files_modified: 6
---

# Phase 11 Plan 6: Frontend UI Surface for AI Provider Verification Summary

**One-liner:** Settings model dropdown + capability chips + discriminated model_not_found banner; Admin 6-tab panel with Providers health view using manual Refresh and status badges.

**Status:** PARTIAL — Tasks 1-3 complete and committed; Task 4 (human-verify checkpoint) PENDING.

## What Was Built

### Task 1: types.ts + api.ts (commit 062a972)

Added to `frontend/src/lib/types.ts`:
- `ModelCapabilities` interface — mirrors models.ts definition (moved here to break circular import)
- `AdminProviderHealth` interface — full shape of provider health row (provider, model_id, displayName, tier, capabilities, pricePerMInput/Output, retiresAt, latestStatus, latestErrorMessage, latestCheckedAt, latencyP95Last7dMs)
- `ValidateKeyErrorKind` union type — 5 discriminants (invalid_key, model_not_found, rate_limited, service_unavailable, network_error)
- `ValidateKeyResponse` interface — extends old `{ valid, error? }` with key_valid, model_valid, error_kind, capabilities, model_id

Updated `frontend/src/lib/models.ts`:
- Removed duplicate `ModelCapabilities` interface definition
- Now imports and re-exports `ModelCapabilities` from `./types` (avoids circular dependency)

Added to `frontend/src/lib/api.ts`:
- `fetchAdminProviderHealth(): Promise<AdminProviderHealth[]>` — GET /api/admin/provider-health, returns json.models array

### Task 2: SettingsPage model dropdown + banners (commit 6d1c8c2)

`frontend/src/pages/SettingsPage.tsx`:
- Imports `MODELS_BY_PROVIDER`, `defaultModelFor` from models.ts
- Imports `ValidateKeyResponse` from types.ts
- New state: `selectedModelId` — initialized to '' (resolves via `defaultModelFor` fallback)
- `useEffect` on `data?.ai_provider` — resets `selectedModelId` when provider changes
- Provider dropdown `onChange` — additionally calls `setSelectedModelId(defaultModelFor(newProvider))` immediately
- New model `<select>` dropdown — renders `MODELS_BY_PROVIDER[provider]` entries with `{displayName} ({tier})` labels
- `validateApiKey()` POST body — includes `model_id: selectedModelId || defaultModelFor(provider)`
- Result type changed from `{ valid, error? }` to `ValidateKeyResponse`
- Discriminated banners:
  - `error_kind === 'model_not_found'`: "Selected model unavailable. Pick a different model below."
  - `error_kind === 'invalid_key'`: "API key rejected. Re-check the key."
  - Other error kinds: generic error message with `error_message ?? error ?? 'Unknown error'`
  - `valid: true`: emerald banner with "Key + model verified." + capability chips for true-valued caps only (Text / Vision / Audio / Video)

### Task 3: AdminPage Providers tab + render tests (commit 8387c45)

`frontend/src/pages/AdminPage.tsx`:
- `AdminTab` union extended with `'providers'`
- `TABS` array gains `{ id: 'providers', label: 'Providers' }` as 6th entry
- `PROVIDER_STATUS_STYLES` Record: ok=emerald, model_not_found/invalid_key/error=red, rate_limited/service_unavailable=amber, not_configured/unknown=zinc
- State: `providerHealth[]`, `providerHealthLoading`, `providerHealthError`
- `loadProviderHealth` useCallback — follows exact queue-tab 3-state pattern
- `useEffect` on `activeTab === 'providers'` — loads on tab activation only (no auto-poll)
- Providers render block: cards with `data-testid="provider-row-{model_id}"`, status badge with `data-testid="status-{model_id}"`, capability chips (true caps only), p95 latency, last-checked, price, optional retire warning, optional error message, Refresh button

`frontend/src/pages/AdminPage.providerHealth.test.tsx` (new file):
- 7 tests, all GREEN:
  1. Clicking Providers tab triggers fetch + renders rows
  2. model_not_found row shows red-styled status badge
  3. OK status row shows emerald-styled badge
  4. Capability chips render only for true-valued capabilities
  5. Refresh button triggers re-fetch
  6. Error banner shown when fetch fails
  7. data-testid attributes present on card and badge

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` clean | PASS |
| `grep AdminProviderHealth types.ts` >= 1 | PASS (2) |
| `grep fetchAdminProviderHealth api.ts` >= 1 | PASS (1) |
| `grep ValidateKeyResponse types.ts` >= 1 | PASS (1) |
| `grep MODELS_BY_PROVIDER SettingsPage.tsx` >= 1 | PASS (2) |
| `grep selectedModelId SettingsPage.tsx` >= 4 | PASS (5) |
| `grep error_kind === 'model_not_found' SettingsPage.tsx` >= 1 | PASS (1) |
| `grep dangerouslySetInnerHTML SettingsPage.tsx` == 0 | PASS (0) |
| `grep font-semibold SettingsPage.tsx` == 0 | PASS (0) |
| `grep PROVIDER_STATUS_STYLES AdminPage.tsx` >= 1 | PASS (2) |
| `grep fetchAdminProviderHealth AdminPage.tsx` >= 1 | PASS (2) |
| `grep dangerouslySetInnerHTML AdminPage.tsx` == 0 | PASS (0) |
| Render tests: 7 tests GREEN | PASS |
| `npm run build` succeeds | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Circular Import] Moved ModelCapabilities to types.ts**
- **Found during:** Task 1 — plan specified importing ModelCapabilities from models.ts into types.ts, but models.ts already imports AIProvider from types.ts
- **Issue:** Circular import: types.ts → models.ts → types.ts
- **Fix:** Defined `ModelCapabilities` in `types.ts` (the canonical types file), updated `models.ts` to import and re-export `ModelCapabilities` from `types.ts` — eliminates duplication and the circular dependency
- **Files modified:** `frontend/src/lib/types.ts`, `frontend/src/lib/models.ts`
- **Commit:** 062a972

**2. [Rule 2 - Missing Fallback] selectedModelId empty-string initialization**
- **Found during:** Task 2 — `defaultModelFor(data.ai_provider)` requires `data` to be non-null; can't call at useState initializer before data loads
- **Fix:** Initialize `selectedModelId` as `''`, then resolve via `selectedModelId || defaultModelFor(data.ai_provider)` at all use sites; useEffect sets it once data loads. No UX impact — model dropdown value resolves correctly on first render with data.
- **Files modified:** `frontend/src/pages/SettingsPage.tsx`
- **Commit:** 6d1c8c2

## Known Stubs

None. All data is wired to real API calls.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| None | — | No new network endpoints or auth paths introduced; AdminPage Providers tab reads admin-gated endpoint (existing adminMiddleware). SettingsPage model dropdown is client-side only (T-11-19 — backend whitelist enforces). |

## Pending

**Task 4 (CHECKPOINT:human-verify):** End-to-end smoke testing pending human execution. See checkpoint message below.

## Self-Check

All task commits verified:
- 062a972 — Task 1 types + api.ts
- 6d1c8c2 — Task 2 SettingsPage
- 8387c45 — Task 3 AdminPage + render tests

## Self-Check: PASSED
