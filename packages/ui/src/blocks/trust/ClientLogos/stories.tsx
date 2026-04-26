import type { Meta, StoryObj } from '@storybook/react'
import { ClientLogos } from './index.js'

const meta: Meta<typeof ClientLogos> = {
  title: 'Blocks/Trust/ClientLogos',
  component: ClientLogos,
}
export default meta

type Story = StoryObj<typeof ClientLogos>

export const Default: Story = {
  args: {
    headline: 'Trusted by leading B2B companies',
    logos: [
      { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', imageAlt: 'Google', href: 'https://google.com' },
      { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg', imageAlt: 'Amazon' },
      { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', imageAlt: 'Netflix' },
      { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg', imageAlt: 'IBM' },
      { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg', imageAlt: 'Microsoft' },
    ],
  },
}

export const NoHeadline: Story = {
  args: {
    logos: [
      { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', imageAlt: 'Google' },
      { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg', imageAlt: 'Amazon' },
      { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg', imageAlt: 'IBM' },
    ],
  },
}
