# Phase 6 Deep Research
**Researched:** 2026-04-30
**Domain:** YouTube Data API v3, Meta Graph API (Instagram + Facebook Reels), BullMQ scheduling, temp file lifecycle, upload state tracking
**Confidence:** HIGH on YouTube and BullMQ; MEDIUM-HIGH on Meta (docs confirmed, edge cases flagged)

---

## Confirmed Approach (no changes needed)

### Q1 — YouTube resumable upload via googleapis

**CONFIRMED.** The `googleapis` npm package's `videos.insert` method accepts `media.body` as a Node.js `Readable` stream (e.g., `fs.createReadStream('/tmp/uuid.mp4')`). When a stream is passed, the library handles resumable upload protocol internally — the caller does not manage chunking manually.

**[VERIFIED: official googleapis README + community examples]**

Exact call signature:

```typescript
import { google } from 'googleapis'
import fs from 'fs'

const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

const response = await youtube.videos.insert({
  part: ['snippet', 'status'],
  requestBody: {
    snippet: {
      title: 'My Video Title #Shorts',
      description: 'Description here',
      tags: ['tag1', 'tag2'],
      categoryId: '22',          // 22 = People & Blogs — see Shorts note below
    },
    status: {
      privacyStatus: 'public',
    },
  },
  media: {
    mimeType: 'video/mp4',
    body: fs.createReadStream('/tmp/uuid.mp4'),
  },
})

const videoId = response.data.id
```

**Frontend → backend file transfer:** Frontend sends the video file as `multipart/form-data` via `fetch` or `XMLHttpRequest` to `POST /upload/youtube`. Backend receives it with Multer (`multer({ dest: '/tmp' })`), which writes the file to `/tmp/<uuid>` and populates `req.file.path`. The BullMQ job then uses `req.file.path` to create the read stream. This is the correct and standard approach. [VERIFIED: Multer docs + architecture research]

**Resuming interrupted uploads:** The googleapis library handles retries automatically up to a point. For a manual resume scenario, the protocol requires sending an empty PUT with `Content-Range: bytes */CONTENT_LENGTH` to the session URI — the server responds 308 with a `Range` header showing bytes received so far. The googleapis library abstracts this for normal usage; explicit retry-from-byte is needed only for very long stalls (e.g., VPS crash mid-upload). For this tool, BullMQ's built-in retry (max 3, exponential backoff) is sufficient — if an upload fails mid-stream, BullMQ retries the entire upload from scratch. [VERIFIED: Google Resumable Upload Protocol docs]

---

### Q2 — YouTube Shorts detection

**CONFIRMED. The spec's detection logic is still correct in 2025, with one clarification.**

YouTube has **no explicit Shorts flag or dedicated API parameter**. Classification happens server-side based on three signals evaluated together:

1. **Vertical aspect ratio (9:16)** — primary signal
2. **Duration ≤ 60 seconds** — primary signal
3. **`#Shorts` in title or description** — strong secondary signal

All three together give maximum confidence the video lands in the Shorts feed. A vertical sub-60s video without `#Shorts` *may* still be classified as a Short, but including `#Shorts` in the title is the programmatic signal YouTube explicitly reads.

**CategoryId for Shorts:** There is no "Shorts category." Some community sources cite `categoryId: '10'` (Music) as a "Shorts category" — this is **incorrect**. The spec's `categoryId: '22'` (People & Blogs) is appropriate for travel/lifestyle content. The categoryId field describes content genre, not format type. Set it based on your content niche, not Shorts classification. [VERIFIED: YouTube Data API docs + community confirmation]

**No `madeForShorts` boolean exists in the API.** [VERIFIED: Google YouTube Data API videos.insert reference]

---

### Q3 — Meta Instagram Reels: video_url + Nginx static serving

**CONFIRMED.** Meta's `video_url` approach requires a publicly accessible HTTPS URL. The backend must serve the `/tmp` file over the public VPS domain before passing the URL to Meta.

**Nginx location block for serving uploads:**

