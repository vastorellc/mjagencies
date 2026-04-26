import type { Meta, StoryObj } from '@storybook/react'
import { HeroMinimal } from './index.js'

const meta: Meta<typeof HeroMinimal> = {
  title: 'Blocks/Hero/HeroMinimal',
  component: HeroMinimal,
}
export default meta

type Story = StoryObj<typeof HeroMinimal>

export const Default: Story = {
  args: {
    headline: 'Strategy Consulting for Growth-Stage Startups',
    subheadline: 'We partner with founders to build the operating system behind scalable growth.',
    ctaText: 'Schedule a Discovery Call',
    ctaHref: '/contact',
  },
}

export const HeadlineOnly: Story = {
  args: {
    headline: 'Financial Modeling That Drives Decisions',
  },
}
