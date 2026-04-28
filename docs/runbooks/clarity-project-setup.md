# Microsoft Clarity Project Setup — Per-Agency Runbook

REQ-141 (Plan 11-02). One Clarity project per agency: 12 + 1 brand.com = **13 projects** total.

## Prerequisites

- Access to https://clarity.microsoft.com (sign in with the MJAgency Microsoft work account)
- Doppler access to write per-agency env vars (one set per app)

## Per-agency dashboard configuration (clarity.microsoft.com)

For EACH of the 13 projects, after creation, set the following:

### 1. Mask Mode = `Strict` (Settings → Privacy → Mask Mode)

- **Reason:** D-decision (mask all PII fields by default). Whitelisting is opt-in via CSS classes.
- **Pitfall 2.2 from RESEARCH:** Strict mode masks `<title>` and `<h1>` text. To preserve the
  Top Pages report, whitelist the following selectors via Settings → Whitelisted Selectors:
  ```
  title, h1, h2.clarity-allow
  ```
  Add `class="clarity-allow"` to non-PII headings (e.g. service names, blog titles) when
  the page-author wants the heading to appear in Clarity reports.
- **Threat mitigation:** T-11-02-01 (PII via DOM scraping).

### 2. Capture network requests = `OFF` (Settings → Privacy → Network)

- **Reason:** Pitfall 2.4 from RESEARCH — prevents Stripe payment payloads from leaking
  even with DOM masking. Network capture is independent of Mask Mode.
- **Threat mitigation:** T-11-02-02 (network XHR leakage).

### 3. Project ID is public — copy to per-agency `.env.local`

```
NEXT_PUBLIC_CLARITY_PROJECT_ID=<id>
```

Project IDs are public by design (the Clarity script reads them from the page) — analogous
to GA4 Measurement IDs. No Doppler-secret protection needed for the ID itself.

### 4. Generate Clarity API token (Settings → Data Export → Live API)

```
CLARITY_API_TOKEN_${SLUG_UPPER}=<token>
```

Where `SLUG_UPPER = agencyId.replaceAll('-','_').toUpperCase()`:

- `web-ecommerce` → `CLARITY_API_TOKEN_WEB_ECOMMERCE`
- `web-realestate` → `CLARITY_API_TOKEN_WEB_REALESTATE`
- `web-healthcare` → `CLARITY_API_TOKEN_WEB_HEALTHCARE`
- `web-legal` → `CLARITY_API_TOKEN_WEB_LEGAL`
- `web-homeservices` → `CLARITY_API_TOKEN_WEB_HOMESERVICES`
- `web-fitness` → `CLARITY_API_TOKEN_WEB_FITNESS`
- `web-dental` → `CLARITY_API_TOKEN_WEB_DENTAL`
- `web-automotive` → `CLARITY_API_TOKEN_WEB_AUTOMOTIVE`
- `web-restaurant` → `CLARITY_API_TOKEN_WEB_RESTAURANT`
- `web-education` → `CLARITY_API_TOKEN_WEB_EDUCATION`
- `web-financial` → `CLARITY_API_TOKEN_WEB_FINANCIAL`
- `web-petcare` → `CLARITY_API_TOKEN_WEB_PETCARE`
- `web-main` → `CLARITY_API_TOKEN_WEB_MAIN`

**Server-only.** Used by `clarityDeleteUser()` in `packages/analytics/src/clarity-delete.ts`
(Plan 11-05 CCPA opt-out + erasure workers).

**Threat mitigation:** T-11-02-03 (token leakage). Never set as `NEXT_PUBLIC_*`.

## env var summary (Doppler)

Per-agency (13 sets):

| Var | Scope | Purpose |
|-----|-------|---------|
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Browser | Loaded by `<ClarityInit>` |
| `CLARITY_API_TOKEN_${SLUG_UPPER}` | Server | Used by `clarityDeleteUser()` |

## Verification

After deploy, on each of the 13 public agency hosts:

1. **Consent allowed (default-on under CCPA):**
   - Open the public homepage → DevTools Network tab.
   - Filter on `clarity` — there should be requests to `clarity.ms` and one of `*.clarity.ms`.
   - DevTools Console should show no Clarity-related errors.
   - In the Clarity dashboard (Live), the session should appear within ~30 seconds.

2. **Consent denied (`mj_consent=tracking_blocked` cookie):**
   - Set the cookie via DevTools → Application → Cookies → add `mj_consent=tracking_blocked`.
   - Reload the page.
   - DevTools Network tab → filter on `clarity` — there should be **zero** requests to `clarity.ms`.
   - This validates D-01/D-02 SSR consent gating.

3. **PII masking (Mask Mode = Strict):**
   - In the Clarity dashboard, open a recent session recording.
   - Form input values (email, phone, etc.) should appear as masked text (●●●●).
   - Headings should be visible (because of the whitelist in step 1).

4. **Network capture OFF:**
   - In the Clarity dashboard, open a recent session recording.
   - The Network tab inside Clarity should be empty for that session — no XHR/fetch payloads
     captured.

## Delete API smoke test (one-time per agency)

Run after Plan 11-05 ships, using a known-good `clarityUserId`:

```ts
import { clarityDeleteUser } from '@mjagency/analytics'
const r = await clarityDeleteUser('web-ecommerce', '<clarity-user-id>')
console.log(r) // { ok: true, status: 200 }
```

A 401/403 means `CLARITY_API_TOKEN_WEB_ECOMMERCE` is missing or wrong.
A 404 means the userId is not present in this project (expected for unknown IDs).
