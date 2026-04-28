# GA4 User Data Deletion Runbook

**Audience:** Privacy officer, analytics team
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/ccpa-erasure-manual.md`, `packages/compliance/src/erasure/ga4-delete.ts`

---

## Overview

This runbook covers requesting user data deletion from Google Analytics 4 (GA4) following a CCPA erasure request. GA4 data deletion must be performed after the automated CCPA erasure has been executed for any user who had GA4 tracking active.

**Important timeline:** GA4 user data deletion requests take up to **63 days** to propagate fully through Google's infrastructure. The request is filed immediately; confirmation of deletion takes 63 days. Document the request ID in `ccpa_erasure_records` as soon as it is filed.

**GA4 deletion automation:** The automated erasure flow in `packages/compliance/src/erasure/ga4-delete.ts` calls this API automatically as part of the 7-system fan-out. Use this runbook when:
1. The automated module failed and a manual retry is needed
2. A compliance audit requires manual verification of the deletion request
3. A user's `client_id` needs to be deleted from GA4 directly

**Properties in use:** Each agency has one GA4 property. Property IDs are stored in Doppler as `GA4_MEASUREMENT_ID_{SLUG_UPPER}` (measurement ID format: `G-XXXXXXXXXX`). The GA4 Admin API uses the numeric Property ID (format: `properties/XXXXXXXXX`), which is different from the Measurement ID.

---

## Prerequisites

### Required access
- Google Analytics Admin API access (OAuth2 service account with `analytics.user.deletion` scope)
- GA4 Property IDs for each affected agency
- User's GA4 `client_id` or `user_id` (from `consent_log` table or GA4 events export)

### Get a GA4 Admin API access token

```bash
# Option 1: Using service account key file (stored in Doppler as GA4_SERVICE_ACCOUNT_JSON)
doppler secrets get GA4_SERVICE_ACCOUNT_JSON --project mjagency-shared --config prd \
  > /tmp/ga4-service-account.json

# Get OAuth2 token using gcloud
gcloud auth activate-service-account --key-file=/tmp/ga4-service-account.json
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Clean up key file
rm /tmp/ga4-service-account.json
```

### Find the user's GA4 client_id

```bash
# Look up client_id from consent_log table
psql "$DATABASE_URL_DIRECT" -c "
  SELECT ga4_client_id, ga4_user_id, created_at
  FROM consent_log
  WHERE email = 'user@example.com'
  ORDER BY created_at DESC
  LIMIT 1;
"
```

---

## Procedure

### Step 1 — Identify the GA4 Property ID for the affected agency

```bash
# Get Measurement ID from Doppler (format: G-XXXXXXXXXX)
doppler secrets get GA4_MEASUREMENT_ID_WEB_ECOMMERCE \
  --project mjagency-shared --config prd

# GA4 Admin API requires the numeric Property ID (not Measurement ID)
# Find it in GA4 Admin → Property settings → Property ID (format: 1234567890)
# Or query via GA4 Admin API:
curl -s "https://analyticsadmin.googleapis.com/v1beta/accountSummaries" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  | jq '.accountSummaries[].propertySummaries[] | {displayName: .displayName, property: .property}'
```

### Step 2 — File a User Data Deletion Request

```bash
# Replace GA4_PROPERTY_ID with the numeric property ID (e.g., 1234567890)
# Replace CLIENT_ID with the user's GA4 client_id from consent_log

GA4_PROPERTY_ID="1234567890"
CLIENT_ID="GA1.1.123456789.1234567890"

curl -s -X POST \
  "https://www.googleapis.com/analytics/v3/userDeletion/userDeletionRequests:upsert?access_token=${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"kind\": \"analytics#userDeletionRequest\",
    \"id\": {
      \"type\": \"CLIENT_ID\",
      \"userId\": \"${CLIENT_ID}\"
    },
    \"propertyId\": \"UA-NOT-USED\",
    \"webPropertyId\": \"properties/${GA4_PROPERTY_ID}\"
  }"
```

For User ID (authenticated users tracked by `user_id` in GA4):

```bash
USER_ID="internal-user-uuid-from-db"

curl -s -X POST \
  "https://www.googleapis.com/analytics/v3/userDeletion/userDeletionRequests:upsert?access_token=${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"kind\": \"analytics#userDeletionRequest\",
    \"id\": {
      \"type\": \"USER_ID\",
      \"userId\": \"${USER_ID}\"
    },
    \"webPropertyId\": \"properties/${GA4_PROPERTY_ID}\"
  }"
