import type { Meta, StoryObj } from '@storybook/react'
import { CaseStudyCard } from './index.js'

const meta: Meta<typeof CaseStudyCard> = {
  title: 'Blocks/Trust/CaseStudyCard',
  component: CaseStudyCard,
}
export default meta

type Story = StoryObj<typeof CaseStudyCard>

export const Default: Story = {
  args: {
    title: 'How Acme SaaS scaled organic pipeline with content authority',
    client: 'Acme SaaS',
    result: 'Organic search became the #1 acquisition channel within 9 months.',
    description: 'Acme SaaS had strong product-market fit but was invisible in search. We built a topical authority strategy around their core ICP job titles and delivered an editorial program that moved them from page 3 to position 1 for high-intent terms.',
    imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=600',
    imageAlt: 'Team reviewing analytics dashboard',
    href: '/case-studies/acme-saas-seo',
  },
}

export const NoImage: Story = {
  args: {
    title: 'Construct Labs: From 0 to 8,000 monthly organic sessions',
    client: 'Construct Labs',
    result: 'Domain authority increased from 18 to 47 over 12 months.',
    description: 'A greenfield SEO program launched from scratch, targeting long-tail technical search queries for construction project management software buyers.',
    href: '/case-studies/construct-labs',
  },
}
