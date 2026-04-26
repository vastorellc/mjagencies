import type { Meta, StoryObj } from '@storybook/react'
import { FeatureList } from './index.js'

const meta: Meta<typeof FeatureList> = {
  title: 'Blocks/Service/FeatureList',
  component: FeatureList,
}
export default meta

type Story = StoryObj<typeof FeatureList>

export const Default: Story = {
  args: {
    headline: 'What is included in our SEO Retainer',
    features: [
      {
        title: 'Monthly Technical Audit',
        description: 'Full crawl of your site identifying indexation issues, broken links, and performance regressions.',
        included: true,
      },
      {
        title: 'Content Brief Production',
        description: 'Keyword-researched briefs for 4 new articles per month, ready for your content team or ours.',
        included: true,
      },
      {
        title: 'Link Building Outreach',
        description: 'Dedicated digital PR campaigns targeting DA 40+ publications in your industry.',
        included: true,
      },
      {
        title: 'Paid Search Management',
        description: 'Google Ads and Microsoft Advertising account management and optimization.',
        included: false,
      },
      {
        title: 'Social Media Management',
        description: 'Organic social posting and community management across LinkedIn, X, and Instagram.',
        included: false,
      },
    ],
  },
}
