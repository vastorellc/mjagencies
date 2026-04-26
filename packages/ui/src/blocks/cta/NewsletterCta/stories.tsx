import type { Meta, StoryObj } from '@storybook/react'
import { NewsletterCta } from './index.js'

const meta: Meta<typeof NewsletterCta> = {
  title: 'Blocks/CTA/NewsletterCta',
  component: NewsletterCta,
}
export default meta

type Story = StoryObj<typeof NewsletterCta>

export const Default: Story = {
  args: {
    headline: 'The B2B Growth Intelligence Digest',
    description: 'Weekly breakdown of what is actually working in growth — channel benchmarks, funnel teardowns, and real attribution data from active engagements.',
    placeholder: 'Enter your work email',
    submitText: 'Subscribe',
    disclaimer: 'No spam. Unsubscribe anytime. We only send when we have something worth reading.',
  },
}

export const NoDisclaimer: Story = {
  args: {
    headline: 'Get the Monthly AI Tools Report',
    description: 'A curated comparison of the 5 highest-ROI AI tools for each agency vertical — updated monthly with real benchmark data.',
    placeholder: 'your@company.com',
    submitText: 'Get the Report',
  },
}
