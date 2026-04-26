import type { Meta, StoryObj } from '@storybook/react';
import { BlogRelated } from './index.js';

const meta: Meta<typeof BlogRelated> = {
  title: 'Blocks/Blog/BlogRelated',
  component: BlogRelated,
};
export default meta;

type Story = StoryObj<typeof BlogRelated>;

export const Default: Story = {
  args: {
    headline: 'Related Articles',
    posts: [
      {
        title: 'How to Write Service Pages That Convert Visitors to Clients',
        slug: 'service-pages-that-convert',
        excerpt: 'Your service pages are your best sales tools — learn how to structure them for maximum conversion.',
        imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=200&q=80',
        imageAlt: 'Person writing on laptop',
      },
      {
        title: 'Local SEO Checklist: 20 Steps to Rank in Your City',
        slug: 'local-seo-checklist',
        excerpt: 'A step-by-step guide to dominating local search results in your target market.',
        imageUrl: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=200&q=80',
        imageAlt: 'SEO checklist on tablet',
      },
      {
        title: 'Google Business Profile Optimization Guide for 2026',
        slug: 'google-business-profile-optimization-2026',
        excerpt: 'Everything you need to know about getting the most out of your Google Business listing this year.',
      },
    ],
  },
};

export const WithoutHeadline: Story = {
  args: {
    posts: [
      {
        title: 'How to Write Service Pages That Convert Visitors to Clients',
        slug: 'service-pages-that-convert',
        excerpt: 'Your service pages are your best sales tools — learn how to structure them for maximum conversion.',
      },
      {
        title: 'Local SEO Checklist: 20 Steps to Rank in Your City',
        slug: 'local-seo-checklist',
        excerpt: 'A step-by-step guide to dominating local search results in your target market.',
      },
    ],
  },
};