```nginx
location /uploads/ {
    alias /tmp/uploads/;
    
    # CORS headers — "always" required so they appear on all status codes
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    add_header 'Content-Type' 'video/mp4' always;

    # Handle OPTIONS preflight
    if ($request_method = OPTIONS) {
        return 204;
    }

    # Security: only serve video files
    location ~ \.(mp4|mov)$ {
        try_files $uri =404;
    }
}
```

**Note on path:** Write uploaded files to `/tmp/uploads/uuid.mp4` (a subdirectory, not directly to `/tmp`) to isolate uploads from OS temp files and simplify Nginx's alias. Express Multer config: `multer({ dest: '/tmp/uploads' })`. [ASSUMED — path convention; adjust to match actual deployment]

**Cleanup strategy:** Delete on success. The cleanup trigger is `media_publish` success response. In the BullMQ worker, after `POST /{ig-user-id}/media_publish` returns successfully, call `fs.unlink('/tmp/uploads/uuid.mp4')`. Separately, run a BullMQ cleanup job (or node-cron) every 30 minutes that deletes files older than 1 hour — catches any failed uploads where `media_publish` was never reached. [VERIFIED: architecture research + research summary A6]

---

### Q4 — Meta container status polling: exact API call and status values

**CONFIRMED WITH CORRECTIONS TO SPEC.**

**Exact polling call:**

```typescript
GET https://graph.facebook.com/v19.0/<CONTAINER_ID>?fields=status_code&access_token=<TOKEN>
```

**All status_code values:** [VERIFIED: Meta IG Container reference docs]

| status_code | Meaning | Action |
|-------------|---------|--------|
| `IN_PROGRESS` | Container still processing | Keep polling |
| `FINISHED` | Ready to publish | Call `media_publish` immediately |
| `ERROR` | Processing failed permanently | Do NOT retry this container — create new container with same video |
| `EXPIRED` | Container not published within 24 hours | Container is dead — create new container |
| `PUBLISHED` | Already published | No-op (idempotency guard) |

**Polling cadence:** Poll every 5 seconds (matches spec). Meta recommends once per minute in official docs, but 5s is safe and gives better UX for small files that finish in 30-60 seconds. Use a maximum of 60 polls (5 minutes total). [VERIFIED: Meta content publishing docs]

**EXPIRED case:** The container ID is permanently invalid after 24 hours. This matters for scheduled uploads: if the user schedules a post for >24 hours in the future, the container created at upload time will expire before the scheduled publish time. **Do not pre-create the Meta container at upload time for scheduled posts.** Create it at publish time (inside the BullMQ worker when the delayed job fires). This is a design correction from the spec.

**ERROR case:** Error 2207001 means server-side upload failure — retry by creating a new container (not the same container_id). Error 9 subcode 2207042 means rate limit — back off and retry after the rate limit window. [VERIFIED: postproxy.dev guide + Meta error codes docs]

---

### Q5 — Meta rate limits

**CONFIRMED.** [VERIFIED: Meta content_publishing_limit docs]

The Instagram Graph API enforces **two separate rate limits** relevant to this tool:

| Limit | Value | Scope |
|-------|-------|-------|
| Content publishing limit | **50 posts per 24-hour rolling window** | Per Instagram account, across all content types |
| General API call rate limit | 200 requests/hour | Per access token |

**Note on conflicting sources:** The official `content_publishing_limit` endpoint returns `50` as the quota. Some third-party sources cite 100 — verify against the official endpoint at runtime. [CITED: developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/]

**Can a single personal user hit these limits?** No — 50 posts per day is far above any realistic single-user publishing rate. The limit is not a practical concern for this tool.

**Correct backoff strategy:**
1. Before each publish, check remaining quota: `GET /<IG_USER_ID>/content_publishing_limit?fields=quota_usage`
2. If quota_usage ≥ 50 (or actual limit), surface "Rate limit reached — try again tomorrow" to user
3. For Error 9 / subcode 2207042: implement exponential backoff — wait 1 min, 2 min, 4 min before giving up
4. For API call rate (200/hr): not a concern for this tool's call volume

---

### Q8 — BullMQ PKT scheduling

