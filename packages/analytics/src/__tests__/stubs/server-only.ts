// Test-only stub for the `server-only` package. The real package throws when
// imported outside an RSC context; in Vitest we alias to this empty module so
// dashboard data-layer files (`import 'server-only'`) can be imported and unit
// tested.
export {}
