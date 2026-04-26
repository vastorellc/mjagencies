import type { Meta, StoryObj } from '@storybook/react'
import { HeroVideo } from './index.js'

const meta: Meta<typeof HeroVideo> = {
  title: 'Blocks/Hero/HeroVideo',
  component: HeroVideo,
}
export default meta

type Story = StoryObj<typeof HeroVideo>

export const Default: Story = {
  args: {
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    videoPoster: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200',
    posterAlt: 'Agency team collaborating in a modern workspace',
    headline: 'Scale Your Business With Proven Growth Systems',
    subheadline: 'From lead acquisition to client retention — we engineer the full revenue cycle.',
    ctaText: 'See Our Results',
    ctaHref: '/case-studies',
    overlayOpacity: 0.5,
  },
}
