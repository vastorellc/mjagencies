// packages/ui/.storybook/test-runner.ts
// @storybook/test-runner configuration with jest-image-snapshot — Plan 04-05.
// self-hosted visual regression (Open Q1 resolution — RESEARCH §A1.2 + §8.4).
// failureThreshold: 0.001 (0.1%) absorbs sub-pixel OS font-rendering noise (Pitfall 5).
// Always regenerate baselines on Linux CI runner, never local macOS.
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async postVisit(page) {
    const screenshot = await page.screenshot();
    // 0.1% pixel diff tolerance — absorbs OS font-rendering noise (Pitfall 5).
    // Always regenerate baselines on Linux CI runner, never local macOS.
    expect(screenshot).toMatchImageSnapshot({
      failureThreshold: 0.001,
      failureThresholdType: 'percent',
      customSnapshotsDir: 'packages/ui/__snapshots__',
    });
  },
};
export default config;
