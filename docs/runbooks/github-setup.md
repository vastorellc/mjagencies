# GitHub Repository Setup Runbook

This runbook documents the GitHub repository configuration required for MJAgency. All items here
must be completed before the first external PR is merged into `main`. Most steps require
repo admin access.

## Branch Protection on `main`

Navigate to **Repository Settings → Branches → Add branch protection rule** with pattern `main`.

### Required status checks

Enable "Require status checks to pass before merging" and add ALL of the following as required:

| Check name | Job | Purpose |
|---|---|---|
| `security-grep` | `.github/workflows/pr.yml` | REQ-502, REQ-503, SEC-N4 fail-fast gate |
| `install` | `.github/workflows/pr.yml` | pnpm frozen install + REQ-501 Payload pin |
| `lint-typecheck-test (lint)` | `.github/workflows/pr.yml` | ESLint flat config |
| `lint-typecheck-test (typecheck)` | `.github/workflows/pr.yml` | TypeScript strict mode |
| `lint-typecheck-test (test)` | `.github/workflows/pr.yml` | Vitest unit tests |
| `build` | `.github/workflows/pr.yml` | Full Turbo build |
| `bundle-size` | `.github/workflows/pr.yml` | D-16 +10%/+25% growth gate |
| `npm-audit` | `.github/workflows/pr.yml` | High-severity audit |
| `compose-smoke` | `.github/workflows/pr.yml` | Docker Compose stack healthcheck |
| `dev-smoke` | `.github/workflows/pr.yml` | Boot web-main + hit /api/health |
| `next-data-secret-audit` | `.github/workflows/pr.yml` | REQ-427 __NEXT_DATA__ scan |

### Other branch protection settings

- **Require a pull request before merging**: enabled
- **Required approvals**: 1 (from code owner per CODEOWNERS)
- **Dismiss stale reviews when new commits are pushed**: enabled
- **Require review from Code Owners**: enabled (uses `.github/CODEOWNERS`)
- **Require conversation resolution before merging**: enabled
- **Do not allow bypassing the above settings**: enabled
- **Restrict who can push to matching branches**: restrict to admins only
- **Allow force pushes**: disabled
- **Allow deletions**: disabled

## Required GitHub Secrets

Navigate to **Repository Settings → Secrets and variables → Actions** to add these secrets.

### `DOPPLER_CI_TOKEN` (required for build + dev-smoke jobs)

Created by Plan 01-06 (Doppler bootstrap). This is a Doppler service token scoped to the
`mjagency-shared` project, `ci` config, with **read-only** access.

**How to create:**
1. Log in to the Doppler dashboard at https://dashboard.doppler.com
2. Navigate to **mjagency-shared** project → **ci** config
3. Go to **Access** → **Service Tokens** → **Generate**
4. Name it `github-actions-ci`, set access to read-only
5. Copy the token (shown once) and add it as the `DOPPLER_CI_TOKEN` GitHub secret

The token injects secrets into CI jobs that need real credentials: `build`, `dev-smoke`,
`next-data-secret-audit`. Jobs that do not need secrets (security-grep, lint, typecheck,
test, compose-smoke, npm-audit) do not receive the token.

### `CLOUDFLARE_API_TOKEN` (optional — unlocks integration tests)

Unlocks the `INTEGRATION=cloudflare-images` test gate in Plan 01-03.
Only required if running Cloudflare Images integration tests in CI.

**How to create:**
1. Log in to the Cloudflare dashboard
2. Navigate to **My Profile → API Tokens → Create Token**
3. Use the "Edit Cloudflare Workers" template, scoped to your MJAgency zone
4. Copy the token and add it as the `CLOUDFLARE_API_TOKEN` GitHub secret

## GitHub Organization Teams

The `.github/CODEOWNERS` file references three teams. These must be created in the GitHub
organization before CODEOWNERS enforcement activates.

| Team handle | Members | Purpose |
|---|---|---|
| `@mjagency/maintainers` | Core engineering leads | Owns doctrine files (CLAUDE.md, PROJECT.md), general codebase |
| `@mjagency/infra` | Infrastructure + DevOps | Owns Payload config, workflow files, Docker Compose, infra/ |
| `@mjagency/security` | Security-conscious engineers | Owns secrets runbooks, VPS provisioning docs |

**To create a team:**
1. Go to **Organization Settings → Teams → New team**
2. Create each team, set visibility to Private
3. Add members to each team

Until teams exist, CODEOWNERS rules silently pass (GitHub does not enforce reviews for
non-existent teams). Create the teams before inviting external contributors.

## Self-Hosted Runners (M012 migration)

Per **CONTEXT D-02**, M001 uses GitHub-hosted Ubuntu runners (`ubuntu-latest`). Migration
to self-hosted VPS runners is scheduled for **M012 (Phase 12 — Launch)** when the VPS is
provisioned per `docs/runbooks/vps-provisioning.md`.

When migrating, update all `runs-on: ubuntu-latest` in `.github/workflows/*.yml` to
`runs-on: [self-hosted, linux]` and register the VPS as a GitHub Actions runner via:

```bash
# On the VPS (M012 step)
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
./config.sh --url https://github.com/mjagency/mjagency --token <REGISTRATION_TOKEN>
sudo ./svc.sh install && sudo ./svc.sh start
```

## Multi-OS Runners (Deferred)

Per CONTEXT, Windows and macOS runner matrix testing is deferred to a post-M001 milestone.
The current CI matrix only covers `ubuntu-latest`.

## Dependabot Configuration

`.github/dependabot.yml` is committed and configures weekly auto-PRs for:
- **npm ecosystem**: all packages, grouped by `@opentelemetry/*` and `@aws-sdk/*`
- **github-actions**: action versions

**Critical ignore rules (REQ-501 enforcement):**
- `payload` — never auto-updated; requires explicit human approval per CLAUDE.md §1
- `@payloadcms/*` — same restriction as above

Dependabot PRs for non-ignored dependencies run through the full PR pipeline like any other PR.

## First PR Checklist

Before merging the first external PR, verify:

- [ ] Branch protection on `main` is enabled with all 11 required checks listed above
- [ ] `DOPPLER_CI_TOKEN` secret is registered
- [ ] `@mjagency/maintainers`, `@mjagency/infra`, `@mjagency/security` teams exist
- [ ] A test PR has been opened and ALL required checks have passed at least once
- [ ] `update-size-baseline` job in `main.yml` has run at least once (populates `.size-baseline.json`)
