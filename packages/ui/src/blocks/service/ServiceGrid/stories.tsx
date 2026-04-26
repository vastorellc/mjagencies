import type { Meta, StoryObj } from '@storybook/react'
import { ServiceGrid } from './index.js'

const meta: Meta<typeof ServiceGrid> = {
  title: 'Blocks/Service/ServiceGrid',
  component: ServiceGrid,
}
export default meta

type Story = StoryObj<typeof ServiceGrid>

export const Default: Story = {
  args: {
    columns: 3,
    items: [
      {
        title: 'SEO Strategy',
        description: 'Data-driven search engine optimization that increases organic traffic and qualified lead flow for B2B companies.',
        iconUrl: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=48',
        iconAlt: 'SEO chart icon',
        href: '/services/seo',
      },
      {
        title: 'Paid Media Management',
        description: 'Full-funnel paid search and social campaigns with transparent reporting and proven ROI across Google, Meta, and LinkedIn.',
        iconUrl: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=48',
        iconAlt: 'Paid media icon',
        href: '/services/paid-media',
      },
      {
        title: 'Content Marketing',
        description: 'Editorial content strategy and production that builds topical authority, earns backlinks, and converts readers into customers.',
        iconUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=48',
        iconAlt: 'Content writing icon',
        href: '/services/content',
      },
    ],
  },
}

export const TwoColumn: Story = {
  args: {
    columns: 2,
    items: [
      {
        title: 'Technical SEO Audit',
        description: 'Comprehensive crawl-budget analysis, Core Web Vitals optimization, and structured data implementation.',
        href: '/services/technical-seo',
      },
      {
        title: 'Link Building',
        description: 'White-hat digital PR and editorial outreach campaigns that earn high-authority backlinks in your niche.',
        href: '/services/link-building',
      },
    ],
  },
}
