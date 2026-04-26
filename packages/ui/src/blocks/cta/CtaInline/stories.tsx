import type { Meta, StoryObj } from '@storybook/react'
import { CtaInline } from './index.js'

const meta: Meta<typeof CtaInline> = {
  title: 'Blocks/CTA/CtaInline',
  component: CtaInline,
}
export default meta

type Story = StoryObj<typeof CtaInline>

export const Default: Story = {
  args: {
    text: 'Want to see how this applies to your specific growth challenge?',
    ctaText: 'Book a 30-min call',
    ctaHref: '/contact',
  },
}
