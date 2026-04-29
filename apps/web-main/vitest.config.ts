import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  resolve: {
    alias: {
      // Mock 'server-only' so we can unit-test modules guarded by the
      // server-only marker without booting the Next.js runtime. Same
      // approach used in packages/auth/vitest.config.ts.
      'server-only': resolve(__dirname, 'src/__mocks__/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    include: ['src/**/*.test.ts', '**/__tests__/**/*.test.ts'],
  },
})
