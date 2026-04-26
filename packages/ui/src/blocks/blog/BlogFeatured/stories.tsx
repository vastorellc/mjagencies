import type { Meta, StoryObj } from '@storybook/react';
import { BlogFeatured } from './index.js';

const meta: Meta<typeof BlogFeatured> = {
  title: 'Blocks/Blog/BlogFeatured',
  component: BlogFeatured,
};
export default meta;

type Story = StoryObj<typeof BlogFeatured>;

export const Default: Story = {
  args: {
    post: {
      title: 'The 2026 Digital Marketing Playbook for Home Services Businesses',
      slug: '2026-digital-marketing-playbook-home-services',
      excerpt:
        'After analyzing over 300 home services campaigns, our team has identified the most effective digital marketing strategies for HVAC, plumbing, electrical, and landscaping businesses this year. Get the full breakdown of what is working now.',
      publishedAt: '2026-04-15T09:00:00Z',
      authorName: 'Marcus Reynolds',
      imageUrl:
        'https://images.unsplash.com/photo-1523289333742-be1143f6b766?w=800&q=80',
      imageAlt: 'Marketing team reviewing digital strategy on a whiteboard',
    },
  },
};
