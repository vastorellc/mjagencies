// packages/ui/.storybook/main.ts
// Storybook v9.1.20 configuration — Plan 04-05.
// Framework: @storybook/nextjs-vite (replaces Webpack-based @storybook/nextjs in v9).
// RESEARCH §8.1, §8.2, §11 — locked to v9.1.20 (v10 < 2 weeks old at research time).
// REQ-048: visual regression CI for 45 blocks × 12 themes (Phase 5 populates the 45 blocks).
import type { StorybookConfig } from '@storybook/nextjs-vite';
import type { UserConfig } from 'vite';

// Node.js-only packages pulled in transitively from @mjagency/config (otel + prom-client + pino).
// These are server-runtime only and must not be bundled by Vite for browser.
const NODE_ONLY_EXTERNALS = [
  'prom-client',
  'pino',
  '@opentelemetry/sdk-node',
  '@opentelemetry/auto-instrumentations-node',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/instrumentation-pino',
  '@opentelemetry/otlp-exporter-base',
  '@opentelemetry/resources',
  '@opentelemetry/api',
  '@opentelemetry/context-async-hooks',
  '@opentelemetry/core',
  '@opentelemetry/sdk-trace-base',
  '@opentelemetry/sdk-metrics',
];

const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: [
    // M004: smoke block only. Phase 5 adds the real 45 blocks (REQ-052).
    '../src/blocks/**/*.stories.@(ts|tsx)',
    '../src/components/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    // Note: @storybook/addon-essentials is bundled into storybook@9 core — not a separate package.
    '@storybook/addon-themes',
    // @chromatic-com/storybook: no release compatible with storybook@9.x series.
    // chromatic.modes metadata on stories is portable — Phase 8+ migration uses it directly.
    // Migration path documented in docs/runbooks/storybook-visual-regression.md.
  ],
  docs: { autodocs: 'tag' },
  viteFinal(viteConfig: UserConfig): UserConfig {
    // Externalize Node.js-only packages that Vite cannot bundle for browser environment.
    // @mjagency/config barrel re-exports otel-node.ts + metrics.ts which use Node.js builtins.
    const rollupExternals = NODE_ONLY_EXTERNALS.map(pkg => new RegExp(`^${pkg.replace('/', '\\/')}`));
    return {
      ...viteConfig,
      build: {
        ...viteConfig.build,
        rollupOptions: {
          ...(viteConfig.build?.rollupOptions ?? {}),
          external: [
            ...((viteConfig.build?.rollupOptions?.external as (string | RegExp)[]) ?? []),
            ...rollupExternals,
          ],
        },
      },
    };
  },
};
export default config;
