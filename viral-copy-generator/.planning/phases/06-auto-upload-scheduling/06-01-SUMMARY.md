---
phase: 06-auto-upload-scheduling
plan: "01"
status: complete
subsystem: backend/upload
tags: [upload, pg-boss, multer, storage, security]
dependency_graph:
  requires:
    - "05-ai-copy-platform-cards (aiRouter exists in app.ts)"
    - "backend/src/lib/boss.ts (getBoss, PgBoss)"
    - "backend/src/lib/storage.ts (UPLOADS_ROOT, initStorage)"
    - "backend/src/db/schema.ts (platform_posts)"
    - "backend/src/middleware/auth.ts (authMiddleware, res.locals.userId)"
  provides:
    - "POST /api/upload/file — multer video upload endpoint"
    - "POST /api/upload/schedule — pg-boss job enqueue with server-side path derivation"
    - "registerUploadWorkers() — four pg-boss worker queue handlers"
    - "deleteFile() — path-traversal-safe file deletion (STORE-03)"
    - "VPS_PUBLIC_URL validation on startup"
  affects:
    - "backend/src/app.ts — uploadRouter mounted at /api/upload"
    - "backend/src/index.ts — registerUploadWorkers wired into startup"
    - "backend/src/lib/storage.ts — deleteFile() added"
tech_stack:
  added:
    - "multer 1.4.5-lts.2 (already in package.json)"
    - "@types/multer 1.4.12 (already in package.json)"
  patterns:
    - "multer diskStorage (tmp dir → rename to user dir) to avoid userId unavailability in destination()"
    - "pg-boss v12 work() receives Job<T>[] (batch array) — iterated with for..of"
    - "stat(filePath) for Instagram 100 MB gate — never client-supplied size"
    - "path.resolve() + startsWith(root + sep) for path-traversal guards"
    - "Dynamic import for platform workers — resolved at job execution time"
key_files:
  created:
    - "backend/src/routes/upload.ts"
    - "backend/src/lib/upload-worker.ts"
    - "backend/src/lib/upload-youtube.ts (stub)"
    - "backend/src/lib/upload-instagram.ts (stub)"
    - "backend/src/lib/upload-facebook.ts (stub)"
    - "backend/src/lib/upload-tiktok.ts (stub)"
    - "backend/.env.example"
  modified:
    - "backend/src/lib/storage.ts — deleteFile() implemented"
    - "backend/src/app.ts — uploadRouter mounted"
    - "backend/src/index.ts — registerUploadWorkers + VPS_PUBLIC_URL"
decisions:
  - "Platform worker stubs created (upload-youtube/instagram/facebook/tiktok.ts) so upload-worker.ts dynamic imports compile cleanly; stubs throw until Plan 06-02 implements them"
  - "pg-boss v12 work() handler receives Job<T>[] not single Job — iterated with for..of inside each worker handler"
  - "multer destination uses /tmp subdir + rename because res.locals.userId is unavailable inside multer destination() callback"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-03T11:11:31Z"
  tasks_completed: 2
  files_created: 7
  files_modified: 3
---

# Phase 06 Plan 01: Upload Route + Worker Skeleton Summary

Upload infrastructure for Phase 6 auto-upload: multer file endpoint writing to /var/uploads/{userId}/{uuid}.mp4, pg-boss job scheduler with server-side filePath/publicUrl derivation, four-platform worker skeleton with TikTok approval gate, and path-traversal-safe deleteFile().

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | deleteFile() + POST /api/upload/file + POST /api/upload/schedule | cce71d2 | storage.ts, upload.ts, app.ts |
| 2 | pg-boss worker skeleton + VPS_PUBLIC_URL validation + .env.example | cce71d2 | upload-worker.ts, index.ts, .env.example |

## What Was Built

**deleteFile() (STORE-03):** Added to `backend/src/lib/storage.ts` with path-traversal guard. Uses `path.resolve()` + `startsWith(root + path.sep)` pattern consistent with the existing `cleanupStaleFiles()` guard.

