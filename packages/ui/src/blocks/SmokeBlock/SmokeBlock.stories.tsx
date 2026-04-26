// packages/ui/src/blocks/SmokeBlock/SmokeBlock.stories.tsx
// M004 smoke story — proves the Storybook harness, decorator, and matrix work end-to-end.
// AllThemes uses the Chromatic Modes pattern (chromatic.modes metadata) for 12 agencies × 2 modes = 24 snapshots.
// Phase 5 will ship 44 more blocks — the CI infrastructure from Plan 04-05 covers them automatically.
// REQ-048 (visual regression CI), REQ-044 (12 niche themes).
import type { Meta, StoryObj } from '@storybook/react';
// Import directly from constants file to avoid server-only transitive deps in @mjagency/config barrel
import { AGENCIES } from '../../../../config/src/agency-constants.js';
import { SmokeBlock } from './SmokeBlock.js';

const meta: Meta<typeof SmokeBlock> = {
  title: 'Smoke/SmokeBlock',
  component: SmokeBlock,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof SmokeBlock>;

const args = {
  headline: 'MJAgency Design System',
  body:     'Token-driven theming. CSS-cascade resolution. 12 niche default themes.',
  ctaText:  'Explore',
};

/** Default — uses the Storybook toolbar's selected agency + dark mode */
export const Default: Story = { args };

/** AllThemes — Chromatic Modes pattern: each agency × light/dark = 24 snapshots
 *  At M004 this is the SINGLE smoke story. Phase 5 will ship 44 more (45 total). */
export const AllThemes: Story = {
  args,
  parameters: {
    chromatic: {
      modes: Object.fromEntries(
        AGENCIES.flatMap(agency => [
          [`${agency}-light`, { globals: { agency, darkMode: false } }],
          [`${agency}-dark`,  { globals: { agency, darkMode: true  } }],
        ]),
      ),
    },
  },
};
