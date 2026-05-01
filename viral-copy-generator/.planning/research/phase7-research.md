# Phase 7 Deep Research

**Phase:** 7 — History + Learning Loops
**Researched:** 2026-04-30
**Requirements covered:** HISTORY-01 through HISTORY-06, LEARNING-01 through LEARNING-08

---

## Confirmed Approach (no changes needed)

### 1. unnest() is correct and efficient for this use case

`unnest()` on a `TEXT[]` column is the standard PostgreSQL approach for exploding array rows
into individual values for aggregation. For the dataset sizes this tool will ever reach
(hundreds of rows, not millions), performance is not a concern. The correct query pattern for
hashtag learning is a subquery that joins `platform_posts` (which holds the `hashtags TEXT[]`)
to `learning_signals` (which holds the `actual_views`), then unnests.

However, the spec's hashtag query has a structural problem: it selects `hashtag` from
`learning_signals` directly, but `learning_signals.hashtags` is a `TEXT[]` column, not a
scalar. The query in the spec needs `unnest()` applied to the `learning_signals.hashtags`
column directly:

```sql
-- CORRECT: explode hashtags array in learning_signals, then aggregate
SELECT
  unnest(hashtags) AS hashtag,
  AVG(actual_views)::integer AS avg_views
FROM learning_signals
WHERE niche = $1
  AND platform = $2
GROUP BY hashtag
ORDER BY avg_views DESC
LIMIT 10;
```

This works because `unnest()` in the `SELECT` list expands each row into N rows (one per
hashtag). PostgreSQL 17 handles this correctly and HAVING COUNT(*) >= 2 can be added to
filter out one-off outliers if desired later.

**In Drizzle ORM:** Drizzle cannot build this query with the fluent builder (no native `unnest`
support). Use `db.execute(sql`...`)` with the `sql` template tag. Confirmed pattern from
official Drizzle docs: [VERIFIED: orm.drizzle.team/docs/sql]

```typescript
// backend/src/lib/learning.ts
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'

export async function getTopHashtags(niche: string, platform: string, limit = 10) {
  const rows = await db.execute<{ hashtag: string; avg_views: number }>(sql`
    SELECT
      unnest(hashtags) AS hashtag,
      AVG(actual_views)::integer AS avg_views
    FROM learning_signals
    WHERE niche = ${niche}
      AND platform = ${platform}
    GROUP BY hashtag
    ORDER BY avg_views DESC
    LIMIT ${limit}
  `)
  return rows.rows
}
```

The `sql` template tag automatically parameterises `${niche}`, `${platform}`, and `${limit}`
to prevent SQL injection. [VERIFIED: orm.drizzle.team/docs/sql]

### 2. Hook learning: use MAX(actual_views) per distinct hook_text, not AVG

The spec says "top 5 hooks per niche ranked by actual views." This is ambiguous — if the same
hook_text appears in multiple posts, should we average or take the max?

**Decision: take MAX(actual_views).** Reasoning:

- The purpose of hook learning is to surface hooks that can go viral — the single best
  performance of a hook is the strongest signal of its potential, not its average.
- AVG rewards hooks used many times with mediocre results and punishes lucky one-hit hooks.
- For a single creator with tens to hundreds of posts (not thousands), the sample sizes per
  hook are too small for averaging to be statistically meaningful.
- If a hook text appears in 3 posts and gets 5K, 8K, and 45K views, the AVG (19K) undersells
  the hook. MAX (45K) surfaces it correctly.

```sql
SELECT hook_text, MAX(actual_views) AS top_views
FROM learning_signals
WHERE niche = $1
  AND hook_text IS NOT NULL
GROUP BY hook_text
ORDER BY top_views DESC
LIMIT 5;
```

In Drizzle with the `sql` template tag:

```typescript
export async function getTopHooks(niche: string, limit = 5) {
  const rows = await db.execute<{ hook_text: string; top_views: number }>(sql`
    SELECT hook_text, MAX(actual_views)::integer AS top_views
    FROM learning_signals
    WHERE niche = ${niche}
      AND hook_text IS NOT NULL
    GROUP BY hook_text
    ORDER BY top_views DESC
    LIMIT ${limit}
  `)
  return rows.rows
}
```

**Cold start (< 5 data points):** Add `HAVING COUNT(*) >= 1` if desired, but the cold-start
guard belongs in the calling code, not the SQL. If `rows.length < 5`, the caller falls back to
a hardcoded hook hint. Do not return partial results and inject them — 0 results means full
fallback; N >= 5 results means full injection.

