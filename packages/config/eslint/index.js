// @ts-check
import tseslint from 'typescript-eslint'

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
]
