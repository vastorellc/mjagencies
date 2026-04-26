import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { TextImage } from './index.js'

const meta: Meta<typeof TextImage> = {
  title: 'Blocks/Content/TextImage',
  component: TextImage,
}
export default meta

type Story = StoryObj<typeof TextImage>

export const Default: Story = {
  args: {
    headline: 'Engineering-Grade Web Development for Growth Companies',
    body: React.createElement('p', null, 'Performance budgets, Core Web Vitals targets, and accessibility standards are baked into every sprint — not retrofitted at launch. We build on Next.js 15 with zero client-side hydration for public pages.'),
    imageUrl: 'https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=700',
    imageAlt: 'Clean code editor showing TypeScript with strict type checking',
    imagePosition: 'right',
  },
}
