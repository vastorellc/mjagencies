# Phase 3: Auth + SSO + Edge Routing - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Mode:** Auto-generated (workflow.skip_discuss=true)

<domain>
## Phase Boundary

Secure auth, Cloudflare routing, MFA, audit log, server-action auth pattern locked into the codebase.

**Success criteria (from ROADMAP):**
1. Login, token refresh, logout all work with `jose`-only JWTs
2. Expired refresh token replay forces logout + family revocation
3. Cloudflare routes agency subdomains correctly; `/(payload)/admin` and `/api/*` are excluded from middleware matcher
4. Audit log row hashes verified (Phase 2 hash-chain triggers)
5. Next.js >= 15.2.3 confirmed (CVE-2025-29927 patch); CI gate active
6. MFA enforced for super_admin + admin; recovery codes stored bcrypt; agency owner cannot self-delete

**Requirements covered:** REQ-020..031, REQ-300, REQ-308, REQ-309, REQ-310, REQ-400, REQ-408, REQ-424

**Plan stubs from ROADMAP:**
- 03-01: JWT (jose) — access 15min, refresh 7d one-time-use with family revocation, Redis revocation store, httpOnly+SameSite=Strict+Secure cookies
- 03-02: MFA (TOTP) + 8 one-time bcrypt-stored recovery codes
- 03-03: SSO at accounts.brand.com
- 03-04: Cloudflare middleware — subdomain routing, rate limits, security headers, exclude Payload admin + API
- 03-05: Server-action auth pattern locked in codebase + middleware pattern
- 03-06: Audit log integration + open-redirect prevention + agency-owner self-delete block

</domain>

<decisions>
## Implementation Decisions

### Locked from Phase 1+2
- JWT library: `jose` ONLY (REQ-502 — `jsonwebtoken` is BANNED, enforced by CI security-grep)
- Audit log infrastructure: hash-chained, monthly-partitioned, SHA-256 chain (Phase 2 02-06)
- `withAgencyContext()` wrapper required for any agency-scoped DB query (Phase 2 02-01/02-02)
- Agency-isolation Redis keys via `REDIS_KEY` from `@mjagency/config` (`session: (a, u) => agency:${a}:session:${u}`)
- BullMQ encrypted queue available via `@mjagency/queue` if any auth flows need queues
- 12 PgBouncer ports 6432-6443 + transaction mode (auth code MUST use `withAgencyContext`)
- Cookie names follow `__Host-` prefix convention for max security (subset of Secure+SameSite=Strict)

### Carried-over from mjagency/ specs (locked policy)
- Access token TTL: 15 minutes
- Refresh token TTL: 7 days, **one-time-use** with **token family revocation** on replay
- TOTP MFA: `otpauth` library or `@simplewebauthn/server` for WebAuthn future
- Recovery codes: 8 codes, bcrypt-stored at cost factor 12, single-use
- Cloudflare middleware: rate limits, security headers, agency subdomain extraction; `matcher` MUST exclude `/(payload)/admin` and `/api/*`
- SSO host: `accounts.brand.com` (the brand agency = web-main)
- Open-redirect prevention: `next` query param strict-allowlist, never raw redirect
- Agency owner cannot self-delete (enforced at server-action layer + DB constraint where possible)

### Claude's Discretion
All implementation specifics not locked above — JWT key rotation cadence (deferred to security-rotation runbook), MFA bypass for emergency access (super-admin only, audited), SSO state CSRF mechanism, middleware ordering. Use ROADMAP success criteria + Phase 2 patterns + CLAUDE.md §7 (security mandatory patterns).

</decisions>

<canonical_refs>
## Canonical References

### Phase 2 outputs (auth code MUST use these)
- `packages/db/src/client.ts` — `createAgencyDb`, `withAgencyContext` (REQUIRED for any DB query)
- `packages/db/src/schema/users.ts` — agency-scoped users table (RLS enforced)
- `packages/db/src/schema/sessions.ts` — agency-scoped sessions table
- `packages/db/src/audit/triggers.sql` — audit_log hash chain (auth events MUST emit audit rows)
- `packages/db/src/audit/verify-chain.ts` — audit chain verifier
- `packages/db/src/vault/store.ts` — vault helpers if auth code needs to store secrets per-tenant
- `packages/queue/src/encrypted-queue.ts` — encrypted BullMQ if any auth queue is needed
- `packages/config/src/agency-constants.ts` — `AGENCIES`, `REDIS_KEY` helpers, `SYSTEM_ACTOR_ID`

### Phase 1 outputs
- `packages/config/src/logger.ts` — Pino redact paths (auth flows MUST log via `createLogger` so JWTs are scrubbed)
- `packages/config/src/otel-node.ts` — OTel spans for auth must include `trace_id` and respect Edge runtime guard
- `apps/web-*/instrumentation.node.ts` — Edge guard pattern (auth code that runs in middleware is Edge — no Node-only imports)

### CI gates
- `.github/workflows/pr.yml` security-grep — REQ-502 (`jsonwebtoken` BANNED), REQ-503 (`NEXT_PUBLIC_*KEY` BANNED), SEC-N4
- Add a CI step to enforce Next.js >= 15.2.3 (CVE-2025-29927 patch)

### Project doctrine
- `CLAUDE.md` §7 — security mandatory patterns
- `mjagency/specs/security.md` — rotation policy + crypto rules
- `mjagency/specs/milestone-M003.md` (when present) — auth slice spec

</canonical_refs>

<specifics>
## Specific Ideas

- JWT signing key rotation: quarterly per security.md (Phase 1 secrets-rotation runbook)
- Refresh token family: each login generates a new family ID; replay of any token in family invalidates entire family
- Redis revocation store: `agency:<id>:revoked:<jti>` with TTL = remaining token lifetime
- MFA enforcement: super_admin + admin roles require MFA enabled before granting role; existing users grandfathered with 30-day grace period (audit-logged)
- Cloudflare middleware: extract agency from `Host` header (`<slug>.mjagency.com` → slug); 401 on unknown agency
- Server-action pattern: helper `requireSession()` that throws 401 if not authenticated; called as FIRST LINE of every server action

</specifics>

<deferred>
## Deferred Ideas

- WebAuthn/passkeys — defer to security-hardening (M011)
- SAML SSO for enterprise — defer to post-launch
- Password-less email-link auth — out of scope at M003
- IP allowlisting for super_admin — defer to M011
- Rate-limit-by-account (vs rate-limit-by-IP) — M011

</deferred>

---

*Phase: 03-auth-sso-edge*
*Context auto-generated: 2026-04-26 via workflow.skip_discuss=true*
