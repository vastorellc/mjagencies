# @mjagency/db

Database layer for all MJAgency apps. Uses Drizzle ORM with per-agency PostgreSQL databases accessed through PgBouncer (transaction mode, pool_size=20). Exports a trace_id injection wrapper (SQL comment middleware) and the Drizzle client factory. M002 (Multi-tenant DB + Migration Orchestrator) fills this package with the full schema, migration runner, and RLS policy helpers. At M001 this is a typed stub with the interface contract so Plan 01-02 can build against it.
