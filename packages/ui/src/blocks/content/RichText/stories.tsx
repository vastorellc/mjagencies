import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { RichText } from './index.js'

const meta: Meta<typeof RichText> = {
  title: 'Blocks/Content/RichText',
  component: RichText,
}
export default meta

type Story = StoryObj<typeof RichText>

export const Default: Story = {
  args: {
    content: React.createElement('div', null,
      React.createElement('h2', null, 'What Sets Our Growth Agency Apart'),
      React.createElement('p', null, 'We combine proprietary data models with hands-on execution to deliver compounding growth. Unlike traditional consultancies, we measure success by revenue attributed — not decks delivered.'),
      React.createElement('ul', null,
        React.createElement('li', null, 'Full-funnel ownership from awareness to retention'),
        React.createElement('li', null, 'Agency-embedded data scientists on every engagement'),
        React.createElement('li', null, 'Transparent reporting with weekly attribution audits'),
      ),
    ),
  },
}