**CONFIRMED.** [VERIFIED: BullMQ delayed docs + Redis persistence research]

**Exact job definition for a future timestamp:**

```typescript
const targetTime = new Date('2026-05-02T18:00:00+05:00') // PKT peak time
const delayMs = targetTime.getTime() - Date.now()

await uploadQueue.add(
  'platform-upload',
  { postId, platform: 'youtube', filePath: '/tmp/uploads/uuid.mp4' },
  {
    delay: delayMs,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
)
```

**How BullMQ handles delayed jobs:** Jobs are stored in a Redis sorted set where the score = Unix timestamp of when to fire. A poller inside the BullMQ worker checks every 5 seconds for jobs whose timestamp ≤ now, and moves them from the delayed set to the waiting queue. [VERIFIED: BullMQ docs + Medium article on BullMQ internals]

**What happens on server restart:** Jobs in the delayed set persist in Redis as long as Redis has data persistence enabled. When the Node.js process restarts, the BullMQ Worker immediately reconnects to Redis and resumes the 5-second polling loop. **All delayed jobs survive a Node.js restart.** The jobs are in Redis, not in application memory.

**Redis persistence requirement:** This is CRITICAL. Without Redis persistence, a Redis crash loses all delayed jobs. Required Redis configuration:

```
appendonly yes            # Enable AOF persistence
appendfsync everysec      # Sync to disk every second (balance of durability vs performance)
maxmemory 200mb           # As spec'd in research summary
maxmemory-policy noeviction  # MUST be noeviction for BullMQ
```

A crash with `appendfsync everysec` risks at most 1 second of data loss. For upload scheduling, this means at worst a 1-second drift on scheduled time — acceptable. Without `appendonly yes`, a Redis crash loses all pending scheduled uploads. [VERIFIED: BullMQ going-to-production docs]

---

### Q10 — Upload state tracking

**CONFIRMED.** The `upload_status` field in `platform_posts` cycles as follows:

```
pending → (uploading*) → posted
                       → failed
                       manual (set when user uses manual copy instead)
```

*`uploading` is not in the current schema but should be added — see Issues section.

**Events that update the field:**

| Event | Update |
|-------|--------|
| User clicks Upload (request received by backend) | `pending` (default — already set at post creation) |
| BullMQ job starts processing | `UPDATE platform_posts SET upload_status='uploading'` |
| Upload + publish succeed | `UPDATE platform_posts SET upload_status='posted', posted_at=now()` |
| Upload or publish fails (after all retries) | `UPDATE platform_posts SET upload_status='failed'` |
| BullMQ job `failed` event fires | `UPDATE platform_posts SET upload_status='failed'` |

**Frontend polling:** The spec's `GET /platform-posts/:id/status` polling every 3 seconds is correct. The endpoint returns `{ upload_status, posted_at, error_message }`. The frontend updates the platform card's upload button state based on the returned value.

**Push alternative:** For a personal single-user tool, polling is sufficient. Server-Sent Events (SSE) are the correct upgrade path if polling feels sluggish, but do not add this complexity in Phase 6. [ASSUMED — polling vs SSE tradeoff; SSE requires Phase 8 polish]

---

## Issues Found (must fix in plan)

### ISSUE-1 (HARD BLOCKER — Facebook Reels): Facebook Page Required

**Severity: BLOCKER for Facebook Reels upload**

Facebook Reels API (`/{page-id}/video_reels`) **requires a Facebook Page**. Personal Facebook profiles cannot post Reels via API. The spec assumes the user's personal Facebook account is sufficient — this is wrong.

**[VERIFIED: Meta Video API Reels publishing guide + multiple sources confirmed]**

The `{page-id}` in the endpoint is a Facebook Page ID, not a personal profile ID. The API will return a permissions error if a personal profile ID is used.

