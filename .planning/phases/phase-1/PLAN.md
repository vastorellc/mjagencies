# Phase 1: Doppler Foundation — Execution Plan

**Milestone:** v9.2.0  
**Phase:** 1 of 3  
**Goal:** Complete secrets management infrastructure with dev/staging/prod environments  
**Estimate:** 1-2 days  
**Owner:** TBD

---

## Context

**Current state:**
- Doppler account exists (no projects yet)
- Doppler CLI action already in `canary-deploy.yml` (line 46)
- `.env.example` documents 50+ secrets + 26 per-agency database passwords
- Logger already redacts Doppler tokens
- Migration/seed runners expect Doppler to be configured

**Approach:**
- Single shared `mjagency` Doppler project with 3 configs: dev, staging, prod
- All secrets stored in Doppler (global + per-agency passwords/URLs)
- DOPPLER_CI_TOKEN added to GitHub repository secrets for CI/CD access

---

## Work Breakdown

### Task 1: Create Doppler Project + Configs (30 min)

**What:** Set up the Doppler organization and project structure.

**Steps:**
1. Log into Doppler dashboard (account exists, no projects)
2. Create project: `mjagency` (shared across all environments)
3. Create 3 configs within project:
   - `dev` — Local development secrets
   - `staging` — Staging deployment secrets
   - `prod` — Production deployment secrets
4. For each config, create these default environment variables:
   - `ENVIRONMENT` = dev/staging/prod (for logging/observability)
   - `NODE_ENV` = development/production
   - `DOPPLER_ENVIRONMENT` = dev/staging/prod

**Verification:**
- [ ] `mjagency` project appears in Doppler dashboard
- [ ] All 3 configs (dev, staging, prod) are created
- [ ] Can navigate to each config in UI

**Owner:** TBD  
**Estimate:** 30 min

---

### Task 2: Populate Global Secrets (1 hour)

**What:** Copy global (non-agency-specific) secrets from `.env.example` into Doppler dev/staging/prod configs.

**Source:** `.env.example` lines 1-88 (PostgreSQL, Redis, Cloudflare, Stripe, SMTP, JWT, Vault, etc.)

**Process for each secret:**
1. Read from `.env.example` documentation + comments
2. Determine if value changes per environment (dev → staging → prod)
3. Create secret in appropriate configs with documented defaults

**Secrets to populate:**

| Secret | Dev Value | Staging | Prod | Notes |
|--------|-----------|---------|------|-------|
| `POSTGRES_SUPERUSER_PASSWORD` | dev-generated | staging-generated | prod-vault | Use secure random for staging/prod |
| `REDIS_PASSWORD` | dev-generated | staging-generated | prod-vault | Same as above |
| `JWT_ACCESS_SECRET` | dev-generated (64-byte hex) | staging-generated | prod-vault | Never share; openssl rand -hex 64 |
| `JWT_REFRESH_SECRET` | dev-generated (64-byte hex) | staging-generated | prod-vault | Different from access secret |
| `PAYLOAD_SECRET` | dev-generated (32-byte hex) | staging-generated | prod-vault | openssl rand -hex 32 |
| `VAULT_ENCRYPTION_KEY` | __SET_VIA_DOPPLER__ | __SET_VIA_DOPPLER__ | vault-managed | AES-256-GCM key material |
| `BULLMQ_ENCRYPTION_KEY` | __SET_VIA_DOPPLER__ | __SET_VIA_DOPPLER__ | vault-managed | AES-256-GCM key material |
| Cloudflare (R2, Images, API) | test-keys | staging-keys | production-keys | From Cloudflare dashboard |
| Stripe | sk_test_* | sk_test_* | sk_live_* | Never test keys in prod |
| SMTP / Email | localhost:1025 (dev) | staging-relay | production-relay | Dev uses docker mailhog |
| Twilio | test-sid-****** | staging-account | production-account | Only populated if SMS enabled |
| LiteLLM | http://localhost:4000 | staging-gateway | production-gateway | Per-agency budgets set here |

**Special handling:**
- Stripe webhook secrets: Create in Stripe dashboard first, then copy into Doppler
- Cloudflare API token: Copy from Cloudflare account dashboard
- Google Workspace (GA4, Meta CAPI): Copy from respective service accounts (populate per agency below)

