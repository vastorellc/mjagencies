import type { Meta, StoryObj } from '@storybook/react'
import { ComparisonTable } from './index.js'

const meta: Meta<typeof ComparisonTable> = {
  title: 'Blocks/Service/ComparisonTable',
  component: ComparisonTable,
}
export default meta

type Story = StoryObj<typeof ComparisonTable>

export const Default: Story = {
  args: {
    headline: 'SEO Retainer Plans Compared',
    headers: ['Feature', 'Growth', 'Scale', 'Enterprise'],
    rows: [
      { feature: 'Monthly keyword research', values: ['25 keywords', '75 keywords', 'Unlimited'] },
      { feature: 'Content briefs', values: ['2 / month', '6 / month', '12 / month'] },
      { feature: 'Technical audit', values: ['Quarterly', 'Monthly', 'Weekly'] },
      { feature: 'Link building', values: ['2 links / month', '6 links / month', '15 links / month'] },
      { feature: 'Reporting cadence', values: ['Monthly', 'Bi-weekly', 'Weekly'] },
      { feature: 'Dedicated account manager', values: ['—', '✓', '✓'] },
      { feature: 'Custom dashboards', values: ['—', '—', '✓'] },
    ],
  },
}
