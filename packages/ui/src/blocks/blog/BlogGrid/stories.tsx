import type { Meta, StoryObj } from '@storybook/react';
import { BlogGrid } from './index.js';

const meta: Meta<typeof BlogGrid> = {
  title: 'Blocks/Blog/BlogGrid',
  component: BlogGrid,
};
export default meta;

type Story = StoryObj<typeof BlogGrid>;

const samplePosts = [
  {
    title: 'How to Build a Strong SEO Strategy for Local Law Firms',
    slug: 'seo-strategy-local-law-firms',
    excerpt:
      'Discover the most effective tactics for improving organic search rankings and driving qualified traffic to your legal practice website.',
    publishedAt: '2026-04-10T09:00:00Z',
    authorName: 'Sarah Mitchell',
    imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&q=80',
    imageAlt: 'Law books on a wooden desk',
  },
  {
    title: 'The Complete Guide to Social Media for Financial Advisors',
    slug: 'social-media-financial-advisors',
    excerpt:
      'Learn how financial advisors can leverage LinkedIn, Twitter, and niche communities to grow their client base while staying compliant.',
    publishedAt: '2026-04-08T09:00:00Z',
    authorName: 'James Thornton',
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80',
    imageAlt: 'Laptop showing analytics dashboard',
  },
  {
    title: '5 Google Ads Mistakes Healthcare Providers Make (And How to Fix Them)',
    slug: 'google-ads-mistakes-healthcare',
    excerpt:
      'Avoid costly ad spend errors with these proven optimization techniques tailored specifically for medical and dental practices.',
    publishedAt: '2026-04-05T09:00:00Z',
    authorName: 'Emily Chen',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80',
    imageAlt: 'Doctor consulting with patient',
  },
];

export const ThreeColumns: Story = {
  args: {
    posts: samplePosts,
    columns: 3,
  },
};

export const TwoColumns: Story = {
  args: {
    posts: samplePosts.slice(0, 2),
    columns: 2,
  },
};

export const NoImages: Story = {
  args: {
    posts: samplePosts.map(({ imageUrl, imageAlt, ...rest }) => rest),
    columns: 3,
  },
};
