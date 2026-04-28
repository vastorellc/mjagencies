---
plan: 12-05
phase: 12-launch-qa-seeds-runbooks-sla
status: complete
wave: 1
subsystem: runbooks/ops-documentation
tags: [runbooks, operations, compliance, security, launch-readiness]
requires: []
provides: [13-operational-runbooks, incident-response-procedure, ccpa-erasure-manual-trigger, brand-setup-wizard-guide]
affects: [docs/runbooks/, .planning/phases/12-launch-qa-seeds-runbooks-sla/]
tech-stack:
  added: []
  patterns: [pgBackRest, PgBouncer, BullMQ, Cloudflare-WAF-Terraform, Doppler-secrets-rotation, Stripe-webhook-idempotency, GA4-Admin-API-deletion]
key-files:
  created:
    - docs/runbooks/incident-response.md
    - docs/runbooks/db-failover.md
    - docs/runbooks/redis-flush.md
    - docs/runbooks/cloudflare-waf-toggle.md
    - docs/runbooks/payload-backup-restore.md
    - docs/runbooks/dns-cutover.md
    - docs/runbooks/ssl-certificate-renewal.md
    - docs/runbooks/ccpa-erasure-manual.md
    - docs/runbooks/ga4-data-deletion.md
    - docs/runbooks/secrets-rotation.md
    - docs/runbooks/stripe-webhook-redeliver.md
    - docs/runbooks/bullmq-queue-drain.md
    - docs/runbooks/brand-setup-wizard.md
  modified: []
decisions:
  - "CCPA erasure manual runbook gates on confirmed identity verification before BullMQ enqueue (STRIDE T-12-05-01 mitigation)"
  - "secrets-rotation.md instructs JWT_SECRET revocation via Redis set after rotation, not just redeploy (T-12-05-02 mitigation)"
  - "bullmq-queue-drain.md has hard warning against draining ccpa-erasure queue — redirects to ccpa-erasure-manual.md (T-12-05-03 mitigation)"
  - "brand-setup-wizard.md references Phase 12-02 seed as prerequisite for deltaE check — prevents always-fail ΔE during setup"
  - "cloudflare-waf-toggle.md warns against toggling to enforcing during active canary deploy window (checks gh run list first)"
metrics:
  duration: "~45 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  files_created: 13
---

# Phase 12 Plan 05: Operational Runbooks Summary

**One-liner:** 13 operational runbooks covering incident response, DB failover, WAF toggle, CCPA 7-system erasure, secrets rotation, and 5-step brand setup wizard — all with real codebase commands and zero placeholder text.

## Summary

Created 13 new runbooks in `docs/runbooks/` covering all operational scenarios for the MJAgency platform. Each runbook follows the mandatory 5-section structure (Overview, Prerequisites, Procedure, Verification, Failure Diagnostics) with real commands and file paths from the codebase. Zero placeholder text.

## Files Created

- `docs/runbooks/incident-response.md` — P1-P4 severity matrix (5min/1h through next-biz-day/72h) + escalation + fault isolation procedure
- `docs/runbooks/db-failover.md` — pgBackRest + PgBouncer per-agency failover, RPO 1h RTO 4h, all 13 agency DB names documented
- `docs/runbooks/redis-flush.md` — agency-scoped cache flush using scan+DEL, BullMQ and Stripe idempotency key exclusions
- `docs/runbooks/cloudflare-waf-toggle.md` — WAF enforcing/log-only toggle via Terraform with active canary deploy guard check
- `docs/runbooks/payload-backup-restore.md` — CMS data backup/restore via Payload REST API + R2 + seed-payload-collections.ts + migrate-rollback.ts
- `docs/runbooks/dns-cutover.md` — custom domain CNAME + SSL Full Strict + DKIM/SPF + CAL_SUBDOMAIN Doppler update
- `docs/runbooks/ssl-certificate-renewal.md` — Cloudflare Universal SSL manual order via API with polling loop
- `docs/runbooks/ccpa-erasure-manual.md` — 7-system fan-out manual BullMQ trigger, identity verification gate, audit trail step (STRIDE T-12-05-01 and T-12-05-04)
- `docs/runbooks/ga4-data-deletion.md` — GA4 Admin API user deletion request with 63-day propagation timeline and consent_log lookup
- `docs/runbooks/secrets-rotation.md` — Doppler `doppler secrets set` for JWT/DB/Stripe/webhooks with Redis revocation list for old JWT_SECRET
- `docs/runbooks/stripe-webhook-redeliver.md` — Stripe event resend with `req.text()` raw body warning and Redis idempotency key management
- `docs/runbooks/bullmq-queue-drain.md` — queue drain with hard warnings against draining `ccpa-erasure` and `stripe-events` queues
- `docs/runbooks/brand-setup-wizard.md` — 5-step wizard walkthrough (logo/color/identity/api-keys/dns+warmup) with ΔE CIEDE2000 explanation and Phase 12-02 seed prerequisite

## CCPA Erasure — 7 System Modules

The `ccpa-erasure-manual.md` runbook documents all 7 system modules from `packages/compliance/src/erasure/`:

| Module | System |
|--------|--------|
| `delete-from-postgres.ts` | Per-agency Postgres DB |
| `delete-from-redis.ts` | Redis (sessions, cache, job results) |
| `delete-from-r2.ts` | Cloudflare R2 (media, documents) |
| `ga4-delete.ts` | Google Analytics 4 |
| `litellm-delete.ts` | LiteLLM / AI conversation history |
| via `packages/analytics` | Microsoft Clarity |
| via `packages/meta-capi` | Meta Conversions API |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

All 13 files present. Each has 5 mandatory sections. No placeholder text found.

- Placeholder check result: 1 match in `brand-setup-wizard.md` — this is a quote of CLAUDE.md §5 instructing operators not to use placeholder text (not actual placeholder content).
- All acceptance criteria from the PLAN.md task definitions pass.

## Self-Check: PASSED

- All 13 files confirmed present at `docs/runbooks/`
- Commit `0a9389e` confirmed in git log
- All 5 sections present in each runbook (verified via grep -c)
- CCPA erasure module filenames confirmed against actual `packages/compliance/src/erasure/` directory
- Brand setup wizard Steps 1-5 all present
- ΔE/CIEDE2000 references present in brand-setup-wizard.md
- `req.text()` warning in stripe-webhook-redeliver.md
- `ccpa-erasure` drain warning in bullmq-queue-drain.md
- `enable_enforcing` Terraform var in cloudflare-waf-toggle.md
- `RPO 1h, RTO 4h` in db-failover.md