```

Record the deletion request ID from the API response.

### Step 3 — Document in ccpa_erasure_records

```bash
psql "$DATABASE_URL_DIRECT" -c "
  UPDATE ccpa_erasure_records
  SET ga4_deletion_request_id = '<id-from-api-response>',
      ga4_deletion_filed_at = NOW(),
      ga4_deletion_property_id = 'properties/${GA4_PROPERTY_ID}',
      ga4_deletion_status = 'pending'
  WHERE request_id = 'REQ-123';
"
```

### Step 4 — Handle all 12 agencies if user had cross-agency sessions

If the user interacted with multiple agencies (e.g., visited both `web-ecommerce` and `web-healthcare`), repeat Steps 1-3 for each agency's GA4 property:

```bash
# Agencies where the user had consent_log entries
psql "$DATABASE_URL_DIRECT" -c "
  SELECT DISTINCT agency_id, ga4_client_id
  FROM consent_log
  WHERE email = 'user@example.com';
"

# For each agency, file a separate deletion request
for slug in web-ecommerce web-healthcare; do
  slug_upper=$(echo "$slug" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
  MEASUREMENT_ID=$(doppler secrets get "GA4_MEASUREMENT_ID_${slug_upper}" \
    --project mjagency-shared --config prd)
  echo "Agency: ${slug}, Measurement ID: ${MEASUREMENT_ID}"
  # File deletion request for this property (repeat Step 2 with this property's ID)
done
```

### Step 5 — Set a 63-day follow-up reminder

GA4 deletion is not instantaneous. Log a follow-up task:

```bash
psql "$DATABASE_URL_DIRECT" -c "
  UPDATE ccpa_erasure_records
  SET ga4_deletion_followup_date = NOW() + INTERVAL '63 days'
  WHERE request_id = 'REQ-123';
"
echo "Follow-up date set. Revisit on: $(date -d '+63 days' +%Y-%m-%d)"
```

---

## Verification

1. **Check GA4 deletion request status** (after 63 days):
   ```bash
   curl -s \
     "https://www.googleapis.com/analytics/v3/userDeletion/userDeletionRequests:upsert?access_token=${ACCESS_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"kind": "analytics#userDeletionRequest", "id": {"type": "CLIENT_ID", "userId": "<client_id>"}, "webPropertyId": "properties/<property_id>"}'
   # Response will include deletionRequestTime when deletion is complete
   ```

2. **ccpa_erasure_records shows GA4 deletion filed:**
   ```bash
   psql "$DATABASE_URL_DIRECT" -c "
     SELECT ga4_deletion_request_id, ga4_deletion_filed_at, ga4_deletion_status
     FROM ccpa_erasure_records WHERE request_id = 'REQ-123';
   "
   # Expected: non-null ga4_deletion_request_id, ga4_deletion_status='pending' or 'completed'
   ```

3. **After 63 days — confirm deletion propagated:**
   Update the status in `ccpa_erasure_records`:
   ```bash
   psql "$DATABASE_URL_DIRECT" -c "
     UPDATE ccpa_erasure_records
     SET ga4_deletion_status = 'completed',
         ga4_deletion_completed_at = NOW()
     WHERE request_id = 'REQ-123';
   "
   ```

---

## Failure Diagnostics

**Symptom:** GA4 Admin API returns 401 (UNAUTHENTICATED).
**Check:** The OAuth2 access token has expired (tokens expire after 1 hour). The service account key may have been revoked.
**Fix:** Re-generate the access token: `ACCESS_TOKEN=$(gcloud auth print-access-token)`. If the service account key is revoked, create a new key in Google Cloud Console → IAM & Admin → Service Accounts → `ga4-deletion@<project>.iam.gserviceaccount.com` → Keys → Add Key.

**Symptom:** GA4 Admin API returns 403 (PERMISSION_DENIED).
**Check:** The service account may not have the `analytics.user.deletion` IAM role on the GA4 property.
**Fix:** In Google Analytics Admin → Property → Property Access Management, add the service account email with "Editor" or higher role. Alternatively, grant `roles/analyticsAdmin` in Google Cloud IAM.

**Symptom:** Deletion request pending more than 63 days.
**Check:** Confirm the correct `client_id` was used (GA4 uses hashed client IDs in some cases). Check the GA4 Admin console for the deletion request status.
**Fix:** Re-file the deletion request with the corrected `client_id`. If the user had multiple browser sessions, they may have multiple `client_id` values — file one request per `client_id`.

**Symptom:** `consent_log` table has no `ga4_client_id` for this user.
**Check:** The user may have declined GA4 tracking (consent was `tracking_blocked`). In this case, GA4 has no data to delete.
**Fix:** Verify in `consent_log`: `SELECT * FROM consent_log WHERE email = 'user@example.com'`. If `consent_status = 'tracking_blocked'` and `ga4_client_id IS NULL`, no GA4 deletion request is needed. Document this in `ccpa_erasure_records.ga4_deletion_status = 'not_required'`.
