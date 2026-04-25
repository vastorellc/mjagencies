---
phase: 01-foundation-infra
plan: "05"
subsystem: ci-gates
tags:
  - github-actions
  - security-grep
  - dependabot
  - bundle-size
  - next-data-audit
  - doppler
  - codeowners

dependency_graph:
  requires:
    - 01-01 (workspace scripts, CLAUDE.md/PROJECT.md root copies, ESLint flat config)
    - 01-02 (compose-smoke.ts, docker-compose.yml)
    - 01-03 (media integration test gate pattern)
    - 01-04 (observability stack, docker-compose.observability.yml)
  provides:
    - .github/workflows/pr.yml (PR gate: 9 jobs, security-grep fail-fast first)
    - .github/workflows/main.yml (main pipeline + post-merge baseline update)
    - .github/dependabot.yml (weekly auto-PRs, payload + @payloadcms/* excluded)
    - .github/CODEOWNERS (12 ownership rules)
    - scripts/dev-smoke.ts (boot web-main, poll /api/health, 60s timeout)
    - scripts/check-claude-md-parity.sh (byte-equality CLAUDE.md + PROJECT.md)
    - scripts/scan-next-data.ts (REQ-427 __NEXT_DATA__ secret pattern scan)
    - scripts/check-bundle-size.ts (D-16 +10%/+25% growth gate)
    - .size-baseline.json (initial empty baseline, main.yml populates on first merge)
    - docs/runbooks/github-setup.md (branch protection, secrets, teams runbook)
    - docs/runbooks/vps-provisioning.md (REQ-006 VPS spec — M012 acceptance contract)
  affects:
    - all future PRs (every PR runs the full gate matrix)
    - 01-06 (DOPPLER_CI_TOKEN registered via github-setup.md runbook)
    - M012 (VPS provisioning executes against vps-provisioning.md contract)

tech_stack:
  added:
    - dopplerhq/cli-action@v3 (GitHub Actions — Doppler secret injection)
    - actions/checkout@v4, pnpm/action-setup@v4, actions/setup-node@v4
  patterns:
    - security-grep as first job (no `needs:`) — fail-fast before any install
    - concurrency: { group: pr-${{ github.ref }}, cancel-in-progress: true }
    - Doppler token injection via env.DOPPLER_TOKEN (never echoed — T-01-010 mitigation)
    - size-limit JSON output → reshape → .size-baseline.json delta comparison
    - check-claude-md-parity.sh diff-based byte-equality check

key_files:
  created:
    - .github/workflows/pr.yml
    - .github/workflows/main.yml
    - .github/dependabot.yml
    - .github/CODEOWNERS
    - scripts/dev-smoke.ts
    - scripts/check-claude-md-parity.sh
    - scripts/scan-next-data.ts
    - scripts/check-bundle-size.ts
    - .size-baseline.json
    - docs/runbooks/github-setup.md
    - docs/runbooks/vps-provisioning.md
  modified:
    - docs/runbooks/local-dev.md (added Bundle-size workflow section)
    - .gitignore (removed .size-baseline.json exclusion — file must be tracked)

decisions:
  - "security-grep is the first job in pr.yml with NO `needs:` — fail-fast before any work begins; this is the load-bearing order guarantee for REQ-501/502/503/SEC-N4"
  - "scan-next-data.ts exits 1 if no built output found — ensures the build step always runs before the audit"
  - "check-bundle-size.ts exits 0 when baseline is empty (no error on first run) — main.yml populates .size-baseline.json after first merge to main"
  - ".size-baseline.json removed from .gitignore (Plan 01-01 added it but Plan 01-05 requires it tracked — main.yml commits updates via git push)"
  - "Doppler token injection via env block on individual run steps, not as a global env — limits secret scope per job"
  - "vps-provisioning.md is a forward-looking acceptance contract (M012 will execute against it) — not a TODO list"

metrics:
  duration: "22 minutes"
  completed_date: "2026-04-25"
  tasks_completed: 2
  files_created: 11
  files_modified: 2
---

# Phase 1 Plan 05: GitHub Actions Pipelines + Security Gates + Bundle-Size + Dependabot Summary

Full CI gate matrix: PR pipeline with security-grep fail-fast, 9 enforcement jobs covering REQ-501/502/503/427/D-16, Doppler secret injection, Dependabot with Payload pin protection, and the CLAUDE.md/PROJECT.md parity check.

## CI Pipeline Architecture

### PR Pipeline (`.github/workflows/pr.yml`)

Concurrency: `cancel-in-progress: true` on every PR push.

| Job | Needs | Purpose |
|---|---|---|
| `security-grep` | *(none — fail-fast)* | REQ-502 (no jsonwebtoken), REQ-503 (no NEXT_PUBLIC_*KEY), SEC-N4 (no dangerouslyAllowSVG) |
| `install` | *(none)* | pnpm frozen install + REQ-501 payload 3.82.1 pin + CLAUDE.md parity check |
| `lint-typecheck-test` | `install` | Matrix: lint, typecheck, test — ESLint + TypeScript strict + Vitest |
| `build` | `install` | Turbo build with Doppler injection |
| `bundle-size` | `install` | pnpm turbo run build + D-16 growth check via `scripts/check-bundle-size.ts` |
| `npm-audit` | `install` | pnpm audit --audit-level=high |
| `compose-smoke` | `install` | `scripts/compose-smoke.ts` — polls Docker Compose until healthy (120s) |
| `dev-smoke` | `install, compose-smoke` | `scripts/dev-smoke.ts` — boots web-main, polls /api/health for ok:true |
| `next-data-secret-audit` | `build` | `scripts/scan-next-data.ts` — REQ-427 scan after build |

### Main Pipeline (`.github/workflows/main.yml`)

| Job | Condition | Purpose |
|---|---|---|
| `full-suite` | always on push to main | Full suite: lint, typecheck, test, build, size-limit + REQ-427 scan |
| `update-size-baseline` | after full-suite, main only | Commits updated `.size-baseline.json` with `[skip ci]` |

## 5 Hard-Fail Gates

| Gate | Job | Script/Command | REQ/Decision |
|---|---|---|---|
| REQ-501 Payload version pin | `install` | `pnpm list payload \| grep "payload 3.82.1"` | REQ-501 |
| REQ-502 no jsonwebtoken | `security-grep` | `grep -rn "jsonwebtoken" apps packages` → exit 1 if found | REQ-502 |
| REQ-503 no NEXT_PUBLIC_*KEY | `security-grep` | `grep -rnE "NEXT_PUBLIC_[A-Z_]*KEY" apps packages` → exit 1 if found | REQ-503 |
| REQ-427 __NEXT_DATA__ secrets | `next-data-secret-audit` | `scan-next-data.ts` — sk_live_, whsec_, AKIA*, JWT-shape, xoxb- | REQ-427 |
| D-16 bundle-size hard fail | `bundle-size` | `check-bundle-size.ts` — +25% growth vs baseline → exit 1 | D-16 |

## Required GitHub Secrets

| Secret | Required by | Purpose |
|---|---|---|
| `DOPPLER_CI_TOKEN` | `build`, `dev-smoke`, `next-data-secret-audit` | Doppler service token, `mjagency-shared` `ci` config, read-only. Created by Plan 01-06. |
| `CLOUDFLARE_API_TOKEN` | optional | Unlocks `INTEGRATION=cloudflare-images` test gate (Plan 01-03) |

## Branch Protection Required Checks

All 11 checks must be marked as required in GitHub Settings → Branches → main:

`security-grep`, `install`, `lint-typecheck-test (lint)`, `lint-typecheck-test (typecheck)`, `lint-typecheck-test (test)`, `build`, `bundle-size`, `npm-audit`, `compose-smoke`, `dev-smoke`, `next-data-secret-audit`

See `docs/runbooks/github-setup.md` for the full setup procedure including CODEOWNERS team creation.

## Dependabot Ignore Rules (REQ-501 Long-Tail)

Dependabot opens weekly auto-PRs for all npm packages **except**:

| Ignored package | Reason |
|---|---|
| `payload` | Pinned exactly at 3.82.1 — never auto-upgrade (CLAUDE.md §1, REQ-501) |
| `@payloadcms/*` | Same restriction as above — all Payload sub-packages pinned |

Non-ignored packages run through the full PR pipeline (including `security-grep`) before merging.

## VPS Spec Doc (REQ-006)

`docs/runbooks/vps-provisioning.md` is the M012 acceptance contract:

- 8 GB RAM minimum
- 4 GB swap
- 4 vCPU
- 100 GB SSD
- Ubuntu 24.04 LTS
- Cloudflare Tunnel ingress

Provisioning is M012 Phase 12 — this document specifies the target so M012 has a clear bar.

## CLAUDE.md / PROJECT.md Parity

`scripts/check-claude-md-parity.sh` runs on every PR and main push:
- Compares `mjagency/CLAUDE.md` vs `./CLAUDE.md` byte-for-byte via `diff`
- Compares `mjagency/PROJECT.md` vs `./PROJECT.md` byte-for-byte via `diff`
- Exits 1 with `::error::` annotation if any difference found

Verified: exits 0 on current checkout.

## Phase 1 Sign-Off Readiness: ROADMAP Success Criteria → CI Gate Mapping

| ROADMAP Criterion | CI Gate | Status |
|---|---|---|
| REQ-005: CI green on main | full-suite job in main.yml | Wired |
| REQ-501: payload 3.82.1 pin | install job: pnpm list check + dependabot ignore | Wired |
| REQ-502: no jsonwebtoken | security-grep (first job, fail-fast) | Wired |
| REQ-503: no NEXT_PUBLIC_*KEY | security-grep (first job, fail-fast) | Wired |
| REQ-427: __NEXT_DATA__ audit | next-data-secret-audit job + scan-next-data.ts | Wired |
| REQ-006: VPS spec doc | docs/runbooks/vps-provisioning.md published | Wired |
| D-16: bundle-size budgets | bundle-size job + check-bundle-size.ts thresholds | Wired |
| SEC-N4: no dangerouslyAllowSVG | security-grep (first job, fail-fast) | Wired |

All Phase 1 M001 invariants are now enforced by CI gates. Every PR runs the full matrix; merging to main updates the bundle-size baseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] .size-baseline.json was in .gitignore**
- **Found during:** Task 5.2 — `git add .size-baseline.json` failed with "ignored by .gitignore"
- **Issue:** Plan 01-01 added `.size-baseline.json` to `.gitignore` with comment "committed manually". But Plan 01-05's `update-size-baseline` job in `main.yml` commits this file with `git push`. A file in `.gitignore` cannot be committed by CI — the main.yml baseline update would silently fail.
- **Fix:** Removed the `.size-baseline.json` line from `.gitignore`; replaced with a comment explaining the file is tracked intentionally. The file starts as `{}` and main.yml populates it after first merge.
- **Files modified:** `.gitignore`
- **Commit:** c7442df

## Known Stubs

None. All scripts contain real implementation. `.size-baseline.json` starts as `{}` by design — this is the correct initial state. The `update-size-baseline` job in `main.yml` populates it after the first successful merge to main.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Security gates added:

- T-01-001 (NEXT_PUBLIC_*KEY): mitigated — REQ-503 in security-grep
- T-01-002 (jsonwebtoken): mitigated — REQ-502 in security-grep
- T-01-003 (Payload drift): mitigated — REQ-501 in install + Dependabot ignore
- T-01-004 (__NEXT_DATA__ secrets): mitigated — REQ-427 via scan-next-data.ts
- T-01-010 (token echo in CI logs): mitigated — no `echo $TOKEN` patterns in any workflow file
- T-01-501 (CLAUDE.md drift): mitigated — check-claude-md-parity.sh in install + main
- T-01-502 (baseline manipulation): mitigated — .size-baseline.json only writable by main.yml on main push
- T-01-503 (workflow YAML bypass): mitigated — CODEOWNERS requires @mjagency/infra on .github/workflows/

## Self-Check: PASSED

**Files exist:**
- [x] `.github/workflows/pr.yml` — FOUND (contains security-grep, 9 jobs)
- [x] `.github/workflows/main.yml` — FOUND (contains update-size-baseline, size-baseline)
- [x] `.github/dependabot.yml` — FOUND (contains payload, @payloadcms/*)
- [x] `.github/CODEOWNERS` — FOUND (12 ownership rules)
- [x] `scripts/dev-smoke.ts` — FOUND (contains /api/health, SIGTERM, 60s timeout)
- [x] `scripts/check-claude-md-parity.sh` — FOUND, executable, exits 0 on clean checkout
- [x] `scripts/scan-next-data.ts` — FOUND (contains sk_live_, AKIA, REQ-427, glob html+json)
- [x] `scripts/check-bundle-size.ts` — FOUND (contains 0.25, 0.10, D-16, --update-baseline)
- [x] `.size-baseline.json` — FOUND (content: {})
- [x] `docs/runbooks/github-setup.md` — FOUND (contains "branch protection", DOPPLER_CI_TOKEN)
- [x] `docs/runbooks/vps-provisioning.md` — FOUND (contains "8 GB", "4 GB", "swap")
- [x] `docs/runbooks/local-dev.md` — FOUND, updated (contains "Bundle-size")

**Commits exist:**
- [x] d1847b8 — feat(01-05): github actions pr+main pipelines + dependabot + parity checks (Task 5.1)
- [x] c7442df — feat(01-05): __NEXT_DATA__ secret audit + bundle-size growth gate (Task 5.2)

**Verification:**
- [x] `bash scripts/check-claude-md-parity.sh` exits 0
- [x] No `echo.*$TOKEN` patterns in workflow files (T-01-010)
- [x] All action `uses:` refs pinned to @v4 or @v3 (dopplerhq)
- [x] No placeholder text (TODO, Coming soon, Lorem ipsum, [insert]) in any file
- [x] .size-baseline.json tracked in git (removed from .gitignore)
