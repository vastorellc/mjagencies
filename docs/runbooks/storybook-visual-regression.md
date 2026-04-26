# Storybook Visual Regression — Runbook

Plan 04-05 | REQ-048 | Phase 4 Design System

Self-hosted visual regression using `@storybook/test-runner` + Playwright snapshots.
Open Q1 resolution: no Chromatic SaaS dependency at M004; migration path for Phase 8+ documented below.

---

## Why Self-Hosted at M004

**Open Q1 resolved in Plan 04-05 (RESEARCH §A1.2 + §8.4).**

Three options were evaluated:
1. `@storybook/test-runner` + Playwright snapshots — **selected**
2. Chromatic-the-service (SaaS)
3. Loki

Reasons for self-hosted:
- Zero SaaS dependency at an early phase reduces secret/account-management overhead.
- Free — no usage limits at M004's snapshot count.
- Linux runner CI absorbs 540 snapshots (45 blocks × 12 themes) at `--maxWorkers=4` (Pitfall 6).
- Snapshot baselines in the repo means PRs surface visual diffs without external tooling.

---

## How to Update Snapshots

**ALWAYS regenerate baselines on Linux CI, never local macOS.**

Sub-pixel font rendering differs between macOS and Linux (Pitfall 5).
The CI config uses `failureThreshold: 0.001` (0.1%) to absorb this noise,
but baseline PNGs generated on macOS will have a different pixel distribution
than what Linux CI renders — causing false failures.

### Local update (Linux/WSL/Docker only)

```bash
# Build Storybook first
pnpm --filter=@mjagency/ui build-storybook

# Serve the static build
npx http-server packages/ui/storybook-static --port 6006 --silent &

# Wait for the server and update baselines
npx wait-on tcp:127.0.0.1:6006 && pnpm --filter=@mjagency/ui test-storybook -u
```

The `-u` flag updates snapshot baselines in `packages/ui/__snapshots__/`.

### CI-triggered update

Trigger the `visual-regression` CI job on a branch; download the updated snapshots
from the workflow artifacts (`__snapshots__-diff/`), replace the baseline PNGs locally,
and commit them.

---

## How to Debug a CI Failure

1. Navigate to the failing GitHub Actions run.
2. Find the `visual-regression` job.
3. Download the artifact `__snapshots__-diff/` (or check the job logs for diff PNGs).
4. Each file contains three images: `expected`, `received`, and `diff` (red highlights show deltas).

**Common causes:**

| Cause | How to identify | Fix |
|-------|----------------|-----|
| OS font rendering (Pitfall 5) | Sub-pixel differences across the whole component | Regenerate baselines on Linux CI runner |
| Animation snapshot timing | Animated element captured mid-transition | Add `parameters: { test: { skip: true } }` or use `page.waitForTimeout` in test-runner |
| Actual visual regression | Obvious color/layout/spacing change | Investigate the code change causing it; either fix the code or update baseline intentionally |
| CSS token cascade changed | All stories for a niche show color shift | A theme token was changed in a niche CSS file; review the diff |
| New dependency changed rendering | Broad changes across many stories | Check recent dependency bumps in `pnpm-lock.yaml` |

---

## How to Skip a Story Temporarily

Add `parameters: { test: { skip: true } }` to the story's metadata:

```tsx
export const MyStory: Story = {
  args: { ... },
  parameters: {
    test: { skip: true },  // @storybook/test-runner respects this — story is skipped in visual regression
  },
};
```

This is useful when a story is known to be flaky (e.g., animation timing) or when a design
is intentionally in-progress. Remove the skip when the story is stable.

---

## How to Add a New Block (Phase 5+)

Phase 5 (REQ-052) ships the real 45 block components. For each new block:

1. Create `packages/ui/src/blocks/{BlockName}/{BlockName}.tsx` — the component.
2. Create `packages/ui/src/blocks/{BlockName}/{BlockName}.stories.tsx` with at minimum:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { BlockName } from './BlockName.js';

