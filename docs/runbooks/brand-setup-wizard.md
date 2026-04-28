# Brand Setup Wizard Runbook

**Audience:** Agency account managers, agency owners completing post-generate setup
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/dns-cutover.md`, `docs/runbooks/clarity-project-setup.md`, `docs/runbooks/ssl-certificate-renewal.md`

---

## Overview

This runbook is a complete walkthrough of all 5 Brand Setup Wizard steps at `/admin/brand-setup`. The wizard must be completed once per agency before the agency's public site goes live. It covers logo upload, brand color selection, identity fields, API key configuration, and DNS + warmup.

**Access requirement:** `super_admin` role in Payload admin (`/admin/login`). The wizard is not accessible to non-admin roles.

**Complete order:** Steps 1-5 must be completed in sequence. The wizard saves progress at each step — if interrupted, resuming at `/admin/brand-setup` returns to the last incomplete step.

**Prerequisite — Phase 12-02 seeds must have been run first:** The ΔE brand color check in Step 2 compares the chosen color against seeded hero images in Payload. If the seed run was not completed, the ΔE check will always fail. Confirm: `curl -s "https://web-{slug}.mjagency.com/api/health" | jq '.seedComplete'` — expected: `true`.

---

## Prerequisites

### Required access
- `super_admin` session: log in at `https://web-{slug}.mjagency.com/admin/login`
- Agency brand assets ready:
  - Logo file (SVG, PNG, or JPG — max 2 MB)
  - Primary brand color (hex code, e.g., `#2563EB`)
- Agency identity content:
  - Tagline (max 80 characters)
  - About text (max 500 characters)
  - Phone number in +1 format (e.g., `+1 (555) 123-4567`)
  - Business address (street, city, state, zip)
- Optional API credentials (obtain from provider dashboards):
  - GA4 Measurement ID (format: `G-XXXXXXXXXX`) — from Google Analytics Admin
  - Microsoft Clarity Project ID — from `https://clarity.microsoft.com`
  - Meta Pixel ID — from Meta Business Manager → Events Manager

### Pre-wizard checklist

```bash
# 1. Confirm admin login is accessible
curl -s -o /dev/null -w "%{http_code}" "https://web-{slug}.mjagency.com/admin/login"
# Expected: 200

# 2. Confirm Phase 12-02 seed completed
curl -s "https://web-{slug}.mjagency.com/api/health" | jq '.seedComplete'
# Expected: true

# 3. Confirm logo file is within size limits
ls -lh /path/to/logo.svg  # or .png / .jpg
# Must be < 2 MB
```

---

## Procedure

### Step 1 — Logo Upload

**URL:** `https://web-{slug}.mjagency.com/admin/brand-setup` → Step 1 of 5

1. Drag-and-drop the logo file onto the upload zone, or click "Browse Files" to select it.
   Accepted formats: SVG, PNG, JPG. Maximum file size: 2 MB.

2. **SVG files are automatically sanitized:** When an SVG is uploaded, the platform runs it through DOMPurify (server-side, jsdom) and SVGO before saving (CLAUDE.md §7 — mandatory SVG sanitization). No action required from the user — this happens automatically in the background.

3. The uploaded logo appears in the **120×120 preview container** on the right side of the upload zone. Verify the logo looks correct in the preview (correct colors, not cropped, transparent background if needed).

4. If the logo looks wrong (cropped, wrong aspect ratio), prepare a square-cropped version of the file and re-upload.

5. Click **"Next: Colors"** to proceed to Step 2.

**If upload fails with "File type not supported":**
- Confirm the file extension matches the MIME type. Some exported files have incorrect extensions.
- Convert PNG to a proper PNG using an image editor (avoid "Save As PNG" from a PDF export).

**If upload fails with "File too large":**
- Compress the PNG using `pngquant logo.png --output logo-compressed.png`
- For SVG: run `npx svgo logo.svg -o logo-optimized.svg` locally before uploading.

### Step 2 — Brand Color

**URL:** Step 2 of 5 — Brand Color

1. Use the color picker to select the primary brand color, or type the hex code directly in the text field (e.g., `#2563EB`).