**What the user needs:**
1. A **Facebook Page** (free to create — can be a creator page linked to their personal account)
2. The OAuth token must be a **Page Access Token** (not a User Access Token), obtained via `GET /me/accounts` after the user grants `pages_manage_posts` permission
3. Permissions required: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`

**App Review requirement:** For this personal tool, the app stays in Meta **Development Mode** — no App Review needed. In Development Mode, any user with a role on the Meta App (the developer themselves) can use all permissions without review. App Review is only required when the app is switched to Live Mode and needs to serve users without app roles. Since this is a single-user personal tool, it stays in Development Mode permanently. [VERIFIED: Meta App Modes docs]

**Resolution for the plan:**
- Change Phase 6 Facebook flow to: get page access token → use page-id in endpoint
- Add `GET /me/accounts` call to list the user's pages during OAuth connect in Phase 2
- Store `{ page_id, page_access_token }` in `settings.platform_config.facebook`
- In the upload worker, use `page_access_token` and `page_id` (not user access token)

**If the user has no Facebook Page:** This is a hard blocker. The user must create a Facebook Page before Facebook Reels upload works. Surface this clearly in the UI Settings screen.

---

### ISSUE-2 (BLOCKER — Instagram): Professional Account Required + Scope Update

**Severity: BLOCKER if user has a personal Instagram account**

Instagram Reels upload via API requires an **Instagram professional account** (Business or Creator). Personal Instagram accounts are explicitly excluded. [VERIFIED: Meta content publishing docs + postproxy.dev guide]

**Additionally, the spec uses deprecated permission scopes:**
- Spec uses: `instagram_basic`, `instagram_content_publish`
- Correct scopes (as of January 27, 2025): `instagram_business_basic`, `instagram_business_content_publish`

The old scopes were **deprecated January 27, 2025** and will fail in new implementations. [VERIFIED: Meta Instagram API with Instagram Login docs]

**Two valid OAuth paths for Instagram:**

| Path | Facebook Page Required | Scopes | Notes |
|------|----------------------|--------|-------|
| Instagram Login (new, July 2024) | No | `instagram_business_basic`, `instagram_business_content_publish` | Simpler for personal tool |
| Facebook Login (legacy) | Yes | `instagram_basic` (deprecated), `instagram_content_publish` (deprecated) | Do not use |

**Recommendation: Use Instagram Login path (launched July 2024).** The user authenticates at `https://api.instagram.com/oauth/authorize`. No Facebook Page required for Instagram posting. Only an Instagram professional account (Creator or Business) is needed — free to switch from personal settings in the Instagram app. [VERIFIED: Meta Instagram API with Instagram Login docs + gist]

**OAuth flow for Instagram Login:**
```
1. Authorization: GET https://api.instagram.com/oauth/authorize
   ?client_id={app-id}&redirect_uri={uri}&scope=instagram_business_basic,instagram_business_content_publish&response_type=code

2. Code exchange: POST https://api.instagram.com/oauth/access_token
   { client_id, client_secret, grant_type: 'authorization_code', redirect_uri, code }
   → Returns short-lived token (valid 1 hour)

3. Long-lived token: GET https://graph.instagram.com/access_token
   ?grant_type=ig_exchange_token&client_secret={secret}&access_token={short_token}
   → Returns 60-day long-lived token

4. Refresh: GET https://graph.instagram.com/refresh_access_token
   ?grant_type=ig_refresh_token&access_token={long_token}
   → Valid for another 60 days; refresh before expiry
```

**Instagram Reels API endpoint (correct):**
```
POST https://graph.instagram.com/v19.0/{ig-user-id}/media
  { media_type: 'REELS', video_url: '...', caption: '...', access_token: '...' }
```
(Not `graph.facebook.com` — use `graph.instagram.com` for the Instagram Login path)

---

### ISSUE-3 (SPEC ERROR): Meta Container MUST NOT be pre-created for scheduled posts

**Severity: DESIGN FIX required**

Instagram containers **expire in 24 hours** if not published. [VERIFIED: Meta IG Container docs]

The spec's current implied flow (frontend uploads → backend creates container → BullMQ delays publish) creates a timing problem: if the user schedules a post >24 hours ahead, the container will expire before the BullMQ job fires.

**Corrected flow for Meta scheduled uploads:**

