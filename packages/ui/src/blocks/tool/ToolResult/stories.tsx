import type { Meta, StoryObj } from '@storybook/react';
import { ToolResult } from './index.js';

const meta: Meta<typeof ToolResult> = {
  title: 'Blocks/Tool/ToolResult',
  component: ToolResult,
};
export default meta;

type Story = StoryObj<typeof ToolResult>;

export const Default: Story = {
  args: {
    resultHtml: `
      <h3 style="margin-top:0">Your Marketing ROI</h3>
      <p><strong>Monthly spend:</strong> $5,000</p>
      <p><strong>Revenue generated:</strong> $22,500</p>
      <p style="font-size:1.25rem"><strong>ROI: 350%</strong></p>
    `,
    disclaimer:
      'Results are estimates based on the figures you provided. Actual results may vary based on campaign execution, market conditions, and other factors.',
  },
};

export const WithoutDisclaimer: Story = {
  args: {
    resultHtml: `
      <h3 style="margin-top:0">Your SEO Score</h3>
      <p><strong>Overall score:</strong> 72/100</p>
      <p><strong>On-page SEO:</strong> 80/100</p>
      <p><strong>Technical SEO:</strong> 65/100</p>
      <p><strong>Backlink profile:</strong> 71/100</p>
    `,
  },
};