### 3. EMA formula for score calibration: correct storage and update calculation

**EMA formula:**
```
newEMA = α × newValue + (1 − α) × prevEMA
```

Where `α` (alpha) is the smoothing factor. For score calibration, the recommended value is
`α = 0.3`. This gives 30% weight to the newest data point and 70% to the accumulated history.
Reasoning: a solo creator generates roughly 1 video per day maximum; with α = 0.3 the EMA
has an effective lookback of roughly 3 data points worth of full weight. This damps outliers
(a single viral post won't fully shift the formula) while still being responsive to genuine
audience shift. [ASSUMED — α = 0.3 is a judgment call; α values between 0.2 and 0.4 are all
defensible for this use case]

**What is stored:** The `learned_weights` JSONB in the `settings` table stores per-signal
weight deltas (not raw weights). Each delta is the EMA of the ±5% adjustments applied to that
signal:

```json
{
  "hookStrength": 0.07,
  "pacing": -0.03,
  "facePresence": 0.12,
  "audioEnergy": 0.0,
  "durationFit": -0.05,
  "aspectRatio": 0.0,
  "brightness": 0.02,
  "dataPoints": 14
}
```

`dataPoints` is an integer counter. All deltas start at 0.0. Deltas are capped at ±0.15 (i.e.
±15% of the signal's baseline weight fraction).

**Update calculation on a new logged view:**

```typescript
// backend/src/lib/learning.ts

const ALPHA = 0.3
const MAX_DELTA = 0.15
const MIN_DATA_POINTS = 10

interface LearnedWeights {
  hookStrength: number
  pacing: number
  facePresence: number
  audioEnergy: number
  durationFit: number
  aspectRatio: number
  brightness: number
  dataPoints: number
}

function updateWeightEMA(
  current: LearnedWeights,
  signalsPresent: string[],
  outcome: 'overperformed' | 'matched' | 'underperformed'
): LearnedWeights {
  const delta = outcome === 'overperformed' ? 0.05
              : outcome === 'underperformed' ? -0.05
              : 0.0

  const updated = { ...current, dataPoints: current.dataPoints + 1 }

  const signalKeys: (keyof LearnedWeights)[] = [
    'hookStrength', 'pacing', 'facePresence', 'audioEnergy',
    'durationFit', 'aspectRatio', 'brightness'
  ]

  for (const key of signalKeys) {
    if (key === 'dataPoints') continue
    const contribution = signalsPresent.includes(key) ? delta : 0.0
    const prevEMA = current[key] as number
    const newEMA = ALPHA * contribution + (1 - ALPHA) * prevEMA
    // Cap at ±15%
    updated[key] = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, newEMA)) as never
  }

  return updated
}
```

**Resetting to baseline when < 10 data points:**
The `dataPoints` counter in the JSONB controls this. When `score.ts` reads `learned_weights`
from the settings endpoint:

```typescript
// frontend/src/lib/score.ts
function applyLearnedWeights(baseline: Weights, learned: LearnedWeights | null): Weights {
  if (!learned || learned.dataPoints < 10) return baseline // cold start — use baseline
  return {
    hookStrength:  clamp(baseline.hookStrength  + learned.hookStrength,  0, 1),
    pacing:        clamp(baseline.pacing        + learned.pacing,        0, 1),
    facePresence:  clamp(baseline.facePresence  + learned.facePresence,  0, 1),
    audioEnergy:   clamp(baseline.audioEnergy   + learned.audioEnergy,   0, 1),
    durationFit:   clamp(baseline.durationFit   + learned.durationFit,   0, 1),
    aspectRatio:   clamp(baseline.aspectRatio   + learned.aspectRatio,   0, 1),
    brightness:    clamp(baseline.brightness    + learned.brightness,    0, 1),
  }
}
```

After clamping individual weights, renormalise so they still sum to 1.0.

### 4. Cold start thresholds: enforce in calling code, not in SQL

The spec defines two cold start thresholds:
- Hashtags / hooks: fall back to hardcoded bank if fewer than 5 data points
- Score calibration: reset to baseline if fewer than 10 data points

**How to enforce these cleanly:**

For hashtag/hook learning — check `rows.length` after the query:
```typescript
const hooks = await getTopHooks(niche)
const topHooks = hooks.length >= 5 ? hooks : null  // null = caller uses hardcoded bank
```

For score calibration — check `dataPoints` in the JSONB (already shown above):
```typescript
if (!learned || learned.dataPoints < 10) return baseline
```

Do NOT put threshold logic in SQL (e.g. `HAVING COUNT(*) >= 5`). Putting the threshold in SQL
silently returns 0 rows when there are 4 data points — then the caller cannot distinguish
"0 data points ever" from "4 data points, below threshold." Returning all rows and checking
length in the application layer is clearer.

**The spec's hashtag query does not include the fallback guard in SQL.** Confirmed: the guard
belongs in `prompt.ts` (browser) after receiving the response from `GET /learning/hashtags`.

### 5. Score accuracy bar chart: pure Tailwind CSS divs, no chart library

The spec says "simple bar" and "no charting library." The simplest correct implementation is
a horizontal bar chart using CSS flex and percentage-width divs. The data structure is an
array of `{ label, predicted, actual }` per post, displayed as two side-by-side bars.

For a "score accuracy over time" chart, the axis is chronological (posts ordered by
`created_at`) and the two bar series are predicted mid-range and actual_views.

**Data normalisation:** Since predicted and actual are raw view counts on potentially very
different scales (predicted 2K–10K range vs actual 45K), normalise to 0–100 where 100 = the
maximum value across the entire dataset. This makes the bar widths comparable.

```typescript
// Normalise to percentage of max for bar width
function normaliseForChart(data: { label: string; predicted: number; actual: number }[]) {
  const max = Math.max(...data.map(d => Math.max(d.predicted, d.actual)))
  return data.map(d => ({
    label: d.label,
    predictedPct: max > 0 ? Math.round((d.predicted / max) * 100) : 0,
    actualPct:    max > 0 ? Math.round((d.actual    / max) * 100) : 0,
  }))
}
```

**Tailwind CSS bar component (no JavaScript charting library):**
```tsx
// LearningInsightCard.tsx — score accuracy section
{normalised.map((row) => (
  <div key={row.label} className="mb-3">
    <div className="text-xs text-gray-400 mb-1">{row.label}</div>
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-16">Predicted</span>
        <div className="flex-1 bg-gray-800 rounded h-3">
          <div
            className="bg-blue-500 h-3 rounded transition-all"
            style={{ width: `${row.predictedPct}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-16">Actual</span>
        <div className="flex-1 bg-gray-800 rounded h-3">
          <div
            className={`h-3 rounded transition-all ${
              row.actualPct > row.predictedPct ? 'bg-green-500' : 'bg-red-400'
            }`}
            style={{ width: `${row.actualPct}%` }}
          />
        </div>
      </div>
    </div>
  </div>
))}
```

The `style={{ width: '${pct}%' }}` inline style is required because Tailwind does not
generate dynamic width classes at runtime (you cannot use `w-[${pct}%]` in JSX — Tailwind
purges classes it doesn't see at build time). Inline style for the width value only is the
correct and minimal exception to the "no inline styles" preference.

**Minimum data points before showing the chart:** Show the chart once there is at least 1
post with both a predicted range and actual_views logged. Display a placeholder message ("Log
views on your first post to see accuracy trends") when no data exists yet. Do not gate on 5
or 10 points — the chart is useful from the very first data point.

### 6. Best posting times from data: group by hour-of-day, minimum 5 data points per hour slot

The PostgreSQL query to find best posting times:

```sql
SELECT
  platform,
  EXTRACT(DOW FROM posted_at AT TIME ZONE 'Asia/Karachi')::integer AS day_of_week,
  EXTRACT(HOUR FROM posted_at AT TIME ZONE 'Asia/Karachi')::integer AS hour_of_day,
  AVG(actual_views)::integer AS avg_views,
  COUNT(*) AS post_count
