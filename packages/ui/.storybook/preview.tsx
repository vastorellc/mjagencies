// packages/ui/.storybook/preview.tsx
// Storybook preview configuration — Plan 04-05.
// Registers agency (12 AGENCIES dropdown) + darkMode (light/dark) globalTypes.
// withTheme decorator wraps stories in <div data-agency={X} data-theme={Y}>.
// Imports theme.css so all 6 token layers + agencies.generated.css + dark-mode cascade applies.
// RESEARCH §8.3 — decorator on wrapper div (cannot mutate <html> from iframe contents).
// REQ-044 (12 agencies), REQ-046 (dark mode).
import type { Preview, Decorator } from '@storybook/react';
// Import agency constants directly from the constants file (not the barrel) to avoid pulling in
// server-only transitive deps (otel-node, prom-client, pino) from @mjagency/config barrel.
import { AGENCIES, type AgencySlug } from '../../config/src/agency-constants.js';
import '../styles/theme.css';

// Decorator: apply data-agency + data-theme on a wrapper <div>.
// (We cannot mutate <html> from Storybook iframe contents reliably.)
const withTheme: Decorator = (Story, context) => {
  const { agency = 'brand', darkMode = false } = context.globals as {
    agency?:   AgencySlug;
    darkMode?: boolean;
  };
  return (
    <div
      data-agency={agency}
      data-theme={darkMode ? 'dark' : 'light'}
      style={{ minHeight: '100vh', background: 'var(--mj-color-bg-primary)', padding: '1rem' }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    agency: {
      description:  'Agency theme (Plan 04-04 — 12 niche themes)',
      defaultValue: 'brand',
      toolbar: {
        title: 'Agency',
        icon:  'paintbrush',
        items: AGENCIES.map(slug => ({ value: slug, title: slug })),
        dynamicTitle: true,
      },
    },
    darkMode: {
      description:  'Dark mode (Plan 04-01 dark-mode.css)',
      defaultValue: false,
      toolbar: {
        title: 'Dark Mode',
        icon:  'moon',
        items: [
          { value: false, title: 'Light' },
          { value: true,  title: 'Dark'  },
        ],
      },
    },
  },
  parameters: {
    layout: 'padded',
  },
};

export default preview;
