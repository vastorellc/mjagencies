import type { Meta, StoryObj } from '@storybook/react';
import { AuthorBio } from './index.js';

const meta: Meta<typeof AuthorBio> = {
  title: 'Blocks/Blog/AuthorBio',
  component: AuthorBio,
};
export default meta;

type Story = StoryObj<typeof AuthorBio>;

export const Default: Story = {
  args: {
    name: 'Sarah Mitchell',
    role: 'Senior Content Strategist',
    bio: 'Sarah has spent 12 years helping professional services firms build their digital presence. She specializes in SEO-driven content strategies for law firms, financial advisors, and healthcare practices across the United States.',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
    imageAlt: 'Sarah Mitchell, content strategist',
    socialLinks: [
      { platform: 'LinkedIn', href: 'https://linkedin.com/in/sarah-mitchell' },
      { platform: 'Twitter', href: 'https://twitter.com/sarahmitchell' },
    ],
  },
};

export const WithoutImage: Story = {
  args: {
    name: 'Marcus Reynolds',
    role: 'PPC Specialist',
    bio: 'Marcus manages paid advertising campaigns for home services and healthcare clients, with a focus on Google Ads, Microsoft Advertising, and local service ads.',
    socialLinks: [
      { platform: 'LinkedIn', href: 'https://linkedin.com/in/marcus-reynolds' },
    ],
  },
};

export const NoLinks: Story = {
  args: {
    name: 'Emily Chen',
    bio: 'Emily focuses on data-driven marketing strategies and conversion rate optimization for B2B professional services clients.',
  },
};