FROM platform_posts
WHERE actual_views IS NOT NULL
  AND posted_at IS NOT NULL
GROUP BY platform, day_of_week, hour_of_day
HAVING COUNT(*) >= 2
ORDER BY platform, avg_views DESC;
```

Notes:
- Convert to PKT (`Asia/Karachi`, UTC+5) at the DB level, not in application code.
  PostgreSQL 17 handles DST-aware timezone conversion (though PKT has no DST).
- `HAVING COUNT(*) >= 2` filters slots with fewer than 2 posts — a single post in a slot is
  too noisy to be a useful signal. The spec says "minimum data points before showing" is not
  defined; 2 is a reasonable floor. Show "Not enough data yet" when no slot has 2+ posts.
- `DOW` returns 0 = Sunday, 6 = Saturday (PostgreSQL convention).
- Group by both `day_of_week` AND `hour_of_day` to find the intersection. If the dataset is
  sparse (< 20 posts), consider grouping by `hour_of_day` only (ignoring day-of-week) so
  there are enough observations per slot.

**Minimum data points before showing:** Show "best hours" data once there are at least 2
posts with actual_views in the same platform + hour slot. Show "best day + hour" combos once
there are at least 2 posts in the same platform + day + hour slot. The route should return an
empty array when no slot qualifies — the frontend renders a "keep logging views to see
trends" placeholder.

In Drizzle raw SQL:
```typescript
export async function getBestPostingTimes() {
  const rows = await db.execute<{
    platform: string
    day_of_week: number
    hour_of_day: number
    avg_views: number
    post_count: number
  }>(sql`
    SELECT
      platform,
      EXTRACT(DOW FROM posted_at AT TIME ZONE 'Asia/Karachi')::integer AS day_of_week,
      EXTRACT(HOUR FROM posted_at AT TIME ZONE 'Asia/Karachi')::integer AS hour_of_day,
      AVG(actual_views)::integer AS avg_views,
      COUNT(*)::integer AS post_count
    FROM platform_posts
    WHERE actual_views IS NOT NULL
      AND posted_at IS NOT NULL
    GROUP BY platform, day_of_week, hour_of_day
    HAVING COUNT(*) >= 2
    ORDER BY platform, avg_views DESC
  `)
  return rows.rows
}
```

### 7. Niche performance breakdown: straightforward GROUP BY, one edge case to handle

Query:
```sql
SELECT niche, AVG(actual_views)::integer AS avg_views, COUNT(*) AS post_count
FROM learning_signals
WHERE actual_views IS NOT NULL
GROUP BY niche
ORDER BY avg_views DESC;
```

**The edge case:** `niche` in `posts` is "detected by engine" — it comes from TF.js scene
labels matched against niche keywords. This detection can produce `NULL` (no match) or a
value not in the predefined niche list (if the engine sees a new label combination). The
query must handle `NULL` niche gracefully:

```sql
SELECT
  COALESCE(niche, 'Other') AS niche,
  AVG(actual_views)::integer AS avg_views,
  COUNT(*)::integer AS post_count
