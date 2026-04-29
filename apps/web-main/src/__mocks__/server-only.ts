// Mock for 'server-only' — allows importing server-only modules in Vitest.
// The real package throws if imported from a client component bundle; in our
// node-environment unit tests we want server-only modules to load normally.
export {}
