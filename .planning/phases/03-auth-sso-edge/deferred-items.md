# Phase 03 — Deferred Items

## Pre-existing TypeScript errors (out-of-scope for 03-01)

Discovered during `pnpm --filter=@mjagency/auth typecheck` — these errors exist on the base
commit (78e3c60) before any 03-01 changes and are not caused by this plan.

| File | Error | Notes |
|------|-------|-------|
| `packages/config/src/otel-node.ts:7` | `ATTR_SERVICE_NAMESPACE` not in `@opentelemetry/semantic-conventions` | OTel package version mismatch — out of scope for auth work |
| `packages/config/src/otel-node.ts:8` | `ATTR_DEPLOYMENT_ENVIRONMENT_NAME` not in `@opentelemetry/semantic-conventions` | Same |
| `packages/db/src/schema/permissions-vault.ts:42` | `SQL<unknown>` not assignable to `PgPolicyToOption` | Drizzle pgPolicy typing — pre-existing |
| `packages/db/src/schema/sessions.ts:33` | Same pgPolicy typing | Pre-existing |
| `packages/db/src/schema/users.ts:34` | Same pgPolicy typing | Pre-existing |

These should be resolved in a dedicated Phase 03 or Phase 04 chore task before production deployment.
