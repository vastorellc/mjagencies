import '@testing-library/jest-dom/vitest'

// Helper: load a fixture as a File. Used by engine tests in browser mode.
// Fixtures live under frontend/test/fixtures/ and are committed to the repo so
// every test run is hermetic.
export async function loadFixture(name: string): Promise<File> {
  const url = new URL(`./fixtures/${name}`, import.meta.url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fixture ${name} not found: ${res.status}`)
  const buf = await res.arrayBuffer()
  const mime = name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4'
  return new File([buf], name, { type: mime })
}

// WebAssembly removal mock — used only by engine.fallback.test.ts (ANALYSIS-09).
// Returns a restore() callback so tests don't poison global state for siblings.
export function removeWebAssembly(): () => void {
  const g = globalThis as { WebAssembly?: unknown }
  const original = g.WebAssembly
  delete g.WebAssembly
  return () => {
    g.WebAssembly = original
  }
}