FROM learning_signals
WHERE actual_views IS NOT NULL
GROUP BY COALESCE(niche, 'Other')
ORDER BY avg_views DESC;
```

This ensures `NULL` niches are bucketed as "Other" rather than silently excluded from the
breakdown or causing NaN in averages. No minimum post count threshold is needed here — even
a single post per niche is useful for the breakdown display.

Additionally, `settings.default_niche` (user's manually set default) and engine-detected
niche can differ. When the engine does not detect a niche (`niche IS NULL` in posts), the
backend should fall back to `settings.default_niche` when writing to `learning_signals`.
This should be implemented in the `PATCH /platform-posts/:id/views` handler.

### 8. Post history filter: Drizzle optional WHERE with and() + undefined

The confirmed pattern from official Drizzle documentation is:

```typescript
// backend/src/routes/platformPosts.ts
import { and, eq, gte, lte, inArray } from 'drizzle-orm'

export async function listPosts(filters: {
  platform?: string
  niche?: string
  dateFrom?: Date
  dateTo?: Date
}) {
  return db
    .select()
    .from(posts)
    .where(
      and(
        filters.niche    ? eq(posts.niche, filters.niche)             : undefined,
        filters.dateFrom ? gte(posts.created_at, filters.dateFrom)    : undefined,
        filters.dateTo   ? lte(posts.created_at, filters.dateTo)      : undefined,
      )
    )
    .orderBy(desc(posts.created_at))
}
```

For `platform` filter, the join is on `platform_posts`:
```typescript
.innerJoin(platformPosts, eq(posts.id, platformPosts.post_id))
.where(
  and(
    filters.platform ? eq(platformPosts.platform, filters.platform) : undefined,
    filters.niche    ? eq(posts.niche, filters.niche)               : undefined,
    // ... date filters
  )
)
```

[VERIFIED: orm.drizzle.team/docs/guides/conditional-filters-in-query]

When all filters are `undefined`, `and(undefined, undefined, ...)` returns `undefined` and
Drizzle omits the WHERE clause entirely — returning all posts. This is the correct fallback
for the unfiltered "all posts" view.

### 9. Learning injection timing: fetch fresh before every AI call, but it's cheap

**Decision: fetch fresh before every AI call.** Do not cache per session.

Reasoning for this tool specifically:
- The user generates 1–3 posts per session, not dozens.
- The user may log views from a previous post in the same session, updating learning data.
  If we cache at session start and they log views mid-session, the next generation would miss
  the update.
- The two learning queries (top hooks, top hashtags) are lightweight SELECTs on a table that
  will have at most hundreds of rows for a solo creator. Each query takes < 5ms.
- Network round-trip to localhost is negligible (the backend is on the same VPS as the
  frontend serves from).

**Implementation:** Call `GET /learning/hooks` and `GET /learning/hashtags` in parallel
immediately before building the AI prompt, not at page load:

```typescript
// frontend/src/lib/prompt.ts
export async function buildPrompt(signals: EngineSignals, niche: string, platform: string) {
  const [hooks, hashtags] = await Promise.all([
    api.getLearningHooks(niche),
    api.getLearningHashtags(niche, platform),
  ])
  // proceed with prompt construction using hooks and hashtags
}
```

This is 2 cheap DB queries + 1 network hop. Staleness window is effectively zero.

**Contrast with learned_weights (score calibration):** `learned_weights` is fetched once at
page load and stored in React state — this is acceptable because it is used for the
pre-generation virality score display, not for prompt injection. If the user logs views after
the page loads, they would need to refresh to see the updated score formula. This is a
reasonable tradeoff for a personal tool.

### 10. View logging write path: single DB transaction is required

When the user logs actual views, four things must happen atomically:
1. `UPDATE platform_posts SET actual_views = $1, views_logged_at = now() WHERE id = $2`
2. Compute score_accuracy (overperformed / matched / underperformed) based on predicted range
3. `INSERT INTO learning_signals (niche, platform, hook_text, hashtags, virality_score, actual_views, score_accuracy)`
4. If overperformed or underperformed: `UPDATE settings SET learned_weights = $computed`

**All 4 operations must be in a single DB transaction.** If step 3 fails (INSERT into
learning_signals), the actual_views on platform_posts should not be committed — otherwise the
user sees views logged but no learning data was created. If step 4 fails (learned_weights
update), the learning_signals row should not be committed.

Drizzle ORM transaction pattern [VERIFIED: orm.drizzle.team/docs/transactions]:

```typescript
// backend/src/routes/platformPosts.ts
export async function logActualViews(platformPostId: string, actualViews: number) {
  return await db.transaction(async (tx) => {
    // Step 1: Fetch the post and its parent to get niche, hook_text, etc.
    const [pp] = await tx
      .select({
        id: platformPosts.id,
        platform: platformPosts.platform,
        predictedMin: platformPosts.predicted_min,
        predictedMax: platformPosts.predicted_max,
        hashtags: platformPosts.hashtags,
        postId: platformPosts.post_id,
      })
      .from(platformPosts)
      .where(eq(platformPosts.id, platformPostId))

    if (!pp) tx.rollback()

    const [post] = await tx
      .select({ niche: posts.niche, hookText: posts.hook_text, viralityScore: posts.virality_score, engineSignals: posts.engine_signals })
      .from(posts)
      .where(eq(posts.id, pp.postId))

    // Step 2: Compute accuracy
    const accuracy: 'overperformed' | 'matched' | 'underperformed' =
      actualViews > pp.predictedMax  ? 'overperformed'  :
      actualViews < pp.predictedMin  ? 'underperformed' :
      'matched'

    // Step 3: Update platform_posts
    await tx
      .update(platformPosts)
      .set({ actual_views: actualViews, views_logged_at: new Date() })
      .where(eq(platformPosts.id, platformPostId))

    // Step 4: Insert learning_signals
    await tx.insert(learningSignals).values({
      niche: post.niche,
      platform: pp.platform,
      hook_text: post.hookText,
      hashtags: pp.hashtags,
      virality_score: post.viralityScore,
      actual_views: actualViews,
      score_accuracy: accuracy,
    })

    // Step 5: Update learned_weights if performance signal is non-neutral
    if (accuracy !== 'matched') {
      const [settings] = await tx.select({ learnedWeights: settingsTable.learned_weights }).from(settingsTable)
      const current: LearnedWeights = settings.learnedWeights ?? DEFAULT_WEIGHTS
      const signalsPresent = extractPresentSignals(post.engineSignals)
      const updated = updateWeightEMA(current, signalsPresent, accuracy)
      await tx.update(settingsTable).set({ learned_weights: updated })
    }

    return { accuracy, actualViews }
  })
}
```

**Failure mode if not transactional:**
- `actual_views` is saved but `learning_signals` INSERT fails → user sees "views logged" in
  the UI but no learning data was created. The hashtag/hook queries will never include this
  post. Score calibration will never count this data point. The inconsistency is invisible to
  the user but silently corrupts the learning loops over time.

**Failure mode if transaction fails mid-way:**
- Drizzle rolls back everything automatically (transaction throws + auto-rollback).
- The route returns a 500. The frontend should show "Failed to save views — try again."
- The user can retry. No partial state is committed.

---

## Issues Found (must fix in plan)

### Issue 1: Schema mismatch — `learned_weights` must live in `settings`, not as a separate column

The spec's database schema shows a `settings` table with no `learned_weights` column. The
Phase 4 research already flagged this and specified adding it. **This must be confirmed as
present in the Phase 1 migration.** Phase 7 PATCH /platform-posts/:id/views handler
writes to `settings.learned_weights` JSONB — if the column does not exist, the write will
throw a DB error. The plan must verify the Phase 1 migration added this column before any
Phase 7 task begins.

**Fix in plan:** Wave 0 task: verify `settings.learned_weights JSONB DEFAULT NULL` exists in
the Drizzle schema and migration. If missing, add a new migration before Phase 7 work begins.

### Issue 2: The spec's hashtag query in the spec itself is wrong

The spec's Loop 1 query:
```sql
SELECT hashtag, AVG(actual_views) as avg_views
FROM learning_signals
WHERE niche = $niche AND platform = $platform
GROUP BY hashtag
ORDER BY avg_views DESC
LIMIT 10
```

This query references `hashtag` (singular, scalar) but `learning_signals.hashtags` is a
`TEXT[]` column. PostgreSQL will throw: `column "hashtag" does not exist`. The correct query
uses `unnest(hashtags) AS hashtag` in the SELECT. See Confirmed Approach section 1 for the
corrected query. **The plan must use the corrected unnest query, not the spec's query
verbatim.**

### Issue 3: `niche` can be NULL — learning queries break silently

Engine-detected niche may be `NULL` when TF.js labels don't match any of the 6 predefined
niches. All three learning queries (hashtags, hooks, niche breakdown) are filtered by
`WHERE niche = $niche`. If niche is NULL, the WHERE clause returns 0 rows and learning data
from NULL-niche posts is silently excluded forever.

**Fix in plan:**
- In the `PATCH /platform-posts/:id/views` handler: when `post.niche IS NULL`, read
  `settings.default_niche` and use that as the `niche` value written to `learning_signals`.
- This ensures all posts contribute to learning under at least the user's default niche,
  even when engine detection fails.

### Issue 4: `learning_signals.hashtags` is a TEXT[] but the schema shows it as TEXT[]

Confirm that the `learning_signals` table in the Drizzle schema uses `.array()` on the
hashtags field. The Drizzle declaration must be:

```typescript
hashtags: text('hashtags').array(),
```

Not `text('hashtags')` (scalar). If it was declared as scalar in Phase 1, the INSERT in
the view logging handler will fail when passing an array. The plan must include a Wave 0
verification step checking the Drizzle schema declaration for this column.

### Issue 5: `extractPresentSignals` function must exist before view logging handler

The view logging transaction (step 5) calls `extractPresentSignals(post.engine_signals)` to
determine which formula signals were present in the post. This function must:
- Parse the `engine_signals` JSONB (which is the raw `EngineSignals` object saved by Phase 3)
- Return a string array of signal keys that "fired" (e.g., `['hookStrength', 'facePresence']`)
- Map signal presence to the 7 weight keys used by the formula

This function is backend logic and does not exist in Phase 1-6. It must be created in Phase 7
as part of `backend/src/lib/learning.ts`. The plan must include this as an explicit task, not
assume it exists.

**Signal presence mapping:**
```typescript
function extractPresentSignals(engineSignals: EngineSignals): string[] {
  const present: string[] = []
  if (engineSignals.sceneChangeInFirst3s || engineSignals.motionScore > 50) present.push('hookStrength')
  if (engineSignals.sceneCount > 3) present.push('pacing')
  if (engineSignals.faceDetected) present.push('facePresence')
  if (engineSignals.audioEnergy > 50) present.push('audioEnergy')
  if (engineSignals.durationFit) present.push('durationFit') // computed by score.ts
  if (engineSignals.aspectRatio === '9:16') present.push('aspectRatio')
  if (engineSignals.brightnessScore > 60) present.push('brightness')
  return present
}
```

The exact threshold values (50 for motionScore, 3 for sceneCount, etc.) should mirror the
thresholds used in the Phase 4 score formula. The plan must cross-reference Phase 4 plan for
these thresholds.

### Issue 6: Post history filter by platform requires a JOIN

The `posts` table does not have a `platform` column — platform is a FK relationship in
`platform_posts`. Filtering the history list by platform requires an INNER JOIN or an EXISTS
subquery on `platform_posts`. The simple `eq(posts.niche, niche)` filter in the plan works,
but `eq(posts.platform, platform)` does not exist.

**Fix in plan:** The `GET /posts` list route must join `platform_posts` when a platform filter
is active. Using `EXISTS` subquery avoids duplicating post rows (a post with 5 platform_posts
rows would appear 5 times with a plain JOIN):

```sql
WHERE EXISTS (
  SELECT 1 FROM platform_posts pp
  WHERE pp.post_id = posts.id
    AND pp.platform = $platform
)
```

Or in Drizzle:
```typescript
filters.platform
  ? sql`EXISTS (SELECT 1 FROM platform_posts pp WHERE pp.post_id = ${posts.id} AND pp.platform = ${filters.platform})`
  : undefined
