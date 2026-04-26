import type { Meta, StoryObj } from '@storybook/react'
import { AwardsBar } from './index.js'

const meta: Meta<typeof AwardsBar> = {
  title: 'Blocks/Trust/AwardsBar',
  component: AwardsBar,
}
export default meta

type Story = StoryObj<typeof AwardsBar>

export const Default: Story = {
  args: {
    awards: [
      {
        name: 'Clutch Top SEO Agency',
        imageUrl: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=80',
        imageAlt: 'Clutch Top SEO Agency badge',
        year: '2024',
      },
      {
        name: 'G2 Leader — SEO Tools',
        imageUrl: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=80',
        imageAlt: 'G2 Leader badge',
        year: '2024',
      },
      {
        name: 'Forbes Best Agencies',
        imageUrl: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=80',
        imageAlt: 'Forbes Best Agencies badge',
        year: '2023',
      },
      {
        name: 'Inc. 5000',
        imageUrl: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=80',
        imageAlt: 'Inc. 5000 fastest growing companies',
        year: '2023',
      },
    ],
  },
}
