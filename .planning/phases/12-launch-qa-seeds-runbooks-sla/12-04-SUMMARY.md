---
phase: 12-launch-qa-seeds-runbooks-sla
plan: "04"
subsystem: infra
tags: [github-actions, terraform, cloudflare, canary, health-check, deployment]

# Dependency graph
requires:
  - phase: 11-analytics-security
    provides: Cloudflare WAF Terraform infra/cloudflare/ with ~> 4.40 provider

provides:
  - GitHub Actions 5-job canary deploy pipeline (build → 5% canary → health-check → promote/rollback)
  - Per-agency /api/health poller with configurable timeout and GitHub Actions error annotations
  - Terraform weighted routing variables for Cloudflare Workers canary splits
affects: [12-launch-qa-seeds-runbooks-sla, docs/runbooks/cloudflare-waf-toggle.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - canary deploy pipeline: build tag → terraform apply weight=5 → poll /api/health → terraform apply weight=100 or weight=0
    - rollback SLA: single terraform apply operation completes in < 60s (REQ-154)
    - cancel-in-progress: false prevents new workflow run from aborting active canary before rollback fires

key-files:
  created:
    - scripts/canary-health-check.mjs
    - infra/cloudflare/canary/canary-weights.tf
    - .github/workflows/canary-deploy.yml
  modified: []

key-decisions:
  - "concurrency cancel-in-progress: false — prevents race where a new dispatch cancels an in-flight canary before rollback fires (T-12-04-01)"
  - "Rollback via single terraform apply with canary_weight=0 — satisfies < 60s SLA (REQ-154)"
  - "WAF note comment in deploy-canary job per 12-CONTEXT.md D-04 — do not toggle to enforcing during canary window"
  - "::error:: GitHub Actions annotation on health check failure — triggers rollback job via if: failure()"
  - "canary-weights.tf uses cloudflare ~> 4.40 consistent with existing infra/cloudflare/versions.tf"
  - "Health check polls with 2s interval; failed Set tracks unhealthy slugs for retry — pattern from compose-smoke.ts"

patterns-established:
  - "Canary poller: Set of failed slugs, poll until empty or deadline, ::error:: annotation on failure"
  - "Terraform canary weight: count = canary_enabled ? 1 : 0 gates resource creation on weight > 0"

requirements-completed: [REQ-153, REQ-154, REQ-157]

# Metrics
duration: 15min
completed: "2026-04-28"
---

# Phase 12 Plan 04: Canary Deploy Pipeline Summary

**5-job GitHub Actions canary pipeline (build → 5% Cloudflare Workers → 30s health-check → promote 100% or rollback 0% via Terraform, auto-rollback in < 60s per REQ-154)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-28T11:15:03Z
- **Completed:** 2026-04-28T11:30:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Built `scripts/canary-health-check.mjs` — polls GET /api/health for all 12 agencies with configurable timeout, 2s retry interval, GitHub Actions `::error::` annotation on failure, `--help` usage listing all slugs
- Built `infra/cloudflare/canary/canary-weights.tf` — Terraform vars for canary_weight (0-100 validated), canary_script_name, stable_script_name; uses cloudflare ~> 4.40 provider consistent with existing infra/cloudflare/ module
- Built `.github/workflows/canary-deploy.yml` — 5-job pipeline with manual dispatch, concurrency guard (`cancel-in-progress: false`), WAF note comment, promote (`if: success()`) and rollback (`if: failure()`) gates

## Task Commits

1. **Task 1: canary-health-check.mjs + canary-weights.tf** — `88e0236` (feat)
2. **Task 2: canary-deploy.yml** — `0fa293d` (feat)

## Files Created/Modified

- `scripts/canary-health-check.mjs` — polls /api/health for 12 agencies, exit 0 all healthy / exit 1 with ::error:: on failure
- `infra/cloudflare/canary/canary-weights.tf` — Terraform weighted routing vars; count=0 on rollback destroys canary resource
- `.github/workflows/canary-deploy.yml` — 5-job canary pipeline, concurrency guard, WAF warning comment

## Decisions Made

- `concurrency: cancel-in-progress: false` — an in-flight canary must never be cancelled by a new dispatch; the rollback job must be allowed to complete (T-12-04-01 mitigation)
- Rollback via single `terraform apply -var="canary_weight=0"` — destroys the `cloudflare_workers_deployment.canary` resource in one operation, satisfying the < 60s SLA (REQ-154)
- WAF note comment in `deploy-canary` job — per 12-CONTEXT.md D-04 the WAF must remain in log-only mode during the 5% canary window
- Used `cloudflare_workers_deployment` resource with `count` meta-argument — consistent with provider ~> 4.40 already pinned in `infra/cloudflare/versions.tf`; `count = local.canary_enabled ? 1 : 0` gates creation on weight > 0 (weight=0 = rollback, destroys resource)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Secrets `CLOUDFLARE_API_TOKEN` and `DOPPLER_CI_TOKEN` must be present in GitHub repository secrets (pre-existing from Phase 11).

## Next Phase Readiness

- Canary pipeline ready for first deployment after Phase 12 QA gate (`gsd-headless.mjs`) passes
- `infra/cloudflare/canary/` directory requires `terraform init` with remote backend config before first apply (T-12-04-05 mitigation — local state risks misconfiguration; backend config should be added before production use)

---
*Phase: 12-launch-qa-seeds-runbooks-sla*
*Completed: 2026-04-28*
