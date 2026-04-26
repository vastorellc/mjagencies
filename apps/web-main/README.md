# apps/web-main

`accounts.brand.com` — the brand agency app (Next.js 15, port 3000). This app hosts the ONE login surface for all 12 MJAgency subdomain portals (REQ-026) plus the Payload CMS admin at `/admin`.

## SSO at accounts.brand.com (Plan 03-03)

### Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/sso` | GET | Login form server component. Reads `?agency`, `?state`, `?returnTo` from query params. Validates `agency` against `AGENCIES`; renders 404 for unknown slugs. |
| `/api/sso/exchange` | POST | **Server-to-server only.** Exchanges a single-use opaque code for `{ accessToken, refreshToken }`. See internal-header gate below. |
| `/api/auth/login` | POST | Direct login (no SSO state) or SSO entry path (when `state` param present). |
| `/api/auth/logout` | POST | Revokes the token family + clears auth cookies. |
| `/api/auth/refresh` | POST | Rotates the refresh token via `rotateRefreshToken`; 401 on replay. |

### SSO Flow

```
1. User visits ecommerce.brand.com/some-page (unauthenticated)
2. Middleware 302 → accounts.brand.com/sso?agency=ecommerce&state=<hmac-signed>&returnTo=<encoded>
3. User fills login form → POST /api/auth/login { email, password, agency, state, returnTo }
4. Login route validates credentials → createSsoCode → 302 to ecommerce.brand.com/auth/callback?code=<opaque>&state=<signed>
5. Agency callback route verifies state (verifySsoState) → POST accounts.brand.com/api/sso/exchange { code }
6. Exchange route validates internal header → redeemSsoCode → returns { accessToken, refreshToken }
7. Callback route sets __Host- cookies → redirects to returnTo
```

### Redis Namespace

SSO codes use the **platform-shared** namespace `accounts:sso:code:<codeId>`:

```
accounts:sso:code:<32-hex-codeId>  → JSON SsoCodePayload  (TTL: 60 seconds)
```

This is intentionally NOT per-agency. The exchange happens cross-agency: `ecommerce.brand.com` calls `accounts.brand.com/api/sso/exchange`, so the code must be visible to the accounts app regardless of which agency originated the SSO.

Per-agency session namespace (`agency:<id>:session:*`) continues to apply for refresh tokens, token families, and revocation lists.

### Internal-Header Gate on /api/sso/exchange

`POST /api/sso/exchange` requires:

```
x-mjagency-internal: <SSO_INTERNAL_TOKEN>
```

This header is checked **before body parsing** (T-03-012 mitigation). In production, Cloudflare Access policy additionally restricts the endpoint to internal cluster IPs — the header is a defense-in-depth layer, not the only barrier.

### Dev-Only Login Fallback

**Production returns 501** from `/api/auth/login` without checking any credentials (T-03-013). The production login path is intentionally gated until the `users.password_hash` column ships in a later phase (Phase 5+).

In non-production environments, set these env vars for a working login:

```env
LOGIN_DEV_USER_EMAIL=admin@example.com
LOGIN_DEV_USER_PASSWORD=changeme
LOGIN_DEV_USER_ID=<uuid>   # the user UUID to issue tokens for
```

### Open-Redirect Inline Check

`/api/auth/login` currently validates `returnTo` with an inline same-origin check:

```ts
new URL(returnTo, origin).origin !== origin → '/dashboard'
```

Plan 03-06 ships the canonical `validateReturnTo()` helper. Once 03-06 lands, the inline check will be replaced.

### Required Env Vars (SSO)

| Variable | Description |
|----------|-------------|
| `SSO_STATE_SECRET` | 64-byte hex HMAC key for signing SSO state tokens. `openssl rand -hex 64`. |
| `SSO_INTERNAL_TOKEN` | Shared secret for the `/api/sso/exchange` internal-header gate. |
| `ACCOUNTS_HOST` | Hostname for accounts.brand.com (default: `accounts.brand.com`). |
| `ACCOUNTS_HOST_PARENT` | Parent domain for agency subdomains (default: `brand.com`). |
| `LOGIN_DEV_USER_EMAIL` | Dev-only login email (non-production only). |
| `LOGIN_DEV_USER_PASSWORD` | Dev-only login password (non-production only). |
| `LOGIN_DEV_USER_ID` | Dev-only user UUID (non-production only). |
| `DB_APP_PASSWORD` | Password for the per-agency DB connection (used by `/api/auth/refresh`). |