const meta: Meta<typeof BlockName> = {
  title: 'Blocks/BlockName',
  component: BlockName,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof BlockName>;

export const Default: Story = { args: { /* block props */ } };
```

3. Optionally add an `AllThemes` story with `chromatic.modes` matrix (see `SmokeBlock.stories.tsx` for the pattern).
4. Run `pnpm --filter=@mjagency/ui build-storybook` to confirm the story compiles.
5. Generate baselines: run the test-runner on Linux CI and commit the new PNG files.

The CI `visual-regression` job runs automatically on PR — no workflow changes needed.

---

## Performance Budget

**Target: < 20 minutes for the `visual-regression` CI job** (Pitfall 6).

Current story count at M004: 1 smoke block × 2 stories (Default + AllThemes with 24 modes).
At Phase 5: 45 blocks × ~2 stories each = ~90 story files → ~540 snapshots (45 × 12 themes).

The CI job is configured with:
- `--maxWorkers=4` — limits parallel Chromium instances to avoid OOM on GitHub-hosted runners.
- `--testTimeout=60000` — 60-second timeout per story (accommodates slow renders + screenshot).

If the job exceeds 20 minutes after Phase 5:

**Option A — Shard by agency (12 parallel jobs):**
Split the visual-regression job into 12 matrix jobs, one per agency:

```yaml
strategy:
  matrix:
    agency: [brand, ecommerce, growth, webdev, ai, branding, strategy, finance, engineering, product, video, graphic]
steps:
  - run: pnpm --filter=@mjagency/ui test-storybook --maxWorkers=4 --testTimeout=60000 --stories "**/${AGENCY}**"
    env:
      AGENCY: ${{ matrix.agency }}
```

Each job handles 45 stories × 2 modes = 90 snapshots — approximately 3-4 minutes per job.

**Option B — Migrate to Chromatic-the-service (Phase 8+):**
See migration section below.

---

## Migration to Chromatic-the-Service (Phase 8+)

When component count stabilizes at Phase 8+ and the self-hosted snapshot maintenance overhead becomes
significant, migrate to Chromatic-the-service:

**Steps:**
1. Create a Chromatic account at https://chromatic.com.
2. Link the GitHub repository; create a project.
3. Add `CHROMATIC_PROJECT_TOKEN` to GitHub repository secrets.
4. Replace the `visual-regression` job in `.github/workflows/pr.yml`:

```yaml
  visual-regression:
    name: Visual Regression (Chromatic)
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Chromatic needs full history for baselines
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - name: Publish to Chromatic
        run: npx chromatic --project-token=${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

5. Delete the `packages/ui/__snapshots__/` directory (no longer needed locally).
6. Update this runbook to remove the self-hosted sections.

**No story changes required.** The `chromatic.modes` parameter on stories maps directly to
Chromatic Modes — the same metadata that drives self-hosted test-runner matrix iterations
is the same format Chromatic reads for its variant capture. Zero story migration.

---

## Threshold Configuration

Configured in `packages/ui/.storybook/test-runner.ts`:

```ts
expect(screenshot).toMatchImageSnapshot({
  failureThreshold: 0.001,       // 0.1% — absorbs sub-pixel OS font-rendering noise
  failureThresholdType: 'percent',
  customSnapshotsDir: 'packages/ui/__snapshots__',
});
```

**Pitfall 5:** Sub-pixel font rendering between dev (macOS) and CI (Linux) is inevitable.
`failureThreshold: 0.001` absorbs this noise without masking real visual regressions (color changes,
layout shifts, spacing deltas). Always regenerate baselines on Linux CI runner, never local macOS.

To tighten the threshold for a specific story (e.g., pixel-perfect logo rendering):

```tsx
parameters: {
  test: {
    matchImageSnapshotOptions: {
      failureThreshold: 0,  // zero tolerance for this story
      failureThresholdType: 'percent',
    },
  },
},
```

---

## Snapshot Storage

Baselines are stored in `packages/ui/__snapshots__/` (committed to the repo).

Benefits:
- PR reviewers see PNG diffs in code review (GitHub renders PNG files).
- No external service dependency for baseline storage.
- Snapshots are versioned alongside code changes.

Trade-offs:
- Repo size increases as block count grows (Phase 5: ~540 PNGs × ~100KB = ~54MB).
- Rebases/merges may require snapshot regeneration if both branches modified a story.

If repo size becomes a concern at Phase 8+, migrate to Git LFS or Chromatic-the-service.
