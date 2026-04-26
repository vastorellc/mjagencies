// packages/ui/src/theme/niche-palettes.ts
// Single TypeScript source of truth for the 12 niche OKLCH palettes.
// RESEARCH §5.1 verbatim. Used to generate the 12 theme-{slug}.json files.
// T-04-010 mitigation: niche-themes.test.ts Test 5 asserts brand-500 in each
// theme.json matches the corresponding primary500 here — catches drift on CI.
// REQ-044 (12 niche themes), REQ-047 (OKLCH-only, no hex).
import type { AgencyNiche } from './types.js';

export interface NichePalette {
  primary50:   string;  // light tint of brand
  primary500:  string;  // brand mid (most-used)
  primary900:  string;  // brand deep (rare; near-black agencies use this for hero)
  accent:      string;  // complementary highlight
  /** Token-bucket override hints — used when generating theme.json scopes */
  personality: string;  // human-readable adjective list
}

export const NICHE_PALETTES: Record<AgencyNiche, NichePalette> = {
  brand:       { primary50: 'oklch(0.97 0.013 250)', primary500: 'oklch(0.55 0.19 250)', primary900: 'oklch(0.25 0.08 250)', accent: 'oklch(0.72 0.17 142)', personality: 'Neutral, professional, warm' },
  ecommerce:   { primary50: 'oklch(0.97 0.030 30)',  primary500: 'oklch(0.65 0.20 30)',  primary900: 'oklch(0.28 0.10 30)',  accent: 'oklch(0.55 0.19 250)', personality: 'Bold, saturated, product-forward' },
  growth:      { primary50: 'oklch(0.97 0.020 280)', primary500: 'oklch(0.60 0.20 280)', primary900: 'oklch(0.28 0.10 280)', accent: 'oklch(0.80 0.15 280)', personality: 'Dashboard, data-dense, SaaS' },
  webdev:      { primary50: 'oklch(0.97 0.018 230)', primary500: 'oklch(0.55 0.18 230)', primary900: 'oklch(0.26 0.09 230)', accent: 'oklch(0.72 0.17 175)', personality: 'Technical, grid-based, precise' },
  ai:          { primary50: 'oklch(0.97 0.022 295)', primary500: 'oklch(0.60 0.22 295)', primary900: 'oklch(0.28 0.12 295)', accent: 'oklch(0.93 0.04 95)',  personality: 'Abstract, futuristic, warm contrast' },
  branding:    { primary50: 'oklch(0.97 0.005 0)',   primary500: 'oklch(0.15 0.00 0)',   primary900: 'oklch(0.08 0.00 0)',   accent: 'oklch(0.72 0.14 55)',  personality: 'Bold editorial, typographic' },
  strategy:    { primary50: 'oklch(0.95 0.012 250)', primary500: 'oklch(0.30 0.12 250)', primary900: 'oklch(0.18 0.07 250)', accent: 'oklch(0.72 0.12 80)',  personality: 'Corporate refined, trustworthy' },
  finance:     { primary50: 'oklch(0.95 0.012 250)', primary500: 'oklch(0.28 0.12 250)', primary900: 'oklch(0.18 0.06 250)', accent: 'oklch(0.62 0.12 155)', personality: 'Trustworthy, conservative, secure' },
  engineering: { primary50: 'oklch(0.96 0.002 0)',   primary500: 'oklch(0.28 0.02 0)',   primary900: 'oklch(0.15 0.01 0)',   accent: 'oklch(0.72 0.18 70)',  personality: 'Industrial, functional, amber accent' },
  product:     { primary50: 'oklch(0.98 0.01 90)',   primary500: 'oklch(0.95 0.03 90)',  primary900: 'oklch(0.85 0.05 90)',  accent: 'oklch(0.68 0.20 20)',  personality: 'Human-centered, soft, approachable' },
  video:       { primary50: 'oklch(0.95 0.005 20)',  primary500: 'oklch(0.15 0.02 20)',  primary900: 'oklch(0.10 0.01 20)',  accent: 'oklch(0.80 0.15 50)',  personality: 'Cinematic, contrasty, premium' },
  graphic:     { primary50: 'oklch(0.97 0.000 0)',   primary500: 'oklch(0.12 0.00 0)',   primary900: 'oklch(0.06 0.00 0)',   accent: 'oklch(0.75 0.25 160)', personality: 'Bold typographic, high contrast' },
};
