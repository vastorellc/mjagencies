import type { Meta, StoryObj } from '@storybook/react'
import { PricingTable } from './index.js'

const meta: Meta<typeof PricingTable> = {
  title: 'Blocks/Service/PricingTable',
  component: PricingTable,
}
export default meta

type Story = StoryObj<typeof PricingTable>

export const Default: Story = {
  args: {
    plans: [
      {
        name: 'Growth',
        price: '$3,500',
        period: '/ month',
        features: [
          '25 tracked keywords',
          '2 content briefs per month',
          'Quarterly technical audit',
          '2 link acquisitions per month',
          'Monthly reporting',
        ],
        ctaText: 'Start with Growth',
        ctaHref: '/contact?plan=growth',
        highlighted: false,
      },
      {
        name: 'Scale',
        price: '$7,500',
        period: '/ month',
        features: [
          '75 tracked keywords',
          '6 content briefs per month',
          'Monthly technical audit',
          '6 link acquisitions per month',
          'Bi-weekly reporting',
          'Dedicated account manager',
        ],
        ctaText: 'Start with Scale',
        ctaHref: '/contact?plan=scale',
        highlighted: true,
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        features: [
          'Unlimited keywords',
          '12+ content briefs per month',
          'Weekly technical monitoring',
          '15+ link acquisitions per month',
          'Weekly reporting',
          'Dedicated team of 3',
          'Custom dashboards',
        ],
        ctaText: 'Contact Sales',
        ctaHref: '/contact?plan=enterprise',
        highlighted: false,
      },
    ],
  },
}
