---
phase: 1
plan: Doppler Foundation
status: partial
tasks_total: 7
tasks_automated: 2
tasks_human_pending: 5
completed: 2026-05-10
---

# Phase 1: Doppler Foundation — Execution Summary

## What Was Built

### Task 5 — GitHub Actions wired to Doppler ✅

Updated 3 workflow files to authenticate properly via the Doppler CLI action and inject secrets via `doppler run --` at build time. Previously, `DOPPLER_TOKEN` was set as a bare environment variable which does NOT inject secrets into subprocesses — `doppler run --` is required.

**Files changed:**
- `.github/workflows/canary-deploy.yml` — `build` job: added `with: token/project/config`, changed `pnpm turbo run build` → `doppler run -- pnpm turbo run build`
- `.github/workflows/pr.yml` — `build`, `dev-smoke`, `next-data-secret-audit` jobs: same pattern with `config: dev`
- `.github/workflows/main.yml` — `full-suite` job: same pattern with `config: prod`

**Pattern applied:**
```yaml
- uses: dopplerhq/cli-action@v3
  with:
    token: ${{ secrets.DOPPLER_CI_TOKEN }}
    project: mjagency
    config: prod  # or dev for PR/dev workflows
- run: doppler run -- pnpm turbo run build
```

### Task 6 — doppler.yaml + setup docs ✅

- `doppler.yaml` — Project-level Doppler config at repo root (defines dev/staging/prod environments, used by `doppler setup`)
- `docs/setup/doppler-setup.md` — Developer onboarding guide (login, setup, `doppler run -- pnpm dev`, troubleshooting)
- `docs/runbooks/secrets-rotation.md` — Already existed (comprehensive, written in Phase 12-05). Not overwritten.

## Pending Human Tasks

The following tasks require access to external dashboards and cannot be automated:

### Task 1: Create Doppler project + configs (30 min) ⏳ HUMAN REQUIRED
1. Log into [Doppler dashboard](https://dashboard.doppler.com)
2. Create project: `mjagency`
3. Create 3 configs: `dev`, `staging`, `prod`
4. Set initial env vars: `ENVIRONMENT`, `NODE_ENV`, `DOPPLER_ENVIRONMENT` in each config

### Task 2: Populate global secrets (1 hour) ⏳ HUMAN REQUIRED
Copy 50+ global secrets from `.env.example` into Doppler dev/staging/prod configs (PostgreSQL, Redis, Cloudflare, Stripe, SMTP, JWT, Vault, etc.)

### Task 3: Populate per-agency secrets (1.5 hours) ⏳ HUMAN REQUIRED
For each of the 26 agencies: create `<AGENCY>_DB_PASSWORD`, `<AGENCY>_PAYLOAD_SECRET`, `<AGENCY>_PAYLOAD_API_KEY`, GA4 keys, Meta CAPI tokens

```bash
# Generate values for each agency:
openssl rand -hex 32  # DB password
openssl rand -hex 32  # PAYLOAD_SECRET
openssl rand -hex 32  # PAYLOAD_API_KEY
```

### Task 4: Generate DOPPLER_CI_TOKEN → GitHub Secrets (15 min) ⏳ HUMAN REQUIRED
1. Doppler dashboard → Settings → Access Control → API Tokens → Create `github-actions-ci` (read-only, all configs)
2. GitHub repo → Settings → Secrets and variables → Repository secrets → `DOPPLER_CI_TOKEN` = paste token

### Task 7: Local development validation (30 min) ⏳ HUMAN REQUIRED (after Tasks 1–4)
```bash
doppler login
doppler setup  # Select mjagency/dev
doppler run -- pnpm dev
```
Verify: localhost:3000 loads, Payload admin accessible, no undefined secrets.

## Design Note — Doppler Project Structure

**Discrepancy found:** The PLAN.md describes a single `mjagency` project with 3 configs (dev/staging/prod). However, `docs/runbooks/secrets-rotation.md` (written in Phase 12-05) and `PROJECT.md` both describe a **per-agency project model**: `mjagency-shared` (global) + `mjagency-{slug}` (per agency).

**Recommendation:** Use the existing design (`mjagency-shared` + per-agency projects) — it was planned in Phase 12 and supports per-agency secret rotation independently. The PLAN.md's simplified single-project approach can be used for the initial dev/staging setup, but production will need the per-agency split.

Resolve this before Task 1 (project creation).

## Key Files

| File | Status |
|------|--------|
| `.github/workflows/canary-deploy.yml` | ✅ Updated |
| `.github/workflows/pr.yml` | ✅ Updated |
| `.github/workflows/main.yml` | ✅ Updated |
| `doppler.yaml` | ✅ Created |
| `docs/setup/doppler-setup.md` | ✅ Created |
| `docs/runbooks/secrets-rotation.md` | ✅ Exists (comprehensive, no change) |

## Self-Check: PASSED

Automated tasks (5, 6) are complete and committed. Human tasks (1–4, 7) are documented with precise steps above. The GitHub Actions changes are backward-compatible — they will continue to fail gracefully if `DOPPLER_CI_TOKEN` is not yet in GitHub Secrets (same behavior as before, since the secret was already required).
