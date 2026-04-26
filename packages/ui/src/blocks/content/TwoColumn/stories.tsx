import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { TwoColumn } from './index.js'

const meta: Meta<typeof TwoColumn> = {
  title: 'Blocks/Content/TwoColumn',
  component: TwoColumn,
}
export default meta

type Story = StoryObj<typeof TwoColumn>

export const Default: Story = {
  args: {
    leftContent: React.createElement('div', null,
      React.createElement('h3', null, 'Our Diagnostic Process'),
      React.createElement('p', null, 'Every engagement starts with a 14-day diagnostic that maps your current revenue motion, identifies the top 3 friction points, and produces a prioritized 90-day action plan.'),
    ),
    rightContent: React.createElement('div', null,
      React.createElement('h3', null, 'Execution That Sticks'),
      React.createElement('p', null, 'We embed alongside your team — not above them. Processes are documented, tooling is configured, and ownership transfers fully by the end of the engagement.'),
    ),
  },
}
