import type { Meta, StoryObj } from '@storybook/react'
import { CtaFloating } from './index.js'

const meta: Meta<typeof CtaFloating> = {
  title: 'Blocks/CTA/CtaFloating',
  component: CtaFloating,
}
export default meta

type Story = StoryObj<typeof CtaFloating>

export const Default: Story = {
  args: {
    text: 'Limited spots this quarter — only 4 diagnostic engagements available.',
    ctaText: 'Reserve Your Spot',
    ctaHref: '/contact',
    position: 'bottom-right',
  },
}

export const BottomLeft: Story = {
  args: {
    text: 'Get our 2025 B2B Growth Benchmarks report — free.',
    ctaText: 'Download Now',
    ctaHref: '/resources/growth-benchmarks',
    position: 'bottom-left',
  },
}
