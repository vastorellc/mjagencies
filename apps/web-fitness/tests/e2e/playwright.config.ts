import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000',
    browserName: 'chromium',
  },
})
