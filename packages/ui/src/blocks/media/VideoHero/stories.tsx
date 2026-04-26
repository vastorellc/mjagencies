import type { Meta, StoryObj } from '@storybook/react'
import { VideoHero } from './index.js'

const meta: Meta<typeof VideoHero> = {
  title: 'Blocks/Media/VideoHero',
  component: VideoHero,
}
export default meta

type Story = StoryObj<typeof VideoHero>

export const Default: Story = {
  args: {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600',
    posterAlt: 'Agency team working in modern office',
    headline: 'Results-Driven Digital Marketing for B2B Growth',
  },
}

export const VideoOnly: Story = {
  args: {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1600',
    posterAlt: 'Developer team',
  },
}
