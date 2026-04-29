import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Use the React 17+ automatic JSX runtime so .tsx source files don't need
  // `import React from 'react'` for JSX to compile under vitest. Production
  // builds get the same behaviour from Next.js's swc transform.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
  },
})
