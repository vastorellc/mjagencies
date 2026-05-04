---
phase: 02-settings-social-oauth
slug: settings-social-oauth
date: 2026-05-01
---

# Phase 2 Validation Strategy

Maps each SETTINGS-NN requirement to its automated verification command and the
plan that owns the test file. Every requirement has at least one `<automated>`
command runnable from the repo root.

Requirement source: `.planning/REQUIREMENTS.md` (SETTINGS-01 through SETTINGS-10).

---

## SETTINGS-01 — Encrypted AI key (AES-256-GCM per user, masked response)

**Owner plan:** 02-01 (encryption primitives), 02-02 (settings route + masking)
**Test files:**
- `backend/tests/encryption.test.ts` (created in 02-01)
- `backend/tests/settings.test.ts` (created in 02-02)

<automated>cd backend &amp;&amp; npm test -- encryption settings</automated>

<manual>
Manual smoke (post-deploy or post-checkpoint):
```
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"api_key":"sk-test-roundtrip-1234"}' http://localhost:3001/api/settings | jq .api_key_masked
# Expect: "****1234" (NOT the plaintext)
```
Then in Supabase SQL editor:
```sql
SELECT api_key_encrypted FROM settings WHERE user_id = '<your-uid>';
-- Expect: base64 ciphertext, NOT 'sk-test-roundtrip-1234'
```
</manual>

---

## SETTINGS-02 — Default niche selection

**Owner plan:** 02-02 (PATCH /api/settings)
**Test file:** `backend/tests/settings.test.ts`

<automated>cd backend &amp;&amp; npm test -- settings</automated>

<manual>
SettingsPage shows the Default Niche `<select>` with all NICHES options.
Changing it triggers `PATCH /api/settings` and the value persists across page reload.
</manual>

---

## SETTINGS-03 — Platform toggles (YouTube / Instagram / Facebook / TikTok / X)

**Owner plan:** 02-02 (enabled_platforms PATCH), 02-06 (toggle UI)
**Test file:** `backend/tests/settings.test.ts` (test 5)

<automated>cd backend &amp;&amp; npm test -- settings</automated>

<manual>
Toggle each checkbox in SettingsPage Connections section. Confirm the new array
is reflected in `GET /api/settings.enabled_platforms` after PATCH.
</manual>

---

## SETTINGS-04 — YouTube via Google OAuth 2.0 (server-side redirect)

**Owner plan:** 02-03 (auth-google.ts + oauth-google.ts)
**Test file:** `backend/tests/oauth-google.test.ts`

<automated>cd backend &amp;&amp; npm test -- oauth-google</automated>

<manual>
End-to-end smoke (Plan 02-07 Task 2 Scenario 1):
1. Click "Connect" next to YouTube on SettingsPage.
2. Browser navigates to `accounts.google.com/o/oauth2/v2/auth` (full-page, NOT popup).
3. Approve consent — browser returns to `?screen=settings&connected=youtube`.
4. DB row's `platform_config -> 'youtube'.access_token` is base64 ciphertext.
</manual>

---

## SETTINGS-05 — Instagram OAuth (2025 scopes)

**Owner plan:** 02-04 (auth-meta.ts Instagram + oauth-meta.ts)
**Test file:** `backend/tests/oauth-meta.test.ts` (tests 1-4)

<automated>cd backend &amp;&amp; npm test -- oauth-meta</automated>

<manual>
End-to-end smoke (Plan 02-07 Task 2 Scenario 2):
1. Click "Connect" next to Instagram on SettingsPage. (Account must be Business or Creator.)
2. Browser navigates to `api.instagram.com/oauth/authorize` with scope
   `instagram_business_basic,instagram_business_content_publish`.
3. Approve — browser returns to `?screen=settings&connected=instagram`.
4. PERSONAL accounts redirect to `error=instagram_personal_account` (Pitfall 4).
</manual>

---

## SETTINGS-06 — page_id + page_access_token (Facebook Reels)

