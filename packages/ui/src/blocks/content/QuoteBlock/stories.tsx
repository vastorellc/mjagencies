import type { Meta, StoryObj } from '@storybook/react'
import { QuoteBlock } from './index.js'

const meta: Meta<typeof QuoteBlock> = {
  title: 'Blocks/Content/QuoteBlock',
  component: QuoteBlock,
}
export default meta

type Story = StoryObj<typeof QuoteBlock>

export const Default: Story = {
  args: {
    quote: 'The growth system they built for us generated 40% more qualified pipeline in the first quarter. Our sales team finally has a consistent inbound motion instead of relying on outbound alone.',
    attribution: 'Sarah Chen',
    role: 'VP of Marketing, Meridian SaaS',
    avatarUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=96',
    avatarAlt: 'Sarah Chen, VP of Marketing at Meridian SaaS',
  },
}

export const NoAvatar: Story = {
  args: {
    quote: 'Their engineering team delivered a Next.js replatform that cut our LCP from 4.2 seconds to 1.1 seconds on mobile. The technical rigor is unlike any agency we have worked with.',
    attribution: 'Marcus Rivera',
    role: 'CTO, Apex Commerce',
  },
}
