import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  resolve: {
    alias: {
      // Mock server-only so unit tests can import server-only modules without crashing.
      // In production Next.js, server-only prevents client component imports.
      'server-only': resolve(__dirname, 'src/__mocks__/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
  },
})
