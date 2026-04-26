import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '__tests__',
  testMatch: '**/*.spec.ts',
  use: { browserName: 'chromium' },
  fullyParallel: true,
});
