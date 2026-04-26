import type { Meta, StoryObj } from '@storybook/react'
import { PortfolioGrid } from './index.js'

const meta: Meta<typeof PortfolioGrid> = {
  title: 'Blocks/Media/PortfolioGrid',
  component: PortfolioGrid,
}
export default meta

type Story = StoryObj<typeof PortfolioGrid>

export const Default: Story = {
  args: {
    columns: 3,
    items: [
      {
        title: 'Acme SaaS — Organic Growth Program',
        imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=600',
        imageAlt: 'SEO analytics dashboard',
        category: 'SEO Strategy',
        href: '/portfolio/acme-saas',
      },
      {
        title: 'Construct Labs — B2B Content Authority',
        imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600',
        imageAlt: 'Content team at work',
        category: 'Content Marketing',
        href: '/portfolio/construct-labs',
      },
      {
        title: 'Meridian Health — Technical SEO Overhaul',
        imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600',
        imageAlt: 'Technical audit report on screen',
        category: 'Technical SEO',
        href: '/portfolio/meridian-health',
      },
      {
        title: 'Fulcrum Analytics — Paid Search Scale',
        imageUrl: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600',
        imageAlt: 'PPC campaign dashboard',
        category: 'Paid Media',
      },
      {
        title: 'BuildBridge — Brand Awareness Campaign',
        imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600',
        imageAlt: 'Brand design presentation',
        category: 'Brand Strategy',
      },
      {
        title: 'Apex Logistics — LinkedIn Lead Generation',
        imageUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600',
        imageAlt: 'LinkedIn ad campaign',
        category: 'Social Media',
      },
    ],
  },
}