**Owner plan:** 02-04 (auth-meta.ts Facebook + oauth-meta.ts)
**Test file:** `backend/tests/oauth-meta.test.ts` (tests 5-7)

<automated>cd backend &amp;&amp; npm test -- oauth-meta</automated>

<manual>
End-to-end smoke (Plan 02-07 Task 2 Scenario 3 + 3b):
1. Connect Facebook with a user that has at least one Page → `platform_config.facebook`
   contains encrypted `access_token`, plain `page_id`, and `expiry`.
2. Connect Facebook with a user that has NO Page → `platform_config.facebook =
   { setup_required: true }` and the UI shows the yellow "Setup Required" banner.
</manual>

---

## SETTINGS-07 — Weekly pg-boss job refreshes 60-day Meta long-lived token

**Owner plan:** 02-05 (meta-refresh.ts)
**Test file:** `backend/tests/meta-refresh.test.ts`

<automated>cd backend &amp;&amp; npm test -- meta-refresh</automated>

<manual>
Backend startup logs include:
`[pg-boss] meta-token-refresh job registered (cron: 0 9 * * 1)`

Restart `npm run dev` — second start does NOT throw (duplicate-key swallowed).
</manual>

---

## SETTINGS-08 — TikTok greyed out "Pending API approval"

**Owner plan:** 02-06 (SettingsPage.tsx)
**Test:** Static grep on the rendered component.

<automated>grep -q "Pending API approval" frontend/src/pages/SettingsPage.tsx</automated>

<manual>
SettingsPage renders the TikTok row with reduced opacity and the text
"Pending API approval"; no Connect button is present.
</manual>

---

## SETTINGS-09 — Disconnect platform (token cleared from DB)

**Owner plan:** 02-02 (DELETE /api/settings/connections/:platform)
**Test file:** `backend/tests/settings.test.ts` (test 6)

<automated>cd backend &amp;&amp; npm test -- settings</automated>

<manual>
1. Connect YouTube → `platform_config -> 'youtube'` is non-null.
2. Click Disconnect → DELETE returns `{ ok: true }`.
3. `platform_config -> 'youtube'` is now `null`. Other platforms unaffected
   (verifies JSONB merge, not full-column replace).
</manual>

---

## SETTINGS-10 — Timezone fixed to PKT (Asia/Karachi)

**Owner plan:** 02-02 (response shape), 02-06 (display)
**Test files:**
- `backend/tests/settings.test.ts` (response shape)
- Static grep on the SettingsPage

<automated>cd backend &amp;&amp; npm test -- settings &amp;&amp; grep -q "Asia/Karachi" frontend/src/pages/SettingsPage.tsx</automated>

<manual>
SettingsPage Timezone section displays "Asia/Karachi (Pakistan Standard Time, fixed)".
No editable control — read-only.
</manual>

---

## Phase Gate Command

A single command that exercises every requirement's automated path:

```
cd backend && npm test && cd ../frontend && npx tsc --noEmit && npm run build && \
  grep -q "Pending API approval" frontend/src/pages/SettingsPage.tsx && \
  grep -q "Asia/Karachi" frontend/src/pages/SettingsPage.tsx
```

This must exit 0 before `/gsd-verify-work 2` is invoked.

---

## Test File Ownership Matrix

| Test File | Created By | Used By |
|-----------|-----------|---------|
| `backend/tests/encryption.test.ts` | 02-01 | — |
| `backend/tests/oauth-state.test.ts` | 02-01 | — |
| `backend/tests/_helpers.ts` (pg-mem fixture) | 02-02 | 02-03, 02-04, 02-05 |
| `backend/tests/settings.test.ts` | 02-02 | — |
| `backend/tests/oauth-google.test.ts` | 02-03 | — |
| `backend/tests/oauth-meta.test.ts` | 02-04 | — |
| `backend/tests/meta-refresh.test.ts` | 02-05 | — |
| `.planning/phases/02-settings-social-oauth/02-VERIFICATION.md` | 02-07 | `/gsd-verify-work 2` |
