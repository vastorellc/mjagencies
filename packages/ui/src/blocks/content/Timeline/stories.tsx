import type { Meta, StoryObj } from '@storybook/react'
import { Timeline } from './index.js'

const meta: Meta<typeof Timeline> = {
  title: 'Blocks/Content/Timeline',
  component: Timeline,
}
export default meta

type Story = StoryObj<typeof Timeline>

export const Default: Story = {
  args: {
    items: [
      {
        date: 'Week 1-2',
        title: 'Revenue Diagnostic',
        description: 'Deep-dive audit of your current acquisition channels, conversion rates, and customer lifetime value segmentation to establish a baseline and identify leverage points.',
      },
      {
        date: 'Week 3-4',
        title: 'Growth System Architecture',
        description: 'Custom playbook design: ICP refinement, channel prioritization, martech stack audit, funnel instrumentation plan, and a 90-day execution roadmap.',
      },
      {
        date: 'Month 2-3',
        title: 'Execution Sprint',
        description: 'Hands-on execution of the highest-priority initiatives — campaign launches, automation builds, landing page optimization, and weekly attribution reviews.',
      },
      {
        date: 'Month 3',
        title: 'Handoff and Documentation',
        description: 'Complete SOPs, runbooks, and training for your internal team. Full ownership transfer with 30-day post-engagement support included.',
      },
    ],
  },
}
