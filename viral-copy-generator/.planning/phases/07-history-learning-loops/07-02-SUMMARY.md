---
phase: 07-history-learning-loops
plan: 02
status: complete
files_modified:
  - backend/src/routes/learning.ts
  - backend/src/app.ts
---

## What Was Built

Five GET endpoints under `/api/learning/` that power the Insights screen and pre-generation learning injection:

1. **GET /api/learning/hooks** — Returns top 5 hooks ordered by `MAX(actual_views) DESC` per optional niche filter. Uses MAX not AVG to surface viral ceiling rather than average performance. Query branches on niche param presence to keep all values fully parameterized.

2. **GET /api/learning/hashtags** — Expands `hashtags TEXT[]` via `unnest(hashtags)` into individual rows, then aggregates `AVG(actual_views)` per hashtag. Supports optional `niche` and `platform` filter params, each bound as parameterized values. Returns top 10 by avg views.

3. **GET /api/learning/posting-times** — Extracts `DOW` and `HOUR` from `platform_posts.posted_at AT TIME ZONE 'Asia/Karachi'` (UTC+5, no DST). Filters `upload_status = 'posted'` and requires `posted_at IS NOT NULL`. `HAVING COUNT(*) >= 2` prevents noise from single-post samples.

4. **GET /api/learning/niche-performance** — Groups `learning_signals` by `COALESCE(niche, 'Other')` to safely handle NULL niches. Returns `avg_views`, `max_views`, and `total_posts` per niche, ordered by avg views descending.

5. **GET /api/learning/weights** — Reads `settings.learned_weights JSONB` for the user. Returns `{ learned_weights, data_points, is_calibrated }` where `is_calibrated = data_points >= 10`. Uses Drizzle ORM `.select()` (not raw SQL) since it is a simple primary key lookup.

`app.ts` updated: `learningRouter` imported and mounted at `/api/learning` after `platformPostsRouter`, inheriting the global `authMiddleware` applied at `/api`.

## Key Decisions

- **Branched SQL instead of conditional fragments**: The plan's template used `${niche ? sql\`AND niche = ${niche}\` : sql\`\`}` conditional SQL fragments inside a single query. This approach can produce TypeScript issues depending on Drizzle version and causes the conditional value to appear as an empty SQL tag which some drivers stringify unexpectedly. Replaced with explicit query branches (if/else) that keep every query string statically defined. Each branch binds its params fully via `sql` template literals — no string interpolation into raw SQL at any point. This is the correct pattern per the threat model (T-07-08, T-07-09).

- **`/niche-performance` route name**: Plan frontmatter and must_haves reference both `/summary` (in one truth) and `/niche-performance` (in artifact path). Used `/niche-performance` as specified in the artifact path and the executor prompt.

- **`learning_signals` not imported from schema in final file**: The raw `db.execute(sql\`...\`)` queries reference table names as string literals inside SQL. The `settings` table is imported for the ORM-style weights query. `learning_signals` and `platform_posts` are referenced by table name only in raw SQL — this is correct for `db.execute()` usage.

## Deviations

- **Query branching instead of conditional SQL fragments**: Replaced inline `${condition ? sql\`...\` : sql\`\`}` conditional fragments with explicit if/else branches that each hold a complete, static SQL string. This eliminates potential empty-fragment edge cases and makes parameterization unambiguous. Functionally equivalent result.

## Verification

**TypeScript compile:** `npx tsc --noEmit` — no output, exit 0 (clean).

**Grep results:**

| Pattern | File | Matches | Expected |
|---------|------|---------|----------|
| `unnest(hashtags)` | learning.ts | 4 (one per query branch) | >= 1 |
| `MAX(actual_views)` | learning.ts | present in hooks + niche-performance | >= 1 |
| `Asia/Karachi` | learning.ts | 4 (DOW + HOUR per each query branch) | >= 2 |
| `HAVING COUNT` | learning.ts | 2 SQL occurrences (both platform branches) | >= 1 |
| `COALESCE(niche` | learning.ts | present (SELECT + GROUP BY) | >= 1 |
| `learningRouter` | app.ts | 2 (import + use) | 2 |
| `learningRouter.get` | learning.ts | 5 | 5 |

All checks passed.

## Self-Check: PASSED

- `backend/src/routes/learning.ts` — exists, 5 endpoints confirmed
- `backend/src/app.ts` — contains `learningRouter` import and `app.use('/api/learning', learningRouter)`
- Commit `18ecaab` — confirmed in git log
- TypeScript: clean compile
