/**
 * Mock for 'next/headers' in Vitest test environment.
 * Tests that need this mock use vi.mock('next/headers', () => ...) directly in the test file
 * with a factory that returns a fake cookies() implementation.
 * This file is the fallback no-op that prevents import errors when the test does not explicitly mock.
 */
export function cookies() {
  return Promise.resolve({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
    has: () => false,
    getAll: () => [],
  })
}
