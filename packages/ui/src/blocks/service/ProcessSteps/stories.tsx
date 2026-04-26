import type { Meta, StoryObj } from '@storybook/react'
import { ProcessSteps } from './index.js'

const meta: Meta<typeof ProcessSteps> = {
  title: 'Blocks/Service/ProcessSteps',
  component: ProcessSteps,
}
export default meta

type Story = StoryObj<typeof ProcessSteps>

export const Default: Story = {
  args: {
    steps: [
      {
        step: 1,
        title: 'Discovery & Audit',
        description: 'We conduct a deep-dive audit of your current digital presence, competitor landscape, and customer acquisition costs to establish a baseline.',
      },
      {
        step: 2,
        title: 'Strategy Development',
        description: 'Our team builds a 90-day roadmap with prioritized initiatives ranked by potential revenue impact and implementation effort.',
      },
      {
        step: 3,
        title: 'Execution & Optimization',
        description: 'Weekly sprints with bi-weekly reporting. We test, learn, and iterate continuously to compound results over time.',
      },
      {
        step: 4,
        title: 'Scale & Expand',
        description: 'Once core channels are optimized, we identify adjacent opportunities and build the playbooks to scale proven tactics.',
      },
    ],
  },
}
