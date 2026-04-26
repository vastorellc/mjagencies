import type { Meta, StoryObj } from '@storybook/react'
import { StatsBar } from './index.js'

const meta: Meta<typeof StatsBar> = {
  title: 'Blocks/Content/StatsBar',
  component: StatsBar,
}
export default meta

type Story = StoryObj<typeof StatsBar>

export const Default: Story = {
  args: {
    stats: [
      { value: '30-45%', label: 'Revenue increase', source: 'Median across 90-day engagements' },
      { value: '2.8x', label: 'Pipeline velocity', source: 'MQL to SQL conversion improvement' },
      { value: '60%', label: 'CAC reduction', source: 'Year-over-year for retained clients' },
      { value: '94', label: 'Net Promoter Score', source: '2025 annual client survey' },
    ],
  },
}
