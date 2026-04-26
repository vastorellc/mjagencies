import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ServiceDetail } from './index.js'

const meta: Meta<typeof ServiceDetail> = {
  title: 'Blocks/Service/ServiceDetail',
  component: ServiceDetail,
}
export default meta

type Story = StoryObj<typeof ServiceDetail>

export const Default: Story = {
  args: {
    title: 'Enterprise SEO Strategy',
    description: React.createElement('p', null, 'We build and execute holistic SEO programs that drive sustainable organic growth. Our approach combines technical excellence with editorial authority to deliver top-of-funnel pipeline at scale.'),
    features: [
      'Full technical SEO audit covering 200+ ranking signals',
      'Keyword strategy mapped to your buyer journey stages',
      'Content gap analysis against top-3 competitors',
      'Monthly authority-building link acquisition campaigns',
      'Core Web Vitals monitoring and remediation',
      'Transparent reporting with revenue attribution',
    ],
    ctaText: 'Get Your Free SEO Audit',
    ctaHref: '/contact/seo-audit',
  },
}

export const WithIcon: Story = {
  args: {
    title: 'Paid Search Management',
    description: React.createElement('p', null, 'Full-funnel Google Ads and Microsoft Advertising management with a focus on cost-per-acquisition, not vanity metrics.'),
    iconUrl: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=64',
    iconAlt: 'Paid search icon',
    features: [
      'Account structure audit and rebuild',
      'Conversion tracking implementation',
      'Bid strategy optimization',
      'Ad copy testing framework',
    ],
    ctaText: 'Start a Campaign',
    ctaHref: '/contact',
  },
}
