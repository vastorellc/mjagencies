---
phase: 06-auto-upload-scheduling
plan: 02
subsystem: api
status: complete
tags: [googleapis, youtube, instagram, facebook, tiktok, upload, pg-boss, oauth, resumable-upload]

# Dependency graph
requires:
  - phase: 06-01
    provides: upload-worker.ts skeleton with UploadJobPayload interface, updateUploadStatus(), pg-boss worker registration
  - phase: 02-settings-social-oauth
    provides: OAuth token storage in settings.platform_config (encrypted AES-256-GCM)

provides:
  - "uploadYouTube() — googleapis resumable stream upload using createReadStream"
  - "uploadInstagram() — two-step container+publish with 5s poll loop (container created at fire time)"
  - "uploadFacebook() — three-phase video_reels upload using page_access_token + page_id"
  - "uploadTikTok() stub — throws tiktok_not_approved; gated by TIKTOK_APPROVED env flag"

affects:
  - 06-03
  - 06-04

# Tech tracking
tech-stack:
  added: []  # googleapis already present at 171.4.0
  patterns:
    - "Platform upload workers: try/catch wraps all API calls; failed status + re-throw for pg-boss retry"
    - "Instagram container created inside worker body at job fire time (never at schedule time)"
    - "Facebook three-phase upload: start session → binary stream → finish PUBLISHED"
    - "YouTube resumable upload: googleapis handles chunked protocol internally via ReadStream"
    - "Token refresh guard: Date.now() + 5min > expiry before googleapis call"

key-files:
  created:
    - backend/src/lib/upload-youtube.ts
    - backend/src/lib/upload-instagram.ts
    - backend/src/lib/upload-facebook.ts
    - backend/src/lib/upload-tiktok.ts
  modified: []

key-decisions:
  - "Instagram container created inside uploadInstagram() worker body (not at schedule time or module level) to avoid 24h expiry before job fires"
  - "Facebook upload uses createReadStream with duplex: half (Node 22 native fetch streaming)"
  - "Instagram poll loop: 120 iterations × 5s = 10 min max; re-creates container up to 3 times on EXPIRED before failing"
  - "YouTube access token refreshed if within 5 minutes of expiry; refreshed tokens encrypted and persisted back to DB"
  - "TikTok stub throws immediately; the gate logic lives in upload-worker.ts (TIKTOK_APPROVED env check)"
  - "Removed @ts-expect-error directives: TypeScript 6 accepts Node 22 ReadStream as fetch body without suppression"

patterns-established:
  - "Upload worker error pattern: catch → updateUploadStatus(failed, message) → throw (pg-boss retries)"
  - "Upload worker success pattern: update platform_posts.platform_post_id → updateUploadStatus(posted) → deleteFile"
  - "Token decryption: decrypt() only inside function scope; plaintext never stored in outer variables"

requirements-completed:
  - AUTOUP-01
  - AUTOUP-02
  - AUTOUP-03
  - AUTOUP-04
  - STORE-03

# Metrics
duration: 20min
completed: 2026-05-03
---

# Phase 06 Plan 02: Upload Workers Summary

**Four platform upload workers replacing stubs: googleapis resumable YouTube, Instagram container-at-fire-time with poll loop, Facebook three-phase page_access_token reels, and gated TikTok stub**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-03T10:57:00Z
- **Completed:** 2026-05-03T11:16:59Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- YouTube upload uses googleapis `videos.insert()` with `createReadStream` — resumable protocol (never multipart), with token refresh when within 5 minutes of expiry
- Instagram upload creates its container inside the worker body at job fire time (AUTOUP-02), polls status every 5s up to 120 iterations, retries container creation on EXPIRED up to 3 times
- Facebook upload reads `page_access_token` and `page_id` from `settings.platform_config.facebook`, guards against `setup_required: true` before any API call, performs three-phase upload (start → binary stream → finish PUBLISHED)
- TikTok stub properly throws `tiktok_not_approved`; gating logic lives in `upload-worker.ts` which checks `TIKTOK_APPROVED=true` env flag before calling this function
- All four workers call `deleteFile(filePath)` after successful upload (STORE-03) and call `updateUploadStatus(platformPostId, 'failed', message)` then re-throw on error

## Task Commits

1. **Task 1: uploadYouTube — googleapis resumable stream upload** - `a30b6f5` (feat)
2. **Task 2: uploadInstagram/Facebook workers + uploadTikTok stub** - `d1ae3d7` (feat)

## Files Created/Modified

- `backend/src/lib/upload-youtube.ts` — googleapis resumable upload; token refresh; deleteFile on success
- `backend/src/lib/upload-instagram.ts` — createContainer inside worker body; 5s poll loop; EXPIRED retry (max 3); publishContainer only after FINISHED
- `backend/src/lib/upload-facebook.ts` — setup_required guard; three-phase video_reels upload; page_access_token + page_id from decrypted settings
- `backend/src/lib/upload-tiktok.ts` — stub that throws tiktok_not_approved

## Decisions Made

- Instagram container is created inside `uploadInstagram()` body (not at schedule time or module level) because Instagram containers expire after 24 hours. If created at schedule time and a job is queued 2+ days in advance, the container would be stale before the job fires.
- Facebook binary upload phase uses `createReadStream(filePath)` with `duplex: 'half'` via native Node 22 fetch. TypeScript 6 accepts this without suppression; the two `@ts-expect-error` directives were removed as a deviation fix.
- YouTube token refresh persists the new encrypted access_token back to `settings.platform_config.youtube` so the next job does not re-refresh unnecessarily.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused @ts-expect-error directives in upload-facebook.ts**
- **Found during:** Task 2 (uploadFacebook implementation), TypeScript check
- **Issue:** Plan included two `@ts-expect-error` suppressions for `createReadStream` as fetch body and `duplex: 'half'`. TypeScript 6.0.3 accepts both without error, making the directives invalid (TS2578: Unused @ts-expect-error).
- **Fix:** Removed both `@ts-expect-error` lines; code compiles cleanly.
- **Files modified:** `backend/src/lib/upload-facebook.ts`
- **Verification:** `tsc --noEmit` exits 0 after removal
- **Committed in:** d1ae3d7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minimal — suppression directives were incorrect for TypeScript 6. Actual upload logic unchanged.

## Issues Encountered

- TypeScript compiler (`npx tsc --noEmit`) hit Node.js heap OOM on first run. Resolved by setting `NODE_OPTIONS="--max-old-space-size=4096"` before the tsc invocation. This is a known issue with TypeScript 6 + large codebases in constrained environments.

## Known Stubs

None — `uploadTikTok` is intentionally a stub per AUTOUP-04 (TikTok API approval pending). The stub is gated by `TIKTOK_APPROVED=true` env flag in `upload-worker.ts` and does NOT block any platform functionality. The stub error message explains the activation path.

## Threat Flags

None — all new surface was within the threat model defined in this plan's `<threat_model>` section. Token decryption occurs only inside worker function scope and is never logged (Pino redact config in app.ts covers this).

## Next Phase Readiness

- All four platform upload worker functions are implemented and type-clean
- `upload-worker.ts` dynamic imports resolve correctly for all four platforms
- Plan 06-03 can now implement the scheduling route (`POST /api/upload/schedule`) which enqueues `UploadJobPayload` jobs to pg-boss
- No blockers

---
*Phase: 06-auto-upload-scheduling*
*Completed: 2026-05-03*
