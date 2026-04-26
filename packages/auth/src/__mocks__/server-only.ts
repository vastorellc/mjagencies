// Mock for 'server-only' — allows importing server-only modules in Vitest test environment.
// In production Next.js, the real 'server-only' package throws if imported from a client component.
// This no-op shim enables unit testing without the Next.js runtime.
export {}
