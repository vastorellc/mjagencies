import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Default to node for existing server-side unit tests (cloudflare, r2, etc.)
    // The picture.test.tsx overrides with @vitest-environment jsdom via inline docblock.
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
  },
})
