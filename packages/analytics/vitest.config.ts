import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // `server-only` throws when imported outside an RSC context. In unit tests we
      // alias it to an empty module so the dashboard data-layer modules (which use
      // `import 'server-only'` as a build-time guardrail) can be imported.
      'server-only': path.resolve(__dirname, 'src/__tests__/stubs/server-only.ts'),
    },
  },
})