**Verification:**
- [ ] All 50+ global secrets populated in dev config
- [ ] Environment-specific overrides exist for staging/prod
- [ ] No hardcoded values in git; all values populated in Doppler UI
- [ ] Doppler UI shows all secrets (sorted, filterable)

**Owner:** TBD  
**Estimate:** 1 hour

---

### Task 3: Populate Per-Agency Secrets (1.5 hours)

**What:** Create secrets for all 26 agencies in Doppler (database passwords, Payload secrets, GA4 keys, Meta CAPI tokens).

**Process:**
1. For each agency in `.env.example` (ECOMMERCE, GROWTH, WEBDEV, AI, BRANDING, STRATEGY, FINANCE, ENGINEERING, PRODUCT, VIDEO, GRAPHIC, + new 5 phantom + custom):
2. Create these secrets per agency, per config (dev/staging/prod):
   - `<AGENCY>_DB_PASSWORD` — Per-agency Postgres password
   - `<AGENCY>_PAYLOAD_SECRET` — Unique Payload CMS secret (32-byte hex)
   - `<AGENCY>_PAYLOAD_API_KEY` — Service token for cross-agency API calls
   - `GA4_API_SECRET_<AGENCY>` — GA4 API key (if agency uses GA4)
   - `GA4_PROPERTY_ID_<AGENCY>` — GA4 property ID
   - `META_ACCESS_TOKEN_<AGENCY>` — Meta CAPI access token (if agency uses Meta)
   - `LEGAL_HOLD_<AGENCY>_*` — CCPA/ESIGN hold overrides (optional, only if non-default)

**Per-agency list:**
- Main: BRAND (main brand)
- Active 11: ECOMMERCE, GROWTH, WEBDEV, AI, BRANDING, STRATEGY, FINANCE, ENGINEERING, PRODUCT, VIDEO, GRAPHIC
- New 5: AUTOMOTIVE, EDUCATION, HEALTHCARE, PETCARE, (+ 1 TBD if expanding)
- Existing but needs secrets: CONSTRUCTION, DENTAL, FINANCIAL, FITNESS, HOMESERVICES, LEGAL, REALESTATE, RESTAURANT, SPA

**Doppler naming convention:** All agency slugs UPPERCASE in Doppler, matching `.env.example`

**Value generation:**
```bash
# For each agency, generate:
openssl rand -hex 32  # DB password
openssl rand -hex 32  # PAYLOAD_SECRET
openssl rand -hex 32  # PAYLOAD_API_KEY
```

**Verification:**
- [ ] All 26 agencies have complete secret sets
- [ ] Dev config has generated test values
- [ ] Staging/prod configs have corresponding (potentially different) values
- [ ] No conflicts with reserved names (e.g., `NODE_ENV` vs `<AGENCY>_NODE_ENV`)

**Owner:** TBD  
**Estimate:** 1.5 hours (or scripted if time-sensitive)

---

### Task 4: Generate DOPPLER_CI_TOKEN (15 min)

**What:** Create GitHub-specific token in Doppler and register in GitHub repository secrets.

**Steps:**
1. In Doppler dashboard, go to **Settings** → **Access Control** → **API Tokens**
2. Create new token:
   - Name: `github-actions-ci`
   - Permissions: Read-only access to `mjagency` project (all 3 configs)
   - Scopes: Allow `dev`, `staging`, `prod` config access
3. Copy token value (looks like `dp.pt_*`)
4. In GitHub repository (**Settings** → **Secrets and variables** → **Repository secrets**):
   - Create new secret: `DOPPLER_CI_TOKEN` = [paste token from step 3]
5. Verify GitHub Actions can read the token (test in PR or manual dispatch)

**Verification:**
- [ ] Token created in Doppler with correct permissions
- [ ] Token added to GitHub repository secrets (not organization secrets)
- [ ] GitHub Actions canary-deploy.yml can read it (next task)

**Owner:** TBD  
**Estimate:** 15 min

---

### Task 5: Wire GitHub Actions to Doppler (45 min)

**What:** Update `canary-deploy.yml` and other workflows to fetch secrets from Doppler instead of GitHub Secrets.

