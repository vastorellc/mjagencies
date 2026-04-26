import type { Meta, StoryObj } from '@storybook/react';
import { NewsletterForm } from './index.js';

const meta: Meta<typeof NewsletterForm> = {
  title: 'Blocks/Form/NewsletterForm',
  component: NewsletterForm,
};
export default meta;

type Story = StoryObj<typeof NewsletterForm>;

export const Default: Story = {
  args: {
    formId: 'newsletter-footer',
    headline: 'Get Marketing Tips in Your Inbox',
    description:
      'Join over 4,200 business owners who receive our weekly digest of proven marketing strategies, case studies, and industry insights.',
    submitText: 'Subscribe',
    disclaimer:
      'We respect your privacy. Unsubscribe at any time. No spam, ever.',
  },
};

export const Minimal: Story = {
  args: {
    formId: 'newsletter-inline',
    submitText: 'Subscribe',
  },
};
