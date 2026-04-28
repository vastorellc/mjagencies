# Payload CMS Backup and Restore Runbook

**Audience:** Platform ops, CMS administrators
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/backup-restore.md`, `docs/runbooks/migrations.md`, `scripts/migrate-rollback.ts`, `scripts/pgbackrest-restore.sh`

---

## Overview

This runbook covers backup and restore of Payload CMS 3.82.1 data stored across the MJAgency platform. Payload data resides in Postgres (one database per agency) and is therefore included in pgBackRest full backups (`docs/runbooks/backup-restore.md`). This runbook covers Payload-specific operational procedures: per-collection JSON export/import, seed-based restore, and migration rollback.

**Backup layers for Payload data:**

| Layer | Tool | Coverage | Runbook |
|-------|------|----------|---------|
| Database-level | pgBackRest + R2 | All Payload collections (Postgres tables) | `backup-restore.md` |
| Collection JSON export | Payload REST API | Per-collection document-level backup | This runbook |
| Media assets | Cloudflare R2 (`mjagency-media`) | Uploaded files, images | This runbook |
| Seed restore | `seed-payload-collections.ts` | Re-populate from seed data | This runbook |
| Migration rollback | `scripts/migrate-rollback.ts` | Schema-level rollback | This runbook |

**SLA targets (PROJECT.md):** RPO 1h (aligns with pgBackRest WAL archiving), RTO 4h.

---

## Prerequisites

### Required access
- Payload super_admin session (cookie `access_token` on `/admin`)
- Cloudflare R2 access: `CLOUDFLARE_R2_BUCKET`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` (from Doppler)
- Database direct access: `DATABASE_URL_DIRECT` from Doppler (for migration rollback)

```bash
# Verify Payload admin is accessible
curl -s -o /dev/null -w "%{http_code}" "https://web-ecommerce.mjagency.com/admin/login"
# Expected: 200
```

### Payload collection names

Standard collections per agency (verify against `packages/cms/src/collections/`):

```
pages, services, tools, team-members, testimonials, faqs,
blog-posts, case-studies, media, leads, deals, contacts
```

---

## Procedure

### Step 1 — Export collection data via Payload REST API

Export all documents from a collection before a risky migration or as a snapshot:

```bash
# Set base URL for target agency
BASE_URL="https://web-ecommerce.mjagency.com"
ACCESS_TOKEN="<super_admin access_token cookie value>"

# Export all documents from a collection (depth=0 avoids relationship expansion)
curl -s "${BASE_URL}/api/pages?limit=0&depth=0" \
  -H "Cookie: access_token=${ACCESS_TOKEN}" \
  | jq '.' > /tmp/pages-export-$(date +%Y%m%d-%H%M%S).json

# Export all collections in a loop
for collection in pages services tools team-members testimonials faqs blog-posts case-studies; do
  echo "Exporting ${collection}..."
  curl -s "${BASE_URL}/api/${collection}?limit=0&depth=0" \
    -H "Cookie: access_token=${ACCESS_TOKEN}" \
    | jq '.' > /tmp/${collection}-export-$(date +%Y%m%d).json
done
```

### Step 2 — Upload JSON exports to R2

```bash
# Install wrangler if not available
npm install -g wrangler

# Upload all exported JSON files to R2 backup bucket
for file in /tmp/*-export-*.json; do
  filename=$(basename "$file")
  wrangler r2 object put "mjagency-backups/payload-exports/$(date +%Y%m%d)/${filename}" \
    --file "$file" \
    --remote
  echo "Uploaded: ${filename}"
done
```

### Step 3 — Restore from JSON export via seed script

If Payload data needs to be restored from a JSON export (not a full DB restore):

```bash
# Place exported JSON files in the seed input directory
mkdir -p scripts/seed-data/restore
cp /tmp/*-export-*.json scripts/seed-data/restore/

# Run the seed script with restore flag (idempotent — skips existing records by slug/id)
doppler run --project mjagency-{slug} --config prd -- \
  npx tsx scripts/seed-payload-collections.ts \
  --agency={slug} \
  --input=scripts/seed-data/restore/ \
  --mode=restore
```

