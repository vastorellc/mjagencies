// @mjagency/ui — shared component library
// M004 fills this package with the full design system (theme tokens, Tailwind v4 config,
// base components). At M001 this is a typed stub so every app can import the package
// and the workspace typechecks cleanly.

export type ThemeToken = {
  name: string
  value: string
}

export function getThemeTokens(): ThemeToken[] {
  return []
}
