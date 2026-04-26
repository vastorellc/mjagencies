import type { Meta, StoryObj } from '@storybook/react'
import { BeforeAfter } from './index.js'

const meta: Meta<typeof BeforeAfter> = {
  title: 'Blocks/Media/BeforeAfter',
  component: BeforeAfter,
}
export default meta

type Story = StoryObj<typeof BeforeAfter>

export const Default: Story = {
  args: {
    headline: 'Website Redesign Results',
    beforeUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200',
    beforeAlt: 'Old website design with poor visual hierarchy',
    afterUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200',
    afterAlt: 'New website design with clean modern layout',
  },
}

export const NoHeadline: Story = {
  args: {
    beforeUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200',
    beforeAlt: 'Before office renovation',
    afterUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200',
    afterAlt: 'After office renovation with modern collaborative workspace',
  },
}