The seed script checks for existing records by `slug` or `id` field and skips duplicates.

### Step 4 — Restore media assets from R2

Payload-uploaded media (images, PDFs, videos) are stored in R2 bucket `mjagency-media`. To restore:

```bash
# List media objects for an agency
wrangler r2 object list "mjagency-media" \
  --prefix="agencies/web-ecommerce/" \
  --remote

# Download all media for an agency (if local restore is needed)
wrangler r2 object get "mjagency-media/agencies/web-ecommerce/" \
  --local-dir /tmp/media-restore/ \
  --remote
```

### Step 5 — Migration rollback (schema-level)

If a Payload schema migration caused data loss or schema errors:

```bash
# Dry-run first — see which migration would be rolled back
doppler run --project mjagency-{slug} --config prd -- \
  npx tsx scripts/migrate-rollback.ts --agency={slug} --dry-run

# Perform rollback (rolls back the last applied migration for this agency)
doppler run --project mjagency-{slug} --config prd -- \
  npx tsx scripts/migrate-rollback.ts --agency={slug}

# To roll back a specific migration by name:
doppler run --project mjagency-{slug} --config prd -- \
  npx tsx scripts/migrate-rollback.ts --agency={slug} --migration=0012_add_tools_collection
```

After rollback, restart the agency app to reload the schema:
```bash
pm2 restart web-{slug}
```

---

## Verification

1. **Collection document count matches pre-restore export:**
   ```bash
   # Get current count
   curl -s "${BASE_URL}/api/pages?limit=0&depth=0" \
     -H "Cookie: access_token=${ACCESS_TOKEN}" \
     | jq '.totalDocs'

   # Compare with pre-restore export count
   jq '.totalDocs' /tmp/pages-export-<timestamp>.json
   ```
   Counts must match.

2. **Payload admin loads without errors:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     "${BASE_URL}/admin/collections/pages" \
     -H "Cookie: access_token=${ACCESS_TOKEN}"
   # Expected: 200
   ```

3. **Migration state is correct:**
   ```bash
   doppler run --project mjagency-{slug} --config prd -- \
     npx tsx scripts/migrate-runner.ts --dry-run --agency={slug}
   # Expected: "0 pending migrations"
   ```

4. **Public agency pages load with restored content:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" "https://{agency-slug}.mjagency.com/"
   # Expected: 200
   ```

---

## Failure Diagnostics

**Symptom:** Payload REST API returns 401 on collection export.
**Check:** The `access_token` cookie may have expired or the user lacks super_admin role.
**Fix:** Re-authenticate in Payload admin at `/admin/login`. Use the `PAYLOAD_SUPER_ADMIN_EMAIL` and `PAYLOAD_SUPER_ADMIN_PASSWORD` from Doppler for emergency access: `doppler secrets get PAYLOAD_SUPER_ADMIN_EMAIL --project mjagency-{slug} --config prd`.

**Symptom:** `seed-payload-collections.ts` exits with "duplicate key constraint" errors.
**Check:** The restore is attempting to insert records that already exist (not idempotent).
**Fix:** Add `--mode=upsert` flag to the seed script to update existing records instead of inserting. Alternatively, delete the conflicting records from Payload admin before re-running the restore.

**Symptom:** Migration rollback fails with "cannot roll back migration — no down migration defined".
**Check:** The migration in question may not have a `down()` function.
**Fix:** Use pgBackRest full restore from `docs/runbooks/backup-restore.md` to restore the DB to a pre-migration state. For PITR (Point-in-Time Recovery), run `bash scripts/pgbackrest-restore.sh --target='<timestamp-before-migration>'`.

**Symptom:** Missing CMS records after a pgBackRest restore.
**Check:** Confirm the pgBackRest backup was taken after the missing records were created: `pgbackrest info` shows backup timestamps. If the records were created after the last backup, they cannot be recovered from backup.
**Fix:** Re-run the seed script: `npx tsx scripts/seed-payload-collections.ts --agency={slug}`. If content was user-created (not seeded), the records are unrecoverable unless a JSON export was taken beforehand.
