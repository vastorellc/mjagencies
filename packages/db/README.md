# @mjagency/db

Database access layer for MJAgency. At M001, this package exports connection-string helpers and the agency → port → role mapping consumed by every app's environment.

The Drizzle ORM wrapper, schema definitions, RLS policy hooks, and `/* trace_id=<id> */` query-comment middleware land in M002 (Phase 2). Until then, downstream consumers should:

- Use `agencyConnection(slug)` and `buildDatabaseUrl(slug, password)` from this package to construct DATABASE_URL strings.
- Source the password from Doppler (`<UPPER>_DB_PASSWORD`); never hardcode.

## CRITICAL: PgBouncer transaction-mode prepared-statement compatibility

PgBouncer at M001 runs in **transaction mode** with `pool_size=20`. Drizzle creates server-side prepared statements by default; in transaction mode each query may land on a different physical Postgres connection, causing:

```
ERROR: prepared statement "<name>" does not exist
```

Mitigations applied at M001:

- All 12 PgBouncer `.ini` files set `max_prepared_statements = 100` (PgBouncer 1.21+ tracks protocol-level prepared statements within transaction mode per connection).
- The Drizzle wrapper added at M002 will pass `prepare: false` on the postgres-js client OR opt into PgBouncer 1.21+ built-in prepared-statement support, depending on the Drizzle version available at that time.

Source: [pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode](https://pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode)

## Port Layout

| Agency | Database | Role | PgBouncer port |
|--------|----------|------|----------------|
| brand | `brand_db` | `brand_user` | 6432 |
| ecommerce | `ecommerce_db` | `ecommerce_user` | 6433 |
| growth | `growth_db` | `growth_user` | 6434 |
| webdev | `webdev_db` | `webdev_user` | 6435 |
| ai | `ai_db` | `ai_user` | 6436 |
| branding | `branding_db` | `branding_user` | 6437 |
| strategy | `strategy_db` | `strategy_user` | 6438 |
| finance | `finance_db` | `finance_user` | 6439 |
| engineering | `engineering_db` | `engineering_user` | 6440 |
| product | `product_db` | `product_user` | 6441 |
| video | `video_db` | `video_user` | 6442 |
| graphic | `graphic_db` | `graphic_user` | 6443 |

Port 6444 is reserved for the M002 platform-shared admin connection.

## Usage

```typescript
import { agencyConnection, buildDatabaseUrl } from '@mjagency/db'

// Get connection metadata (no password — source from Doppler)
const conn = agencyConnection('ecommerce')
// { agencySlug: 'ecommerce', pgbouncerPort: 6433, dbName: 'ecommerce_db', role: 'ecommerce_user' }

// Build DATABASE_URL for PgBouncer pool
const url = buildDatabaseUrl('ecommerce', process.env.ECOMMERCE_DB_PASSWORD!)
// 'postgresql://ecommerce_user:***@127.0.0.1:6433/ecommerce_db'
```

## Roadmap

| Milestone | Capability |
|-----------|------------|
| M001 (current) | Connection helpers, port/role constants |
| M002 | Drizzle ORM wrapper, schema, migrations, RLS hooks, trace_id SQL comment middleware |
| M003+ | Per-agency schema evolution, tenant-scoped migration runner |