2. Click "Check Color" to run the **ΔE (CIEDE2000) check**. The platform compares the chosen color against the seeded hero images for this agency's niche. This check takes 2-5 seconds.

3. **ΔE check outcomes:**
   - **ΔE ≥ 30 (pass):** Green checkmark appears. The brand color is visually distinct from the seeded imagery — no niche confusion risk. Proceed.
   - **ΔE < 30 (warning):** Yellow warning appears: "This color is too similar to your niche imagery. Consider adjusting to a more distinct color." The brand may blend into the hero images and reduce visual hierarchy. Adjust the color and re-check.

4. If the ΔE warning appears but the agency insists on the color, click **"Use Anyway"** to override the warning and proceed. This is recorded in the brand profile.

5. Click **"Next: Identity"** to proceed to Step 3.

**ΔE calculation reference:** Uses the `deltaE` npm package (CIEDE2000 formula). A ΔE of 30+ represents a clearly distinguishable color pair to the human eye. Values below 30 indicate perceptually similar colors.

### Step 3 — Identity Fields

**URL:** Step 3 of 5 — Identity

All fields are required. Fill in:

| Field | Format | Example | Validation |
|-------|--------|---------|------------|
| Tagline | Plain text, max 80 chars | "Denver's Most Trusted Plumber" | Required, ≤ 80 chars |
| About | Plain text, max 500 chars | "Acme Plumbing has served Denver since 1998..." | Required, ≤ 500 chars |
| Phone | +1 format | `+1 (303) 555-0100` | US phone format only |
| Address | Street + City + State + Zip | `123 Main St, Denver, CO 80201` | Required |

1. Fill in all four fields. Character counts are shown below the Tagline and About fields.

2. Phone format enforcement: the field accepts `+1 (555) 123-4567`, `+1-555-123-4567`, or `5551234567` (auto-formatted to `+1 (555) 123-4567` on save).

3. Click **"Next: API Keys"** to proceed to Step 4.

**CLAUDE.md §5 — Content-complete rule:** Do not enter placeholder text ("TBD", "Coming soon", "Lorem ipsum"). All fields must contain real content before launch.

### Step 4 — API Keys

**URL:** Step 4 of 5 — API Keys

All three API key fields are optional. If the agency does not use a particular analytics tool, leave that field blank.

| Field | Format | Where to find | Notes |
|-------|--------|---------------|-------|
| GA4 Measurement ID | `G-XXXXXXXXXX` | Google Analytics Admin → Property → Data Streams | Required for GA4 analytics |
| Clarity Project ID | Alphanumeric string, ~10 chars | `https://clarity.microsoft.com` → Settings → Project ID | Required for session recordings |
| Meta Pixel ID | 15-16 digit number | Meta Business Manager → Events Manager → Pixel | Required for Meta CAPI |

1. Enter the GA4 Measurement ID in the `G-XXXXXXXXXX` format. The wizard validates the format client-side before submission.

2. Enter the Clarity Project ID. Reference `docs/runbooks/clarity-project-setup.md` for Clarity project creation instructions.

3. Enter the Meta Pixel ID (numeric only).

4. Keys are stored in **Doppler, not in the database** — they are never exposed as `NEXT_PUBLIC_` variables (CLAUDE.md §7). The wizard calls a server action to write the keys directly to Doppler via the Doppler API.

5. Click **"Next: DNS + Warmup"** to proceed to Step 5.

**If a key fails validation:**
- GA4: ensure the Measurement ID starts with `G-` and has 9-10 alphanumeric characters after the dash.
- Clarity: the Project ID is case-sensitive — copy-paste directly from the Clarity dashboard.
- Meta: the Pixel ID is purely numeric — no dashes or spaces.

### Step 5 — DNS + Warmup Checklist

**URL:** Step 5 of 5 — DNS + Warmup

Six checklist items must all be checked before "Save Brand Setup" becomes active:

