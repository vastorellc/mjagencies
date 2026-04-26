import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ImageText } from './index.js'

const meta: Meta<typeof ImageText> = {
  title: 'Blocks/Content/ImageText',
  component: ImageText,
}
export default meta

type Story = StoryObj<typeof ImageText>

export const Default: Story = {
  args: {
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=700',
    imageAlt: 'Analytics dashboard showing revenue attribution metrics',
    headline: 'Attribution That Actually Tells You What Works',
    body: React.createElement('p', null, 'Most agencies track clicks and impressions. We track revenue — by channel, by campaign, by rep. Our multi-touch attribution model accounts for the full B2B sales cycle, from first touch to closed-won.'),
    imagePosition: 'left',
  },
}
