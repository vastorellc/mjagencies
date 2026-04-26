import type { Meta, StoryObj } from '@storybook/react';
import { ToolCta } from './index.js';

const meta: Meta<typeof ToolCta> = {
  title: 'Blocks/Tool/ToolCta',
  component: ToolCta,
};
export default meta;

type Story = StoryObj<typeof ToolCta>;

export const Default: Story = {
  args: {
    toolSlug: 'roi-calculator',
    toolTitle: 'Free Marketing ROI Calculator',
    description:
      'Find out exactly how much revenue your marketing investment is generating. Enter your monthly spend and revenue figures to get your ROI in under 30 seconds.',
    ctaText: 'Calculate My ROI',
  },
};

export const SeoAudit: Story = {
  args: {
    toolSlug: 'seo-audit',
    toolTitle: 'Free Website SEO Audit',
    description:
      'Get a comprehensive analysis of your website SEO performance. Identify technical issues, on-page gaps, and quick wins to improve your rankings.',
    ctaText: 'Start Free Audit',
  },
};
