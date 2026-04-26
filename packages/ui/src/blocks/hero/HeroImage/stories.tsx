import type { Meta, StoryObj } from '@storybook/react'
import { HeroImage } from './index.js'

const meta: Meta<typeof HeroImage> = {
  title: 'Blocks/Hero/HeroImage',
  component: HeroImage,
}
export default meta

type Story = StoryObj<typeof HeroImage>

export const Default: Story = {
  args: {
    headline: 'Accelerate Your Agency Growth',
    subheadline: 'Data-driven strategies that deliver measurable results for B2B companies.',
    ctaText: 'Book a Strategy Call',
    ctaHref: '/contact',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200',
    imageAlt: 'Modern office workspace with team collaboration',
    overlayOpacity: 0.45,
  },
}

export const NoOverlay: Story = {
  args: {
    headline: 'Enterprise Digital Transformation',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200',
    imageAlt: 'Digital transformation consulting team',
    overlayOpacity: 0,
  },
}