```
User clicks Upload with scheduled time →
Backend receives file, writes to /tmp/uploads/uuid.mp4 →
Backend returns 202 immediately (does NOT create Meta container yet) →
BullMQ delayed job fires at scheduled time →
  Worker: creates Meta container (POST /media with video_url)
  Worker: polls status_code every 5s until FINISHED (max 5 min)
  Worker: publishes (POST /media_publish)
  Worker: deletes /tmp/uploads/uuid.mp4
  Worker: UPDATE platform_posts SET upload_status='posted'
```

This means the `/tmp` file must persist until the scheduled time. A 24-hour maximum schedule window must be enforced in the UI (or the user is warned). The file cleanup job (1-hour max) must be disabled for scheduled posts — or the cleanup job must check whether a pending BullMQ job references the file before deleting it.

**Simple fix:** Store the file path in the BullMQ job data. In the age-based cleanup job, skip any file that has a pending/delayed BullMQ job referencing it. [ASSUMED — implementation pattern; verify with BullMQ job inspection API]

---

### ISSUE-4 (SPEC ERROR): upload_status column missing 'uploading' state

**Severity: MINOR — affects UX quality**

The spec defines `upload_status` as `pending | posted | failed | manual`. There is no `uploading` state. Without it, the frontend has no way to show a spinner during active upload — it jumps from `pending` to `posted` with no intermediate state visible.

**Fix:** Add `uploading` to the enum. The BullMQ worker sets `upload_status = 'uploading'` when it starts the actual upload (after the delay fires), then flips to `posted` or `failed` on completion.

---

### ISSUE-5 (SPEC ERROR): YouTube categoryId note

The spec says `categoryId (22 = People & Blogs)`. This is correct for the content niche (travel/lifestyle). Do NOT use `categoryId: '10'` (sometimes incorrectly cited as a "Shorts category"). There is no Shorts category — Shorts classification is determined by aspect ratio, duration, and `#Shorts` hashtag, not categoryId. [VERIFIED: YouTube API docs + community]

---

### ISSUE-6: Meta file size limit for Instagram Reels

**Severity: CONSTRAINT — may affect user experience**

Instagram Reels uploaded via the API have a **100 MB file size limit**. [VERIFIED: postproxy.dev guide citing Meta specs]

The tool allows uploads up to 250 MB. Videos between 100-250 MB will succeed for YouTube but fail for Instagram Reels. The user must be warned.

**Resolution:** Before queuing the Instagram upload, check `req.file.size`. If `> 100 * 1024 * 1024`, return a clear error: "This video is too large for Instagram Reels via API (max 100 MB). Use manual copy and upload directly in the Instagram app." Set `upload_status = 'failed'` with that message.

---

### ISSUE-7: Nginx COOP/COEP interaction with /uploads/ static serving

**Severity: LOW — potential misconfiguration**

The frontend already requires COOP/COEP headers on the main app route. The `/uploads/` static route serves video files to Meta's servers (not to the frontend), so COOP/COEP headers are **not needed** on the `/uploads/` location. However, adding them would cause issues for Meta's fetch of the video. Ensure the Nginx config does NOT add `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy` to the `/uploads/` location block. [ASSUMED — separation of Nginx location concerns]

---

## Implementation Notes (specific code patterns)

### YouTube Upload Worker

```typescript
// backend/src/workers/upload.worker.ts
import { Worker, Job } from 'bullmq'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import fs from 'fs'
import { db } from '../db/index.js'
import { platformPosts } from '../db/schema.js'
import { eq } from 'drizzle-orm'

interface YouTubeJobData {
  postId: string
  platformPostId: string
  filePath: string
  title: string
  description: string
  tags: string[]
  accessToken: string
  refreshToken: string
}

async function uploadToYouTube(job: Job<YouTubeJobData>) {
  const { platformPostId, filePath, title, description, tags, accessToken, refreshToken } = job.data

  // Mark as uploading
  await db.update(platformPosts)
    .set({ upload_status: 'uploading' })
    .where(eq(platformPosts.id, platformPostId))

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

  await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,       // Must include #Shorts for Shorts detection
        description,
        tags,
        categoryId: '22',  // People & Blogs — correct for travel/lifestyle
      },
      status: { privacyStatus: 'public' },
    },
    media: {
      mimeType: 'video/mp4',
      body: fs.createReadStream(filePath),
    },
  })

  await db.update(platformPosts)
    .set({ upload_status: 'posted', posted_at: new Date() })
    .where(eq(platformPosts.id, platformPostId))

  // Clean up temp file
  fs.unlink(filePath, () => {}) // fire-and-forget
}
```

