# v9.2.0 Roadmap: Deferred Items Completion

**Milestone:** v9.2.0  
**Goal:** Complete infrastructure foundation (Doppler, phantom apps, migrations) for deployment readiness  
**Phases:** 3  
**Est. Duration:** 5-7 days  
**Status:** Ready for planning

---

## Phase Structure

### Phase 1: Doppler Foundation
**Goal:** Complete secrets management infrastructure (dev/staging/prod workspaces)

**Tasks:**
- Create Doppler workspace + three environment projects
- Migrate all secrets from `.env.example` into Doppler
- Generate DOPPLER_CI_TOKEN and register in GitHub repository
- Write `doppler.yaml` + setup documentation
- Update `canary-deploy.yml` to consume Doppler secrets
- Validate GitHub Actions CI/CD pulls from Doppler (not GitHub Secrets fallback)

**Success Criteria:**
- `doppler run -- pnpm dev` works locally
- `pnpm turbo run build` succeeds with Doppler secrets in CI/CD
- No hardcoded secrets in git

**Estimate:** 1-2 days  
**Owner:** TBD

---

### Phase 2: Phantom-Shell Scaffolding
**Goal:** Convert 5 orphaned app directories into complete Next.js+Payload agencies

**Tasks:**
- Create agency scaffolding script (template + customization logic)
- Generate boilerplate for 5 apps:
  - web-automotive
  - web-brand
  - web-education
  - web-healthcare
  - web-petcare
- Wire each to per-agency Postgres database
- Generate unique Payload secrets + app configs
- Update root `package.json` workspace definitions
- Add to pnpm/Turbo build graph
- Update CI/CD matrix for all 5 apps
- Validate all 5 build + test successfully

**Success Criteria:**
- All 5 apps build without errors
- Each app has correct agency_id, DATABASE_URL, PAYLOAD_SECRET
- `pnpm turbo run test` passes for all 5
- GitHub Actions tests all 5 in parallel

**Estimate:** 2-3 days  
**Owner:** TBD  
**Depends on:** Phase 1 (Doppler secrets)

---

### Phase 3: Payload Migrations Framework
**Goal:** Build runtime migration runner for per-agency database schema changes

**Tasks:**
- Design per-agency migration strategy (decisions on shared vs per-agency migrations)
- Create migration CLI tool: `pnpm db:migrate [agency-id] [--rollback] [--dry-run]`
- Build migration runner with:
  - Per-agency database connection from Doppler
  - Automatic backup before migration
  - Transaction rollback on error
  - Idempotency checks (skip if already applied)
- Document rollback procedure
- Add pre-deployment hook to canary-deploy.yml
- Test dry-run on staging (all agencies)
- Test rollback with synthetic schema change

**Success Criteria:**
- `pnpm db:migrate [agency-id]` executes without errors
- `pnpm db:migrate [agency-id] --dry-run` shows planned changes
- `pnpm db:migrate [agency-id] --rollback` restores pre-migration state
- All 26 agencies can run migrations independently
- Deployment pipeline includes migration pre-check

**Estimate:** 1-2 days  
**Owner:** TBD  
**Depends on:** Phase 1 (Doppler) + Phase 2 (all apps exist)

---

## Dependency Graph

```
Phase 1 (Doppler)
    ↓
    ├─→ Phase 2 (Phantom Apps)  [can start after Phase 1]
    │       ↓
    │   Phase 3 (Migrations)    [can start after Phase 2]
    │       ↓
    └─→ v9.2.0 Complete
```

**Parallel windows:**
- Phase 2 and Phase 3 can overlap once Phase 1 is complete
- Phase 3 can be scoped early if migration design is settled

---

## Exit Criteria (Milestone Complete)

- [ ] Doppler workspace created + all secrets migrated
- [ ] GitHub Actions uses Doppler (verified in canary-deploy logs)
- [ ] All 5 phantom apps build + test successfully
- [ ] Each phantom app connects to its per-agency database
- [ ] Migration CLI tool exists and runs without errors
- [ ] Migration dry-run tested on all 26 agencies
- [ ] Deployment pipeline includes pre-flight migration check
- [ ] All 3 requirements marked locked

---

## Known Deviations from Initial Deferred List

- **App count:** Originally noted "11 phantom-shell apps" but actual count is **5** (verified via codebase scan)
  - These 5 are complete orphans (no package.json)
  - Other 21 apps are fully functional
- **Migration scope:** No explicit migration files yet; design needed during Phase 3
- **Doppler status:** Already partially integrated in CI/CD; just needs credentials + workspace setup

---

## Notes for Planning

1. **Doppler secrets rotation:** Document in `docs/runbooks/secrets-rotation.md` during Phase 1
2. **Payload version lock:** CLAUDE.md §1 requires Payload 3.82.1 — do not upgrade
3. **Per-agency isolation:** Postgres enforces via separate databases + agency_id filtering
4. **Database schema:** Design per-agency migrations vs. shared migrations during Phase 3 planning
