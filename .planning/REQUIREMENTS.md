# v9.2.0: Deferred Items Completion

**Status:** Draft  
**Locked:** No (pending review)

---

## Overview

v9.2.0 consolidates three deferred infrastructure items from v9.1.20:
1. **Doppler workspace bootstrap** — secrets management + CI/CD integration
2. **5 phantom-shell apps scaffolding** — complete Next.js+Payload boilerplate for orphaned directories
3. **Payload migrations framework** — runtime migration execution for per-agency databases

All three are foundational for deployment readiness and unblocking the full 26-agency platform.

---

## Requirements Summary

### R-1: Doppler Workspace Bootstrap

**What:** Complete Doppler workspace setup (dev/staging/prod projects) + local development integration.

**Current state:** 
- Doppler CLI action installed in `canary-deploy.yml` (line 46)
- DOPPLER_CI_TOKEN not yet added to GitHub secrets
- No local `doppler.yaml` or setup scripts
- `.env.example` already documents "replace-via-doppler" pattern

**What must be done:**
- [ ] Create Doppler account/organization (if not exists)
- [ ] Create three projects: dev, staging, prod
- [ ] Populate all secrets from `.env.example` into Doppler
- [ ] Generate DOPPLER_CI_TOKEN and add to GitHub repository secrets
- [ ] Create `doppler.yaml` at root with environment mappings
- [ ] Add `doppler run` setup docs + local development scripts
- [ ] Update canary-deploy.yml to fetch secrets from Doppler
- [ ] Verify GitHub Actions build uses Doppler secrets (no fallback to GitHub Secrets)

**Success criteria:**
- `doppler run -- pnpm dev` works locally without .env file
- GitHub Actions canary deploy pulls all secrets from Doppler
- No hardcoded secrets in git history or Environment Variables UI

**Owner:** TBD  
**Estimate:** 1-2 days  
**Depends on:** None (foundational)

---

### R-2: Phantom-Shell Apps Scaffolding

**What:** Convert 5 orphaned app directories into fully functional Next.js+Payload agencies.

**Current state:**
- 5 phantom apps exist: `web-automotive`, `web-brand`, `web-education`, `web-healthcare`, `web-petcare`
- Each contains only `src/app/` and `src/components/` (empty)
- Missing: `package.json`, `tsconfig.json`, `next.config.js`, Payload config, tests, etc.

**What must be done:**
- [ ] Create boilerplate generator script (`scripts/scaffold-agency.sh` or `.ts`)
- [ ] Generator should copy + customize from `apps/web-main` template
- [ ] Scaffold all 5 apps with correct package names and agency IDs
- [ ] Update root `package.json` workspace definition to include 5 new apps
- [ ] Generate per-agency database connection strings
- [ ] Wire each app to its per-agency Postgres database
- [ ] Generate Payload configs per agency (distinct `PAYLOAD_SECRET` per app)
- [ ] Add all 5 apps to `pnpm turbo` build graph
- [ ] Validate all 5 build successfully: `pnpm turbo run build`
- [ ] Add all 5 to CI/CD pipeline (PR tests, canary deploy)

**Success criteria:**
- All 5 apps build without errors
- Each app has unique agency_id (automotive, brand, education, healthcare, petcare)
- Each app connects to a distinct Postgres database
- `pnpm turbo run test` passes for all 5
- All 5 appear in canary-deploy.yml matrix

**Owner:** TBD  
**Estimate:** 2-3 days  
**Depends on:** R-1 (Doppler secrets needed for DATABASE_URL)

---

### R-3: Payload Migrations Framework

**What:** Build a runtime migration runner for per-agency database schema changes.

**Current state:**
- Payload CMS 3.82.1 has built-in migrations (stored in `payload.db.migrations` table)
- `.env.example` shows single DATABASE_URL pointing to mjagency_main
- No explicit migration files visible in repo
- No migration CLI tool exists

**What must be done:**
- [ ] Design per-agency migration strategy (1 migration per agency vs shared migrations)
- [ ] Create migration CLI: `pnpm db:migrate [agency-id] [--rollback]`
- [ ] Build migration runner that:
  - Connects to per-agency database (read from Doppler)
  - Executes pending migrations
  - Logs success/failure with timestamps
  - Supports rollback with pre-execution backup
- [ ] Add pre-deployment hook in canary-deploy.yml to run migrations
- [ ] Document rollback procedure (docs/runbooks/migration-rollback.md)
- [ ] Add dry-run mode: `pnpm db:migrate [agency-id] --dry-run`
- [ ] Create database backup script (backup before migration)
- [ ] Test with staging database (full schema + data)
- [ ] Add to deployment checklist

**Success criteria:**
- Migration CLI executes without errors on staging
- Rollback restores pre-migration state
- Dry-run shows planned changes without executing
- All 26 agencies can run migrations independently
- Deployment pipeline includes pre-flight migration check

**Owner:** TBD  
**Estimate:** 1-2 days  
**Depends on:** R-1 (Doppler secrets for per-agency DB access) + R-2 (all apps available)

---

## Phase Breakdown

Based on dependencies, execution order is:

1. **Phase 1: Doppler Foundation** (R-1)
2. **Phase 2: Phantom-Shell Scaffolding** (R-2)
3. **Phase 3: Payload Migrations** (R-3)

Phases 2 and 3 can overlap once Phase 1 is complete.

---

## Cross-References

- **v9.1.20 deferred items:** This milestone completes all three
- **Deployment readiness:** Required before VPS deployment (v9.3.0)
- **Memory note:** 5 phantom apps, not 11; actual count verified via codebase scan

---

## Notes

- Doppler secrets rotation will be documented in `docs/runbooks/secrets-rotation.md`
- Per-agency database isolation is enforced at Postgres level (separate databases + RLS)
- Payload 3.82.1 is LOCKED per CLAUDE.md §1 — no version changes
