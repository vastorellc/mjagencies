import type { Meta, StoryObj } from '@storybook/react';
import { ToolEmbed } from './index.js';

const meta: Meta<typeof ToolEmbed> = {
  title: 'Blocks/Tool/ToolEmbed',
  component: ToolEmbed,
};
export default meta;

type Story = StoryObj<typeof ToolEmbed>;

export const Default: Story = {
  args: {
    toolSlug: 'roi-calculator',
    toolTitle: 'Marketing ROI Calculator',
    headline: 'Calculate Your Marketing ROI',
    description:
      'Enter your current marketing spend and revenue figures to instantly calculate your return on investment and identify areas for improvement.',
  },
};

export const Minimal: Story = {
  args: {
    toolSlug: 'seo-audit',
    toolTitle: 'Free SEO Audit Tool',
  },
};
