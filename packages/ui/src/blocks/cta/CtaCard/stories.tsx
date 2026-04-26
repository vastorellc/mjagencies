import type { Meta, StoryObj } from '@storybook/react'
import { CtaCard } from './index.js'

const meta: Meta<typeof CtaCard> = {
  title: 'Blocks/CTA/CtaCard',
  component: CtaCard,
}
export default meta

type Story = StoryObj<typeof CtaCard>

export const Default: Story = {
  args: {
    headline: 'Revenue Diagnostic',
    body: 'A structured 2-week audit of your current acquisition, conversion, and retention motion. We identify the 3 highest-leverage growth levers and deliver a prioritized action plan.',
    ctaText: 'Request a Diagnostic',
    ctaHref: '/services/diagnostic',
    iconUrl: 'https://cdn.simpleicons.org/databricks/FF3621',
    iconAlt: 'Revenue diagnostic icon',
  },
}

export const NoIcon: Story = {
  args: {
    headline: 'Fractional CMO Engagement',
    body: 'Senior marketing leadership embedded in your team 2-3 days per week. Strategy ownership, team management, and vendor accountability — without the full-time cost.',
    ctaText: 'Explore This Service',
    ctaHref: '/services/fractional-cmo',
  },
}
