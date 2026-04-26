// packages/ui/src/theme/data-attrs.ts
// Edge-safe: no Node-only imports. Used by SSR layout to construct <html data-* /> props.
// REQ-043: returns the 5-layer data-* prop bag for <html>.
// Phase 8 agency app layouts spread this into their <html> element.

export interface DataAttrsInput {
  agency:   string;
  page?:    string;
  theme?:   'light' | 'dark';
  variant?: 'a' | 'b';
}

/** Returns props bag spread into <html ...{getDataAttrs(opts)} />. */
export function getDataAttrs(input: DataAttrsInput): Record<string, string> {
  const attrs: Record<string, string> = {
    'data-agency': input.agency,
    'data-theme':  input.theme ?? 'light',
  };
  if (input.page)    attrs['data-page']    = input.page;
  if (input.variant) attrs['data-variant'] = input.variant;
  return attrs;
}
