import type { Meta, StoryObj } from '@storybook/react'
import { ImageGallery } from './index.js'

const meta: Meta<typeof ImageGallery> = {
  title: 'Blocks/Media/ImageGallery',
  component: ImageGallery,
}
export default meta

type Story = StoryObj<typeof ImageGallery>

export const Default: Story = {
  args: {
    columns: 3,
    images: [
      { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600', alt: 'Team in modern office', caption: 'Strategy session — Q3 2024' },
      { url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=600', alt: 'Developers collaborating at whiteboard' },
      { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600', alt: 'Analytics dashboard on laptop screen', caption: 'Client reporting dashboard' },
      { url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600', alt: 'Co-working space' },
      { url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600', alt: 'Agency team presentation' },
      { url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600', alt: 'Video call with remote team' },
    ],
  },
}

export const FourColumn: Story = {
  args: {
    columns: 4,
    images: [
      { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400', alt: 'Office 1' },
      { url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400', alt: 'Office 2' },
      { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400', alt: 'Office 3' },
      { url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400', alt: 'Office 4' },
    ],
  },
}
