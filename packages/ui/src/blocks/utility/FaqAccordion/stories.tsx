import type { Meta, StoryObj } from '@storybook/react';
import { FaqAccordion } from './index.js';

const meta: Meta<typeof FaqAccordion> = {
  title: 'Blocks/Utility/FaqAccordion',
  component: FaqAccordion,
};
export default meta;

type Story = StoryObj<typeof FaqAccordion>;

export const Default: Story = {
  args: {
    headline: 'Frequently Asked Questions',
    items: [
      {
        question: 'How long does it take to see results from digital marketing?',
        answer:
          'Most clients begin seeing measurable improvements in traffic and leads within 90 days for paid campaigns, and 6 to 12 months for organic SEO. Results vary based on your industry, current online presence, competition, and the specific strategies employed.',
      },
      {
        question: 'Do you work with businesses outside your niche?',
        answer:
          'Our agency specializes in professional and home services businesses because we have built deep expertise in these sectors. This focus allows us to deliver faster results and more relevant strategies than a generalist agency.',
      },
      {
        question: 'What is included in your monthly reporting?',
        answer:
          'Every client receives a comprehensive monthly report covering campaign performance, traffic and ranking changes, lead volume and quality, spend efficiency, and strategic recommendations for the following month. Reports are delivered by the 5th of each month.',
      },
      {
        question: 'What is your minimum contract length?',
        answer:
          'We offer both month-to-month and 12-month agreements. Our 12-month clients receive priority support, reduced setup fees, and better rates. Most clients choose annual contracts after their first 90 days once they see the results.',
      },
    ],
  },
};

export const WithoutHeadline: Story = {
  args: {
    items: [
      {
        question: 'What services do you offer?',
        answer:
          'We offer a comprehensive suite of digital marketing services including SEO, pay-per-click advertising, social media management, content marketing, email marketing, and website conversion optimization.',
      },
      {
        question: 'How do I get started?',
        answer:
          'Getting started is simple. Book a free strategy call using the button at the top of this page, and one of our specialists will review your current online presence and identify the best opportunities for your business.',
      },
    ],
  },
};
