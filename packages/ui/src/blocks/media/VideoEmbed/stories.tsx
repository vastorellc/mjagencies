import type { Meta, StoryObj } from '@storybook/react'
import { VideoEmbed } from './index.js'

const meta: Meta<typeof VideoEmbed> = {
  title: 'Blocks/Media/VideoEmbed',
  component: VideoEmbed,
}
export default meta

type Story = StoryObj<typeof VideoEmbed>

export const YouTube: Story = {
  args: {
    platform: 'youtube',
    videoId: 'dQw4w9WgXcQ',
    posterUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200',
    posterAlt: 'Agency overview video thumbnail',
    title: 'How We Deliver Measurable SEO Results for B2B Companies',
  },
}

export const Vimeo: Story = {
  args: {
    platform: 'vimeo',
    videoId: '76979871',
    posterUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200',
    posterAlt: 'Case study video thumbnail',
    title: 'Case Study: How Acme SaaS Scaled to 8,000 Monthly Organic Sessions',
  },
}
