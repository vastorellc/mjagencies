import type { Meta, StoryObj } from '@storybook/react';
import { ContactForm } from './index.js';

const meta: Meta<typeof ContactForm> = {
  title: 'Blocks/Form/ContactForm',
  component: ContactForm,
};
export default meta;

type Story = StoryObj<typeof ContactForm>;

export const Default: Story = {
  args: {
    formId: 'contact-main',
    headline: 'Get in Touch',
    description:
      'Ready to grow your business? Fill out the form below and a member of our team will contact you within one business day.',
    submitText: 'Send Message',
  },
};

export const Minimal: Story = {
  args: {
    formId: 'contact-footer',
    submitText: 'Send',
  },
};
