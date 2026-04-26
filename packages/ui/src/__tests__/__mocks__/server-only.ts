// Vitest mock for 'server-only'.
// The real package throws in non-RSC environments (browser / jsdom).
// In the vitest node environment we want server modules to be importable.
// This no-op satisfies the import without triggering the throw.
// See vitest.config.ts alias.
export {};