| # | Checklist item | How to complete |
|---|----------------|-----------------|
| 1 | Domain registrar CNAME added | Follow `docs/runbooks/dns-cutover.md` Steps 1-2 |
| 2 | SSL certificate issued and active | Confirmed at `docs/runbooks/dns-cutover.md` Step 3 |
| 3 | Agency app returns HTTP 200 on `/api/health` | Verified via `curl` in Step 4 of `dns-cutover.md` |
| 4 | GA4 tracking verified (first session recorded) | Open agency homepage in incognito → check GA4 Realtime |
| 5 | Clarity session recording live | Open agency homepage → check Clarity Live sessions within 30s |
| 6 | SPF and DKIM records added | Follow `docs/runbooks/dns-cutover.md` Step 6 |

1. Complete each checklist item. Click the checkbox next to each item once verified. The wizard does not auto-verify items — the operator confirms them manually.

2. Once all 6 items are checked, click **"Save Brand Setup"**.

3. On success, the confirmation message appears: **"Brand setup saved. Your agency is ready for launch."**

4. The wizard marks the brand setup as complete in Payload CMS — the `/api/health` endpoint's `brandSetupComplete` field becomes `true`.

---

## Verification

After completing the wizard:

1. **Agency public site loads with new logo and brand color:**
   ```bash
   curl -s "https://web-{slug}.mjagency.com/" | grep -i "og:image\|brand-color"
   # Expected: meta tags referencing the uploaded logo and brand color
   ```

2. **Health endpoint confirms brand setup complete:**
   ```bash
   curl -s "https://web-{slug}.mjagency.com/api/health" | jq '.brandSetupComplete'
   # Expected: true
   ```

3. **Logo is accessible via the Payload media endpoint:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     "https://web-{slug}.mjagency.com/api/media/{logo-id}"
   # Expected: 200
   ```

4. **API keys written to Doppler:**
   ```bash
   doppler secrets get GA4_MEASUREMENT_ID_{SLUG_UPPER} \
     --project mjagency-{slug} --config prd
   # Expected: G-XXXXXXXXXX format
   ```

5. **Brand color in Payload brand profile:**
   ```bash
   curl -s "https://web-{slug}.mjagency.com/api/brand-profile" \
     -H "Cookie: access_token=<token>" \
     | jq '.primaryColor'
   # Expected: "#XXXXXX" hex color
   ```

---

## Failure Diagnostics

**Symptom:** ΔE check always fails (always returns ΔE < 30) regardless of color chosen.
**Check:** The ΔE check compares the brand color against seeded hero images in Payload. If no hero images are seeded, the comparison has no reference data.
**Fix:** Confirm Phase 12-02 seed completed: `curl -s "https://web-{slug}.mjagency.com/api/health" | jq '.seedComplete'`. If `false`, run the seed: `doppler run --project mjagency-{slug} --config prd -- npx tsx scripts/seed-payload-collections.ts --agency={slug}`. Then retry the ΔE check in Step 2.

**Symptom:** Logo upload fails with "SVG sanitization error".
**Check:** The SVG may contain malicious or unsupported content (scripts, external references, `<foreignObject>`). DOMPurify rejects these by design (CLAUDE.md §7).
**Fix:** Open the SVG in a text editor and remove any `<script>`, `<foreignObject>`, or `javascript:` href attributes. Re-export the SVG from the design tool (Figma, Illustrator) using the "Clean SVG" export option. Re-upload.

**Symptom:** Step 4 API key validation fails for a valid GA4 Measurement ID.
**Check:** Some GA4 Measurement IDs have a different format (e.g., `G-ABC123DEF4` — alphanumeric, not just digits). The wizard regex may be too strict.
**Fix:** Confirm the Measurement ID in Google Analytics Admin → Property → Data Streams → Web Stream → Measurement ID. If the format is valid but rejected, contact the platform team to update the validation regex.

**Symptom:** "Save Brand Setup" button remains disabled after checking all 6 items in Step 5.
**Check:** One or more checklist items may have a validation error that is not yet shown. Check the browser console for JavaScript errors.
**Fix:** Reload the page and re-check each item one at a time. If the issue persists, check `pm2 logs web-{slug} --lines 20` for server-side validation errors on the save action.
