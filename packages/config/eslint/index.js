// @ts-check
import tseslint from 'typescript-eslint'
import { noSessionSet } from '@mjagency/db/lint'
import authEslintPlugin from '@mjagency/auth/eslint'

export default [
  ...tseslint.configs.recommended,
  {
    rules: {
      // REQ-502 + CLAUDE.md §2 — ban jsonwebtoken
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'jsonwebtoken',
            message: 'Use jose only — jsonwebtoken is Edge-incompatible (CLAUDE.md §2).',
          },
        ],
      }],
      // SEC-N4 — ban dangerouslyAllowSVG (custom selector)
      'no-restricted-syntax': ['error',
        {
          selector: "Property[key.name='dangerouslyAllowSVG']",
          message: 'dangerouslyAllowSVG is forbidden on Next.js Image (SEC-N4).',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML must only be used with sanitized content (DOMPurify). Move sanitization upstream and add an // eslint-disable-next-line for the verified call site.',
        },
        {
          // REQ-503 — ban NEXT_PUBLIC_*KEY access in code
          selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_.*KEY$/]",
          message: 'Do not access NEXT_PUBLIC_*KEY env vars in code — secrets must be server-side only (REQ-503, CLAUDE.md §7).',
        },
      ],
    },
  },
  // REQ-011 + T-02-001 — block session-scoped SET app.agency_id across PgBouncer pools
  // See: packages/db/src/lint/no-session-set.ts, docs/runbooks/pgbouncer-rls.md
  {
    files: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
    plugins: {
      'mjagency-db': {
        rules: {
          'no-session-set': noSessionSet,
        },
      },
    },
    rules: {
      'mjagency-db/no-session-set': 'error',
    },
  },
  // Plan 03-05 — REQ-031, CLAUDE.md §3 — server actions must call requireSession() first
  // See: packages/auth/eslint/require-session-first.js, docs/runbooks/server-action-pattern.md
  {
    files: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
    plugins: {
      'mjagency-auth': authEslintPlugin,
    },
    rules: {
      'mjagency-auth/require-session-first': 'error',
    },
  },
]