---

### Instagram Reels Upload Worker

```typescript
// Create container AT JOB FIRE TIME (not before)
async function uploadToInstagram(job: Job) {
  const { platformPostId, filePath, caption, igUserId, accessToken } = job.data
  const fileUrl = `${process.env.VPS_PUBLIC_URL}/uploads/${path.basename(filePath)}`

  await db.update(platformPosts).set({ upload_status: 'uploading' }).where(eq(platformPosts.id, platformPostId))

  // Step 1: Create container
  const containerRes = await fetch(
    `https://graph.instagram.com/v19.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: fileUrl,
        caption,
        access_token: accessToken,
      }),
    }
  )
  const { id: containerId } = await containerRes.json()

  // Step 2: Poll until FINISHED (max 60 polls × 5s = 5 minutes)
  let status = 'IN_PROGRESS'
  let polls = 0
  while (status === 'IN_PROGRESS' && polls < 60) {
    await new Promise(r => setTimeout(r, 5000))
    const statusRes = await fetch(
      `https://graph.instagram.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`
    )
    const { status_code } = await statusRes.json()
    status = status_code
    polls++
  }

  if (status !== 'FINISHED') {
    // EXPIRED (container older than 24h), ERROR, or timeout
    const errorMsg = status === 'EXPIRED'
      ? 'Instagram container expired before publishing'
      : status === 'ERROR'
      ? 'Instagram processing failed — try uploading again'
      : 'Instagram processing timed out after 5 minutes'
    await db.update(platformPosts)
      .set({ upload_status: 'failed', error_message: errorMsg })
      .where(eq(platformPosts.id, platformPostId))
    return
  }

  // Step 3: Publish
  await fetch(`https://graph.instagram.com/v19.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  })

  await db.update(platformPosts)
    .set({ upload_status: 'posted', posted_at: new Date() })
    .where(eq(platformPosts.id, platformPostId))

  fs.unlink(filePath, () => {})
}
```

---

### Facebook Reels Upload Worker

```typescript
async function uploadToFacebook(job: Job) {
  const { platformPostId, filePath, description, title, pageId, pageAccessToken } = job.data

  await db.update(platformPosts).set({ upload_status: 'uploading' }).where(eq(platformPosts.id, platformPostId))

  // Step 1: Initialize upload session
  const initRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'START',
        access_token: pageAccessToken,
      }),
    }
  )
  const { video_id, upload_url } = await initRes.json()

  // Step 2: Upload video bytes to upload_url
  const fileStream = fs.createReadStream(filePath)
  const fileSize = fs.statSync(filePath).size
  await fetch(upload_url, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${pageAccessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize),
      'offset': '0',
      'file_size': String(fileSize),
    },
    body: fileStream,
  })

  // Step 3: Publish
  await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'FINISH',
        video_state: 'PUBLISHED',
        video_id,
        description,
        title,
        access_token: pageAccessToken,
      }),
    }
  )

  await db.update(platformPosts)
    .set({ upload_status: 'posted', posted_at: new Date() })
    .where(eq(platformPosts.id, platformPostId))

  fs.unlink(filePath, () => {})
}
```

Note: The Facebook Reels upload uses a direct byte upload to `upload_url` (returned from `upload_phase=START`), not a public `video_url`. This is different from Instagram's `video_url` approach. [VERIFIED: Meta Graph API Page Video Reels reference]

---

### BullMQ Scheduling — Peak Time Calculator

```typescript
// frontend/src/lib/schedule.ts

type Platform = 'youtube' | 'instagram' | 'facebook' | 'tiktok'

// PKT = UTC+5
const PKT_OFFSET_HOURS = 5

const PEAK_WINDOWS: Record<Platform, { days: number[]; hours: number[] }> = {
  youtube:   { days: [5, 6, 0],    hours: [18, 20] },  // Fri=5, Sat=6, Sun=0
  instagram: { days: [1, 3, 5],    hours: [19, 21] },  // Mon=1, Wed=3, Fri=5
  tiktok:    { days: [2, 4, 5],    hours: [20, 22] },  // Tue=2, Thu=4, Fri=5
  facebook:  { days: [3, 4],       hours: [20, 22] },  // Wed=3, Thu=4
}

export function getNextPeakTime(platform: Platform): Date {
  const now = new Date()
  const nowPKT = new Date(now.getTime() + PKT_OFFSET_HOURS * 60 * 60 * 1000)

  const { days, hours } = PEAK_WINDOWS[platform]

  // Find next slot in PKT time that is in the future
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(nowPKT)
    candidate.setDate(candidate.getDate() + daysAhead)
    const dayOfWeek = candidate.getDay()

    if (!days.includes(dayOfWeek)) continue

    for (const hour of hours) {
      candidate.setHours(hour, 0, 0, 0)
      // Convert back to UTC
      const candidateUTC = new Date(candidate.getTime() - PKT_OFFSET_HOURS * 60 * 60 * 1000)
      if (candidateUTC > now) return candidateUTC
    }
  }

  // Fallback: next available window next week
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
}
```

---

### Temp File Cleanup Job

```typescript
// backend/src/lib/cleanup.ts
import fs from 'fs'
import path from 'path'
import { Queue } from 'bullmq'

const UPLOADS_DIR = '/tmp/uploads'
const MAX_AGE_MS = 60 * 60 * 1000  // 1 hour

export async function cleanupStaleUploads(uploadQueue: Queue) {
  const files = fs.readdirSync(UPLOADS_DIR)
  const now = Date.now()

  // Get all delayed job file paths to protect them from deletion
  const delayed = await uploadQueue.getDelayed()
  const protectedPaths = new Set(delayed.map(j => j.data.filePath as string))

  for (const file of files) {
    const filePath = path.join(UPLOADS_DIR, file)
    const stat = fs.statSync(filePath)
    const ageMs = now - stat.mtimeMs

    if (ageMs > MAX_AGE_MS && !protectedPaths.has(filePath)) {
      fs.unlink(filePath, () => {})
    }
  }
}
```

Run via BullMQ repeatable job every 30 minutes:

```typescript
await cleanupQueue.add('cleanup-uploads', {}, {
  repeat: { every: 30 * 60 * 1000 },
  removeOnComplete: true,
})
```

---

### Redis Configuration for Production

```redis
# /etc/redis/redis.conf additions
appendonly yes
appendfsync everysec
maxmemory 200mb
maxmemory-policy noeviction
```

---

## Dependency Checklist (must be true before phase starts)

- [ ] Phase 1 complete: `platform_posts` table exists with `upload_status`, `posted_at` columns
- [ ] Phase 1 complete: BullMQ + Redis running, confirmed via `GET /health`
- [ ] Phase 2 complete: Google OAuth tokens stored in `settings.platform_config.youtube` (encrypted)
- [ ] Phase 2 complete: Instagram OAuth tokens stored in `settings.platform_config.instagram` (encrypted, using `instagram_business_content_publish` scope)
- [ ] Phase 2 complete: Facebook Page token stored in `settings.platform_config.facebook` with `page_id` (not just user token)
- [ ] Phase 2 complete: OAuth connect flow uses Instagram Login path (not Facebook Login path) for Instagram
- [ ] Phase 2 complete: Facebook OAuth requests `pages_show_list` + `pages_read_engagement` + `pages_manage_posts`; backend calls `GET /me/accounts` to get page_id + page_access_token
- [ ] Phase 5 complete: `platform_posts` row exists per platform with `caption`, `hashtags`, `predicted_min/max`
- [ ] VPS public HTTPS domain confirmed — Meta's `video_url` requires HTTPS
- [ ] Nginx `/uploads/` static serve location configured and tested
- [ ] Redis `appendonly yes` + `maxmemory-policy noeviction` configured
- [ ] Meta App created in developers.facebook.com, app in Development Mode
- [ ] Instagram professional account (Creator or Business) confirmed — personal account is a blocker
- [ ] Facebook Page exists and is linked to the user's account — personal profile is a blocker
- [ ] `platform_posts.upload_status` enum updated to include `'uploading'`
- [ ] `platform_posts` table has `error_message TEXT` column for failure details

---

## Estimated Risk: HIGH (reduced to MEDIUM with mitigations applied)

**Without mitigations:** HIGH. Two hard blockers exist.
**With mitigations applied (ISSUE-1 and ISSUE-2 resolved in plan):** MEDIUM.

### Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| User has personal Instagram account (no Creator/Business) | BLOCKER | HIGH — most personal users | User must switch account type in Instagram app (free, takes 2 minutes). Detect and surface clear instruction in UI. |
| User has no Facebook Page | BLOCKER | HIGH — most personal users | User must create a Facebook Page. Surface clear setup instruction in Settings. Skip Facebook upload gracefully if no page_id in config. |
| Meta App Review needed | BLOCKER | LOW | Personal tool stays in Development Mode. No review needed for single user. |
| Meta container EXPIRED for scheduled posts >24h | DATA LOSS | HIGH (if spec flow followed) | Fixed by ISSUE-3: create container inside BullMQ worker, not at upload time. |
| Instagram video >100MB rejected | UX FAILURE | MEDIUM (travel/hotel videos are often large) | Check file size before queuing, surface clear error. |
| Redis loses delayed jobs (no persistence) | DATA LOSS | HIGH (default Redis has no AOF) | Configure `appendonly yes` in Redis. Must be done in Phase 1. |
| VPS public URL not HTTPS | BLOCKER | LOW (Nginx + Let's Encrypt is standard) | Ensure VPS has valid TLS cert. Meta rejects `http://` URLs. |
| Upload to YouTube while OAuth token expired | AUTH FAILURE | MEDIUM | Token refresh logic in `oauth.ts` must run before job fires. Check `expires_in < 300s` and refresh proactively. |

---

## Sources

### HIGH Confidence (verified against official documentation)
- [Meta IG Container reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-container/) — status_code values
- [Meta content publishing guide](https://developers.facebook.com/docs/instagram-platform/content-publishing/) — Instagram Reels flow, rate limits, account requirements
- [Meta content_publishing_limit endpoint](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/) — 50-post per 24h limit
- [Meta Page Video Reels API reference](https://developers.facebook.com/docs/graph-api/reference/page/video_reels/) — Facebook Reels endpoint, upload_phase values
- [Meta Reels publishing guide](https://developers.facebook.com/docs/video-api/guides/reels-publishing/) — page-only requirement confirmed
- [Meta Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/) — No Facebook Page required, new scopes
- [Meta App Modes docs](https://developers.facebook.com/docs/development/build-and-test/app-modes/) — Development Mode, no App Review for self-use
- [Google YouTube Resumable Upload Protocol](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol) — chunk size, resume protocol
- [BullMQ Delayed Jobs](https://docs.bullmq.io/guide/jobs/delayed) — delay API, sorted set storage
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production) — AOF, noeviction requirement

### MEDIUM Confidence (verified via multiple community sources aligned with official docs)
- [postproxy.dev Instagram Reels guide](https://postproxy.dev/blog/instagram-reels-api-publishing-guide/) — complete 3-step flow, 100MB limit, scope deprecation
- [BullMQ internals article](https://medium.com/@gaurav.bhe.24/how-bullmq-and-redis-work-together-to-never-miss-a-scheduled-job-953f8c197314) — delayed job sorted set, worker restart recovery
- [googleapis Node.js README](https://github.com/googleapis/google-api-nodejs-client/blob/main/README.md) — media.body stream support
- [Instagram scope deprecation — gist](https://gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc) — Instagram Login flow July 2024
- Multiple sources confirming Facebook Reels = Pages only, personal profile blocked
