import type { Meta, StoryObj } from '@storybook/react';
import { Divider } from './index.js';

const meta: Meta<typeof Divider> = {
  title: 'Blocks/Utility/Divider',
  component: Divider,
};
export default meta;

type Story = StoryObj<typeof Divider>;

export const Line: Story = {
  args: {
    style: 'line',
    size: 'md',
  },
};

export const Space: Story = {
  args: {
    style: 'space',
    size: 'lg',
  },
};

export const Ornament: Story = {
  args: {
    style: 'ornament',
    size: 'md',
  },
};

export const SmallLine: Story = {
  args: {
    style: 'line',
    size: 'sm',
  },
};
