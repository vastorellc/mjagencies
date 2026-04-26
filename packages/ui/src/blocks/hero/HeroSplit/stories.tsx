import type { Meta, StoryObj } from '@storybook/react'
import { HeroSplit } from './index.js'

const meta: Meta<typeof HeroSplit> = {
  title: 'Blocks/Hero/HeroSplit',
  component: HeroSplit,
}
export default meta

type Story = StoryObj<typeof HeroSplit>

export const Default: Story = {
  args: {
    headline: 'Revenue Operations Built for Modern B2B Teams',
    subheadline: 'Align sales, marketing, and customer success around a single growth engine.',
    ctaText: 'Start Your Assessment',
    ctaHref: '/assessment',
    imageUrl: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800',
    imageAlt: 'Revenue operations dashboard showing pipeline metrics',
    imagePosition: 'right',
  },
}

export const ImageLeft: Story = {
  args: {
    headline: 'AI-Powered Ecommerce Growth',
    subheadline: 'From product catalog to repeat purchase — automated growth that compounds monthly.',
    ctaText: 'View Our Playbook',
    ctaHref: '/playbook',
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
    imageAlt: 'Ecommerce analytics dashboard with conversion metrics',
    imagePosition: 'left',
  },
}
