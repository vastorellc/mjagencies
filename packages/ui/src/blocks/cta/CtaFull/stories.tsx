import type { Meta, StoryObj } from '@storybook/react'
import { CtaFull } from './index.js'

const meta: Meta<typeof CtaFull> = {
  title: 'Blocks/CTA/CtaFull',
  component: CtaFull,
}
export default meta

type Story = StoryObj<typeof CtaFull>

export const Default: Story = {
  args: {
    headline: 'Ready to Add 30-45% More Pipeline This Quarter?',
    subheadline: 'Join 140+ B2B companies that have scaled with our growth systems. Book a free diagnostic call — no obligation, no pitch.',
    primaryCta: { text: 'Book Your Free Diagnostic', href: '/contact' },
    secondaryCta: { text: 'View Case Studies', href: '/case-studies' },
  },
}

export const PrimaryOnly: Story = {
  args: {
    headline: 'Start Your Brand Setup in Under 10 Minutes',
    primaryCta: { text: 'Launch Your Agency Site', href: '/onboard' },
  },
}