**File:** `.github/workflows/canary-deploy.yml` (and any other deploy workflows)

**Current state (line 46-50):**
```yaml
- uses: dopplerhq/cli-action@v3
- run: pnpm install --frozen-lockfile
- run: pnpm turbo run build
  env:
    DOPPLER_TOKEN: ${{ secrets.DOPPLER_CI_TOKEN }}
```

**Needed changes:**
1. Replace `DOPPLER_TOKEN: ${{ secrets.DOPPLER_CI_TOKEN }}` with environment-specific token fetch:
   ```yaml
   - uses: dopplerhq/cli-action@v3
     with:
       token: ${{ secrets.DOPPLER_CI_TOKEN }}
       project: mjagency
       config: prod  # or dev/staging based on environment
   - run: doppler run -- pnpm install --frozen-lockfile
   - run: doppler run -- pnpm turbo run build
   ```

2. Update any other workflow files that reference `${{ secrets.* }}` to use `doppler run --` instead:
   - `.github/workflows/pr.yml` — Add Doppler token for PR testing
   - `.github/workflows/cloudflare-terraform-plan.yml` — Use Doppler for Terraform vars

3. Remove hardcoded GitHub Secrets references (STRIPE_API_KEY, CLOUDFLARE_API_TOKEN, etc.) — fetch from Doppler instead

4. Add environment matrix to canary-deploy:
   ```yaml
   strategy:
     matrix:
       environment: [dev, staging, prod]
   ```
   (Each environment uses its corresponding Doppler config)

**Verification:**
- [ ] `doppler run -- pnpm build` succeeds locally with Doppler token
- [ ] GitHub Actions canary-deploy.yml passes (builds with Doppler secrets)
- [ ] Build logs show secrets are injected (verify with `echo $DATABASE_URL | head -c 20`)
- [ ] No GitHub Secrets appear in build logs (security check)

**Owner:** TBD  
**Estimate:** 45 min

---

### Task 6: Create `doppler.yaml` + Dev Setup Docs (30 min)

**What:** Create `doppler.yaml` for local development and document setup process.

**File:** `doppler.yaml` (at root)

**Content:**
```yaml
# MJAgency Doppler Configuration
# Use: doppler run -- pnpm dev
# Or: doppler run -- pnpm turbo run build

setup:
  # Prompt user to select environment on first run
  prompt: true

environments:
  development:
    project: mjagency
    config: dev
  staging:
    project: mjagency
    config: staging
  production:
    project: mjagency
    config: prod

# Local overrides (optional)
# Set in .doppler.local.yaml (gitignored)
```

**File:** `docs/setup/doppler-setup.md` (new)

**Content:**
```markdown
# Doppler Setup for Local Development

## Prerequisites
1. Doppler CLI installed: https://docs.doppler.com/docs/install
2. Doppler account credentials (provided by ops)

## One-time setup
\`\`\`bash
doppler login
doppler setup  # Select mjagency project, dev config
\`\`\`

## Running development server
\`\`\`bash
doppler run -- pnpm dev      # Automatically injects dev secrets
doppler run -- pnpm build    # Build with secrets
doppler run -- pnpm test     # Run tests with secrets
\`\`\`

## Switching environments
\`\`\`bash
doppler switch  # Interactively select project/config
doppler run --config=staging -- pnpm build  # Build for staging
\`\`\`

## Troubleshooting
- **"Authentication failed"**: Run `doppler logout && doppler login` again
- **"Config not found"**: Ensure mjagency project has dev/staging/prod configs
- **Secrets not injected**: Verify token has read access to project configs

## Rotating secrets
See: docs/runbooks/secrets-rotation.md
```

**File:** `docs/runbooks/secrets-rotation.md` (new, placeholder)

