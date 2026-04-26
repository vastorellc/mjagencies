import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    // server-only throws outside React Server Components context.
    // Alias to a no-op so vitest (node) can test server-only modules.
    alias: {
      'server-only': fileURLToPath(new URL('./src/__tests__/__mocks__/server-only.ts', import.meta.url)),
    },
  },
})
