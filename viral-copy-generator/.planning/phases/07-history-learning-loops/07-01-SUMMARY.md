---
phase: 07-history-learning-loops
plan: 01
status: complete
files_modified:
  - backend/src/routes/posts.ts
  - backend/src/routes/platformPosts.ts
  - backend/src/app.ts
---

## What Was Built

- **GET /api/posts** (full implementation replacing stub): filters by platform (EXISTS subquery), niche, and date range (from/to); returns posts ordered newest-first with a nested `platforms[]` array per post fetched via a single batch query on platform_posts; all filters combine with AND; userId always from res.locals.
- **DELETE /api/posts/:id**: validates ownership with `WHERE id = postId AND user_id = userId`; returns 404 on mismatch (avoids UUID enumeration per threat model T-07-02); delete cascades to platform_posts and learning_signals via FK ON DELETE CASCADE.
- **POST /api/platform-posts/:platformPostId/views** (new file `platformPosts.ts`): validates actualViews as non-negative integer; confirms platform_post ownership; computes accuracy label (overperformed/matched/underperformed) at ±20% of predictedMid; executes all 4 writes inside a single `db.transaction()` — update actual_views, insert learning_signal, conditional EMA update.
- **EMA calibration** (Write 4, conditional): fires only when dataPoints >= 10; delta capped ±15%; formula `newEMA = 0.3 × clampedDelta + 0.7 × prevEMA`; settings updated via JSONB `|| patch::jsonb` merge (never full column replace).
- **app.ts**: imports and mounts `platformPostsRouter` at `/api/platform-posts` after the upload router.

## Key Decisions

- **EXISTS subquery for platform filter** — a JOIN on platform_posts would produce duplicate post rows when a single post has multiple platform entries (e.g., one youtube + one instagram row). EXISTS returns exactly one row per post regardless of how many platform_posts rows match.
- **Batch platform_posts fetch after main query** — fetching all platform_posts for the returned post IDs in one query (using `inArray`) and grouping in JS is more efficient than N+1 subqueries per post.
- **404 not 403 for ownership mismatch on DELETE** — prevents UUID enumeration: an attacker guessing post IDs receives the same 404 whether the post doesn't exist or belongs to another user (T-07-02 mitigation).
- **Transaction boundary covers all 4 writes** — if the EMA update or learning_signal insert fails, the actual_views update also rolls back, preventing partial state that would corrupt learning loops.
- **dataPoints count taken before insert** — the count is computed before the transaction so the EMA gate (`>= 10`) reflects confirmed prior signals; after the current insert the user will have `dataPoints + 1` signals.
- **VALID_PLATFORMS and VALID_NICHES allowlists before EXISTS query** — prevents injection of arbitrary platform strings into the parameterised SQL; Drizzle's bound params protect against SQL injection but allowlist rejection gives a clean 400-equivalent (silently ignores invalid values by not adding the filter condition, per plan design).

## Deviations

None — plan executed exactly as written.

## Verification

```
npx tsc --noEmit  →  (no output) — clean compile, zero errors
```

Verification grep results (all passed):
- `EXISTS.*SELECT 1 FROM platform_posts` found in posts.ts line 24
- `orderBy(desc(posts.created_at))` found in posts.ts line 41
- `db.transaction` found in platformPosts.ts line 86
- `::jsonb` found in platformPosts.ts line 122
- `dataPoints >= 10` found in platformPosts.ts line 110
- `platformPostsRouter` found in app.ts lines 12 + 76
- No `req.body.userId` / `body.user_id` / `body.userId` in either route file

## Self-Check: PASSED

Files confirmed on disk:
- backend/src/routes/posts.ts — exists, GET stub replaced, DELETE added
- backend/src/routes/platformPosts.ts — exists, new file
- backend/src/app.ts — platformPostsRouter imported and mounted

Commit e898381 confirmed in git log.