**Content:**
```markdown
# Secrets Rotation Procedure

## Monthly rotation (recommended for Stripe, Twilio, etc.)

1. Generate new secret in source service (Stripe dashboard, Twilio console, etc.)
2. Update in Doppler dashboard: mjagency project → {dev/staging/prod} config
3. Verify in GitHub Actions: New deployments use new secrets
4. Deactivate old secret in source service (after 24h to ensure cutover)

## Emergency rotation (compromised secret)

1. Immediately revoke in source service
2. Generate new secret
3. Update in Doppler (all configs: dev, staging, prod)
4. Trigger manual deploy in GitHub Actions (canary-deploy workflow)
5. Monitor logs for any auth failures
6. Document incident in runbook

## Per-agency database password rotation

\`\`\`bash
# 1. Generate new password
openssl rand -hex 32

# 2. Update in Doppler dashboard (mjagency project)
#    Secret: <AGENCY>_DB_PASSWORD

# 3. Update Postgres role password (ops task, requires DB access)
ALTER ROLE mjagency_<agency_id> WITH PASSWORD 'new-password-from-doppler';

# 4. Restart app containers (PM2 or Kubernetes)
\`\`\`
```

**Verification:**
- [ ] `doppler.yaml` exists at root
- [ ] `doppler setup` prompts correctly
- [ ] `doppler run -- pnpm dev` starts dev server with injected secrets
- [ ] Setup docs are clear and tested with fresh user

**Owner:** TBD  
**Estimate:** 30 min

---

### Task 7: Local Development Validation (30 min)

**What:** Test that local development works end-to-end with Doppler-injected secrets.

**Test plan:**
1. Fresh clone of repo (or new terminal window, clean state)
2. Run setup:
   ```bash
   doppler login
   doppler setup  # Select mjagency/dev
   pnpm install
   ```
3. Start dev server:
   ```bash
   doppler run -- pnpm dev
   ```
4. Verify in browser:
   - [ ] http://localhost:3000 loads without secrets errors
   - [ ] Payload CMS admin accessible at /admin
   - [ ] Database queries work (test with curl to `/api/*` endpoint)
   - [ ] Redis cache hits work (check logs for cache operations)
5. Build test:
   ```bash
   doppler run -- pnpm turbo run build
   ```
   - [ ] Build succeeds without "secret not found" errors
6. Test switching configs:
   ```bash
   doppler run --config=staging -- pnpm build
   ```
   - [ ] Staging build succeeds with staging-specific secrets

**Verification:**
- [ ] All steps above pass
- [ ] No `undefined` secrets in logs/console
- [ ] No `.env` file needed (all from Doppler)
- [ ] Documentation matches actual process

**Owner:** TBD  
**Estimate:** 30 min

---

## Success Criteria (Phase 1 Complete)

- [x] Doppler `mjagency` project created with dev/staging/prod configs
- [x] 50+ global secrets populated (all environments)
- [x] 26 agencies × 3 environments = 78 per-agency secrets created
- [x] DOPPLER_CI_TOKEN generated and in GitHub repository secrets
- [x] GitHub Actions canary-deploy.yml uses Doppler secrets
- [x] `doppler.yaml` + setup docs complete
- [x] Local dev workflow validated: `doppler run -- pnpm dev` works
- [x] No hardcoded secrets in git
- [x] All 3 configs (dev/staging/prod) verified in Doppler dashboard

---

## Dependencies

**Blocks:** Phase 2 (Phantom apps) and Phase 3 (Migrations)  
- Both depend on Doppler secrets being available for DATABASE_URL and PAYLOAD_SECRET

**Blocked by:** None (foundational)

---

## Rollback Plan

If Doppler setup fails or needs to be reverted:

1. **Remove GitHub Actions integration:**
   - Delete `DOPPLER_CI_TOKEN` from GitHub repository secrets
   - Revert changes to `.github/workflows/canary-deploy.yml`
   - Fall back to local `.env` file or GitHub Secrets

2. **Keep local development working:**
   - Restore `.env.example` copies to `.env` files in local workspace
   - Developers continue with local env files (temporary)

3. **Full rollback:**
   - Delete Doppler project (if needed)
   - Recreate secrets in GitHub repository secrets (temporary measure)

---

## Notes

- **Doppler free tier limits:** Check account limits for number of secrets/configs
- **Token expiration:** DOPPLER_CI_TOKEN should be reviewed monthly for rotation
- **Audit logs:** Enable in Doppler for compliance (who accessed what secret, when)
- **Backup:** Export Doppler project configuration (JSON) and commit to secure backup location