```

---

## Implementation Notes (specific code patterns)

### Note A: Prompt injection format — hooks and hashtags

When learning data is available (>= 5 data points), the prompt builder should inject in this
exact format, inserted after the engine signals block and before the "Rules" section:

```
Past top-performing hooks in "${niche}" (ranked by best actual views):
1. "${hook1}" — ${views1} views
2. "${hook2}" — ${views2} views
3. "${hook3}" — ${views3} views

Top hashtags for "${niche}" on ${platform} (ranked by avg views):
${hashtag1} ${hashtag2} ${hashtag3} ... (up to 10)

Match the energy and structure of the top hooks. Prioritise the ranked hashtags.
```

When no learning data (< 5 data points): omit this block entirely from the prompt. Do not
write "no past data available" — just omit the section. The AI will use the hardcoded
hashtag bank from the existing prompt template.

### Note B: Learning insights screen — data shape for all 5 widgets

All 5 widgets on Screen 3 can be populated from 3 backend endpoints:

| Widget | Endpoint | Key fields |
|--------|----------|------------|
| Top 5 hooks | `GET /learning/hooks?niche=X` | hook_text, top_views |
| Top 10 hashtags | `GET /learning/hashtags?niche=X&platform=Y` | hashtag, avg_views |
| Score accuracy chart | `GET /learning/accuracy` | created_at, predicted_mid, actual_views |
| Best posting times | `GET /learning/posting-times` | platform, day_of_week, hour_of_day, avg_views |
| Niche breakdown | `GET /learning/niches` | niche, avg_views, post_count |

The `accuracy` endpoint should return:
```typescript
// JOIN posts + platform_posts, filter where actual_views IS NOT NULL
{
  posts: Array<{
    label: string          // e.g. "Apr 15" (formatted created_at)
    predictedMid: number   // (predicted_min + predicted_max) / 2
    actualViews: number    // actual_views
    accuracy: 'overperformed' | 'matched' | 'underperformed'
  }>
}
```

Limit to the last 20 posts with actual_views for the chart (older data is less actionable and
the chart gets unreadable beyond 20 bars).

### Note C: Delete post cascade

The spec says "delete a post cascades to platform_posts and learning_signals." The schema
already has `ON DELETE CASCADE` on `platform_posts(post_id)`. However, `learning_signals`
has no FK to `posts` — it stores a copy of the data, not a reference. Deleting a post does
NOT automatically delete its corresponding `learning_signals` rows via cascade.

**Fix:** The `DELETE /posts/:id` route must explicitly delete matching learning_signals rows
before or as part of the post deletion:

```typescript
await db.transaction(async (tx) => {
  // Delete learning_signals rows for this post's niche + hook_text combination
  // Safest: learning_signals has no post_id FK, so match by querying platform_posts first
  const ppRows = await tx.select({ platform: platformPosts.platform })
    .from(platformPosts).where(eq(platformPosts.post_id, postId))
  
  // Get the post to find its niche + hook_text
  const [post] = await tx.select({ niche: posts.niche, hookText: posts.hook_text })
    .from(posts).where(eq(posts.id, postId))

  // Delete learning_signals that came from this post's data
  // Note: since learning_signals has no post_id, we cannot perfectly identify which rows
  // came from this post. Best approach: add post_id FK to learning_signals in Phase 1.
  // If post_id FK exists:
  await tx.delete(learningSignals).where(eq(learningSignals.post_id, postId))
  
  // Delete post (platform_posts cascade via FK)
  await tx.delete(posts).where(eq(posts.id, postId))
})
```

**This reveals a schema gap:** `learning_signals` has no `post_id` column in the spec. Without
it, there is no reliable way to identify which learning_signals rows to delete when a post is
deleted. The plan MUST add a `post_id UUID REFERENCES posts(id) ON DELETE CASCADE` column to
`learning_signals`. This is a Phase 1 schema fix but must be verified in Phase 7's Wave 0.

### Note D: `views_logged_at` enables idempotent re-logging

If the user re-enters views for a post (correcting a mistake), the PATCH handler must handle
the case where `actual_views IS NOT NULL` and `views_logged_at IS NOT NULL` — the post was
already logged. The transaction should:
1. Update `platform_posts.actual_views` (overwrite is fine)
2. Insert a NEW row in `learning_signals` (don't update existing — every data point is a
   new signal for the EMA)
3. Re-run the weight update EMA with the new accuracy

This means `learning_signals` will have multiple rows for the same post if the user corrects
views. This is acceptable and actually improves EMA accuracy over time. The hashtag/hook
queries already handle this correctly (AVG and MAX across multiple rows with same source).

---

## Dependency Checklist (must be true before Phase 7 starts)

- [ ] `settings.learned_weights JSONB DEFAULT NULL` column exists in Drizzle schema and migration
- [ ] `learning_signals.post_id UUID REFERENCES posts(id) ON DELETE CASCADE` column exists
- [ ] `learning_signals.hashtags` is declared as `text().array()` in Drizzle schema (not scalar text)
- [ ] `GET /learning/hooks` route exists and returns rows from `learning_signals`
- [ ] `GET /learning/hashtags` route exists and returns rows from `learning_signals`
- [ ] `GET /settings` returns `learned_weights` field (even if null)
- [ ] `platform_posts.predicted_min` and `platform_posts.predicted_max` are populated for all posts (set when post is saved in Phase 5)
- [ ] `platform_posts.posted_at` is set when upload completes or manual post is logged (needed for posting time analysis)
- [ ] `posts.hook_text` is populated when post is saved (from AI-generated output)
- [ ] `posts.engine_signals JSONB` is populated (needed to extract signal presence for weight updates)
- [ ] Phase 6 upload flow sets `platform_posts.upload_status = 'posted'` on success — Phase 7 history list depends on this field
- [ ] React frontend state management plan is defined for the 4 screens — Phase 7 adds Screen 2 (PostHistory) and Screen 3 (LearningInsights) to an already existing 4-screen useState switch

---

## Estimated Risk: MEDIUM

**Why not LOW:**
- The schema has three gaps that must be patched (learned_weights column, post_id FK in
  learning_signals, hashtags TEXT[] declaration) before Phase 7 can begin. If any of these
  were missed in Phase 1, a migration is needed before Phase 7 work starts.
- The spec's hashtag query is wrong (see Issue 2) — using it verbatim would cause a runtime
  DB error that is not immediately obvious from TypeScript types.
- The unnest + GROUP BY query pattern in Drizzle requires raw `db.execute(sql`...`)` — it
  cannot be expressed with Drizzle's fluent builder. Engineers unfamiliar with Drizzle raw
  SQL may try the fluent builder and get confused when it fails.
- The score calibration EMA + delta cap + signal extraction logic is 3 interacting pieces
  that must be implemented correctly together. A bug in any one silently corrupts the formula.

**Why not HIGH:**
- No external API dependencies in Phase 7. All work is SQL aggregation + frontend rendering.
- No new npm packages required. All patterns use existing stack (Drizzle, PostgreSQL 17,
  React 19, Tailwind CSS).
- The data is non-critical — learning loop bugs cause suboptimal suggestions, not data loss or
  security issues.
- The Tailwind CSS bar chart is simpler than it sounds — it is 20 lines of JSX with inline
  width styles.

---

## Sources

- Drizzle ORM raw SQL / sql template tag: [VERIFIED: https://orm.drizzle.team/docs/sql]
- Drizzle ORM conditional WHERE filters: [VERIFIED: https://orm.drizzle.team/docs/guides/conditional-filters-in-query]
- Drizzle ORM transactions: [VERIFIED: https://orm.drizzle.team/docs/transactions]
- PostgreSQL unnest() function: [CITED: https://www.postgresql.org/docs/current/functions-array.html]
- PostgreSQL EXTRACT(DOW/HOUR FROM timestamp): [CITED: https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-EXTRACT]
- EMA formula (α × current + (1−α) × prev): [ASSUMED — standard EMA formula, widely documented, α=0.3 is a judgment call for this use case]
- Asia/Karachi timezone identifier in PostgreSQL: [ASSUMED — standard IANA timezone name; PKT = UTC+5, no DST]
