# Phase 2: Multi-tenant DB + Migration - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Per-agency Postgres with migrations, seed framework, backup automation, permissions vault, hash-chained audit log.

**Success criteria (from ROADMAP):**
1. Migration runs clean across all 13 DBs (parallel, dry-run, canary, rollback verified)
2. `seed --agency=ecommerce` completes without error and is resumable on failure
3. RLS blocks cross-agency queries (integration test)
4. Backup restore to staging completes successfully (quarterly DR runbook)
5. Audit log row hashes verify (hash chain intact, append-only enforced)
6. BullMQ payloads with sensitive data are AES-GCM-256 encrypted before Redis write

**Requirements covered:** REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-306, REQ-407, REQ-425

**Plan stubs from ROADMAP:**
- 02-01: Drizzle schema design — all base tables with `agency_id` + RLS + `agency_id` immutable access rule
- 02-02: PgBouncer per-agency config (transaction mode, pool_size=20, ports 6432–6444) + PM2 supervision
- 02-03: Migration runner — parallel, per-agency, dry-run, canary stage, rollback path
- 02-04: Seed framework — per-agency, transactional, resume on fail
- 02-05: Backup automation — WAL streaming, hourly snapshots, R2 upload, quarterly DR drill
- 02-06: Permissions vault schema (encrypted, 7yr retention) + audit log (hash-chained, append-only)

</domain>

<decisions>
## Implementation Decisions

### Locked from Phase 1
- 13 logical DBs in shared Postgres 17 instance (not 13 separate processes) — D-04
- 12 PgBouncer instances on ports 6432-6443 in transaction mode, max_prepared_statements=100 — D-05
- `packages/db` provides typed connection helpers (`agencyConnection`, `buildDatabaseUrl`, `allAgencyConnections`) — Wave 2 deliverable
- Agency-isolation Redis keys via `REDIS_KEY` helper from `@mjagency/config` — REQ pattern
- BullMQ queue payload encryption: AES-GCM-256 via `BULLMQ_ENCRYPTION_KEY` (Doppler-managed)
- Pino logger with redaction paths covers DB query trace_id injection per OTel autoinstrument-pino

### Carried-over from Phase 1 mjagency/ specs
- ORM: Drizzle (per CLAUDE.md — chosen over Prisma)
- Migration tool: Drizzle-kit + custom runner that wraps it for parallel × 13
- Audit log: hash-chain with `prev_hash` per row; append-only enforced via Postgres trigger; 7-year retention
- Permissions vault: `permissions_vault` table with AES-GCM-256 encrypted `value` column
- RLS: every base table has `agency_id` UUID column + RLS policy `agency_id = current_setting('app.agency_id')::uuid`
- `agency_id` immutable: trigger rejects UPDATE that changes `agency_id`

### Claude's Discretion
All implementation choices not explicitly locked above — table structure beyond `agency_id`, indexing strategy, migration ordering, seed factory patterns, backup retention bands beyond hourly+quarterly, BullMQ queue naming. Use ROADMAP success criteria, codebase conventions from Phase 1, and `mjagency/specs/` content where present.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 outputs (workspace conventions)
- `packages/config/src/agency-constants.ts` — canonical 12 agency slugs + `AGENCY_PORTS` map
- `packages/config/src/logger.ts` — Pino redact paths + edgeLog
- `packages/db/src/connection.ts` — `agencyConnection`, `buildDatabaseUrl`, `allAgencyConnections`
- `packages/db/README.md` — pitfall 3.3 (PgBouncer prepared statements + Drizzle `prepare: false`)
- `infra/postgres/init.sql.tmpl` — bootstrap pattern for 13 DBs + 13 roles
- `infra/pgbouncer/pgbouncer.<slug>.ini` — transaction-mode config pattern
- `ecosystem.config.cjs` — PM2 supervision pattern
- `docs/runbooks/local-dev.md` — local stack reference

### Project doctrine
- `CLAUDE.md` and `mjagency/CLAUDE.md` — full project rules (parity-checked in CI)
- `PROJECT.md` and `mjagency/PROJECT.md` — project goals
- `mjagency/specs/security.md` — encryption/rotation policy

### CI gates that constrain Phase 2
- `.github/workflows/pr.yml` security-grep — REQ-501/502/503/SEC-N4 enforcement
- `scripts/scan-next-data.ts` — `__NEXT_DATA__` audit (Phase 2 must not serialize secrets)

</canonical_refs>

<specifics>
## Specific Ideas

- Migration runner should accept `--agency=<slug>` AND `--all` modes; parallel-by-default with `--sequential` opt-out
- Seed framework should be **resumable** — track which seed steps completed per agency in a `_seed_state` table inside each agency DB
- Backup target: R2 bucket via `@mjagency/media`'s R2 client; hourly snapshots, daily retained 30 days, weekly retained 90 days, quarterly retained 7 years
- Audit log hash chain: SHA-256 of `(prev_hash || row_data || timestamp)`; verification script walks chain end-to-end
- BullMQ encryption: encrypt `data` field of every job before `add()`; decrypt in worker; key from `BULLMQ_ENCRYPTION_KEY` env

</specifics>

<deferred>
## Deferred Ideas

- Cross-region replication (M012+ — single VPS at M001-M011 per CONTEXT D-01)
- Per-agency separate Postgres clusters (defer to scaling milestone — D-04 chose shared instance)
- Audit log archiving to cold storage (M012 — backup runbook covers retention)
- pgaudit extension (consider in M011 hardening — Phase 2 uses application-layer audit)

</deferred>

---

*Phase: 02-multi-tenant-db*
*Context auto-generated: 2026-04-26 via workflow.skip_discuss=true*