**POST /api/upload/file:** multer `diskStorage` writes to `/var/uploads/tmp/{uuid}.mp4` first (userId is unavailable inside multer's `destination()` callback), then the route handler renames the file to `/var/uploads/{userId}/{uuid}.mp4` after verifying the destination path is within UPLOADS_ROOT. Returns `{ fileId, publicUrl }`.

**POST /api/upload/schedule:** `ScheduleBody` interface contains only `{ postId, platform, fileId, caption, hashtags, scheduledAt? }` — no `filePath`, `publicUrl`, or `fileSizeBytes`. Both `filePath` and `publicUrl` are derived server-side from `userId` (from JWT via `res.locals.userId`) and `body.fileId`. Instagram 100 MB gate calls `stat(filePath)` on the actual disk file — client cannot bypass by omitting a size field (T-06-06).

**registerUploadWorkers():** Registers four pg-boss queues (`upload-youtube`, `upload-instagram`, `upload-facebook`, `upload-tiktok`) via `createQueue()` before calling `work()` (required by pg-boss v12 FK constraint). TikTok worker checks `TIKTOK_APPROVED === 'true'` before processing (AUTOUP-04). Dynamic imports for platform handlers resolved at job execution time.

**VPS_PUBLIC_URL validation:** Added to `REQUIRED_ENV` array in `index.ts` — server refuses to start without it (STORE-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pg-boss v12 work() handler receives Job<T>[] not single Job**
- **Found during:** Task 2 - TypeScript compilation
- **Issue:** pg-boss v12 `WorkHandler<ReqData>` is typed as `(job: Job<ReqData>[]): Promise<ResData>` — an array, not a single job. The plan showed `const { data } = job` which would fail at runtime.
- **Fix:** Updated worker handlers to receive `jobs: Job<UploadJobPayload>[]` and iterate with `for..of` over the batch.
- **Files modified:** `backend/src/lib/upload-worker.ts`
- **Commit:** cce71d2

**2. [Rule 3 - Blocking] upload-worker.ts dynamic imports require platform stub files**
- **Found during:** Task 2 - TypeScript compilation
- **Issue:** `tsc` could not resolve `./upload-youtube.js`, `./upload-instagram.js`, `./upload-facebook.js`, `./upload-tiktok.js` — these files don't exist until Plan 06-02. TypeScript requires the corresponding `.ts` files to be present for module resolution.
- **Fix:** Created four stub files (`upload-youtube.ts`, `upload-instagram.ts`, `upload-facebook.ts`, `upload-tiktok.ts`) that export the required functions but throw `Error('not yet implemented (Plan 06-02)')`.
- **Files created:** 4 stub platform worker files
- **Commit:** cce71d2

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `uploadYouTube()` | `backend/src/lib/upload-youtube.ts` | Throws — implemented in Plan 06-02 |
| `uploadInstagram()` | `backend/src/lib/upload-instagram.ts` | Throws — implemented in Plan 06-02 |
| `uploadFacebook()` | `backend/src/lib/upload-facebook.ts` | Throws — implemented in Plan 06-02 |
| `uploadTikTok()` | `backend/src/lib/upload-tiktok.ts` | Throws — implemented in Plan 06-02 |

These stubs allow the Plan 06-01 infrastructure (worker registration, queue creation) to compile and start correctly. Plan 06-02 will replace each stub with a real implementation.

## Threat Surface Scan

All threat mitigations from the plan's `<threat_model>` are implemented:

| Threat ID | Mitigation | File | Status |
|-----------|-----------|------|--------|
| T-06-01 | path.resolve(destPath).startsWith(UPLOADS_ROOT + sep) before rename | upload.ts:75-79 | Implemented |
| T-06-02 | Same pattern in deleteFile() | storage.ts:17-21 | Implemented |
| T-06-03 | filePath derived server-side, not from req.body | upload.ts:137-140 | Implemented |
| T-06-05 | multer limits.fileSize: 260 MB | upload.ts:37 | Implemented |
| T-06-06 | stat(filePath).size check for Instagram gate | upload.ts:144-151 | Implemented |

## Self-Check: PASSED

Files verified present:
- backend/src/routes/upload.ts: FOUND
- backend/src/lib/upload-worker.ts: FOUND
- backend/src/lib/storage.ts (deleteFile): FOUND
- backend/src/index.ts (VPS_PUBLIC_URL + registerUploadWorkers): FOUND
- backend/src/app.ts (uploadRouter): FOUND
- backend/.env.example: FOUND

Commits verified:
- cce71d2: FOUND (feat(06-01): upload route + worker skeleton + deleteFile + VPS_PUBLIC_URL validation)

TypeScript: `tsc --noEmit` exits 0 — no errors.
