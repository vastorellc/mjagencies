import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ThreeColumn } from './index.js'

const meta: Meta<typeof ThreeColumn> = {
  title: 'Blocks/Content/ThreeColumn',
  component: ThreeColumn,
}
export default meta

type Story = StoryObj<typeof ThreeColumn>

export const Default: Story = {
  args: {
    columns: [
      {
        content: React.createElement('div', null,
          React.createElement('h3', null, 'Discovery'),
          React.createElement('p', null, 'Structured interviews + data audit to map your current state revenue motion and identify the highest-leverage intervention points.'),
        ),
      },
      {
        content: React.createElement('div', null,
          React.createElement('h3', null, 'Design'),
          React.createElement('p', null, 'Custom growth system architecture — martech stack, playbook sequencing, funnel instrumentation — built around your ICP and sales cycle.'),
        ),
      },
      {
        content: React.createElement('div', null,
          React.createElement('h3', null, 'Deploy'),
          React.createElement('p', null, 'Embedded execution: campaign launches, automation builds, weekly attribution reviews, and handoff documentation for internal ownership.'),
        ),
      },
    ],
  },
}
