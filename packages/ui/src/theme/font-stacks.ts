// packages/ui/src/theme/font-stacks.ts
// Single TypeScript source of truth for the 12 niche font assignments.
// RESEARCH §5.2 verbatim. Heading + body font name per niche.
// Phase 8 agency apps load fonts via next/font/google; the --font-brand CSS
// variable is injected into the document and the Layer 3 typography token
// (--mj-font-brand: var(--font-brand, fallback)) reads it through fallback indirection.
// REQ-044 (12 niche themes), RESEARCH §5.2 (font assignments).
import type { AgencyNiche } from './types.js';

export interface NicheFontStack {
  heading: string;  // family name (no fallback chain — agencies' next/font/google injects via --font-brand)
  body:    string;
}

export const NICHE_FONTS: Record<AgencyNiche, NicheFontStack> = {
  brand:       { heading: 'Inter',              body: 'Inter' },
  ecommerce:   { heading: 'Inter',              body: 'Inter' },
  growth:      { heading: 'Plus Jakarta Sans',  body: 'Plus Jakarta Sans' },
  webdev:      { heading: 'JetBrains Mono',     body: 'Inter' },
  ai:          { heading: 'Instrument Sans',    body: 'Instrument Sans' },
  branding:    { heading: 'Fraunces',           body: 'Instrument Sans' },
  strategy:    { heading: 'Playfair Display',   body: 'Source Sans 3' },
  finance:     { heading: 'Source Serif 4',     body: 'Source Sans 3' },
  engineering: { heading: 'IBM Plex Sans',      body: 'IBM Plex Sans' },
  product:     { heading: 'DM Sans',            body: 'DM Sans' },
  video:       { heading: 'Bebas Neue',         body: 'Inter' },
  graphic:     { heading: 'Space Grotesk',      body: 'Space Grotesk' },
};
