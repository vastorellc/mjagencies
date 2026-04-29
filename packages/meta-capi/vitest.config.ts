import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    // The first test that dynamically imports meta-capi-queue.ts pulls in
    // @mjagency/queue → bullmq → ioredis, which is slow under cold-cache
    // vitest module loading on Windows. The default 5000ms can flake.
    // 15s is generous; subsequent tests in the file run in <50ms each.
    testTimeout: 15000,
  },
})
