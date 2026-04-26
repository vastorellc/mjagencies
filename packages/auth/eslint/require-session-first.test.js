/**
 * packages/auth/eslint/require-session-first.test.js
 *
 * RuleTester suite for the `require-session-first` ESLint rule.
 *
 * Run with: node packages/auth/eslint/require-session-first.test.js
 *
 * Coverage:
 *   Valid cases (6)   — rule does NOT report an error
 *   Invalid cases (6) — rule DOES report missingRequireSession
 *
 * Reference: CLAUDE.md §3, REQ-031, docs/runbooks/server-action-pattern.md
 */

import { RuleTester } from 'eslint'
import rule from './require-session-first.js'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType:  'module',
  },
})

tester.run('require-session-first', rule, {
  // ── Valid cases — rule MUST NOT report ────────────────────────────────────
  valid: [
    // Valid 1: 'use server' file — FunctionDeclaration, first line is requireSession()
    {
      code: `
        'use server'
        export async function updatePage(data) {
          const session = await requireSession()
          return doSomething(data)
        }
      `,
    },

    // Valid 2: 'use server' file — FunctionDeclaration, parameterized call requireSession({...})
    {
      code: `
        'use server'
        export async function updatePage(data) {
          const session = await requireSession({ requireMfa: true })
          return doSomething(data)
        }
      `,
    },

    // Valid 3: 'use server' file — arrow function form, first line is requireSession()
    {
      code: `
        'use server'
        export const updatePage = async (data) => {
          const session = await requireSession()
          return doSomething(data)
        }
      `,
    },

    // Valid 4: NO 'use server' directive — rule passes through, no report
    {
      code: `
        export async function updatePage(data) {
          const x = 1
          return x
        }
      `,
    },

    // Valid 5: 'use server' file — function starting with '_' is exempt (private helpers)
    {
      code: `
        'use server'
        export async function _internalHelper(data) {
          const x = 1
          return x
        }
      `,
    },

    // Valid 6: 'use server' file — namespaced call (auth.requireSession()) also accepted
    {
      code: `
        'use server'
        export async function updatePage(data) {
          const session = await auth.requireSession()
          return doSomething(data)
        }
      `,
    },
  ],

  // ── Invalid cases — rule MUST report missingRequireSession ────────────────
  invalid: [
    // Invalid 1: requireSession is present but NOT first — other statement before it
    {
      code: `
        'use server'
        export async function updatePage(data) {
          const x = 1
          const session = await requireSession()
        }
      `,
      errors: [{ messageId: 'missingRequireSession' }],
    },

    // Invalid 2: guard before requireSession — if-guard is first statement, not requireSession
    {
      code: `
        'use server'
        export async function updatePage(data) {
          if (!data) return
          const session = await requireSession()
        }
      `,
      errors: [{ messageId: 'missingRequireSession' }],
    },

    // Invalid 3: requireSession missing entirely — no call at all
    {
      code: `
        'use server'
        export async function updatePage(data) {
          const x = 1
          return x
        }
      `,
      errors: [{ messageId: 'missingRequireSession' }],
    },

    // Invalid 4: first line is await but NOT requireSession — wrong function called
    {
      code: `
        'use server'
        export async function updatePage(data) {
          await someOther()
        }
      `,
      errors: [{ messageId: 'missingRequireSession' }],
    },

    // Invalid 5: arrow function form — no requireSession at all
    {
      code: `
        'use server'
        export const updatePage = async (data) => {
          return data
        }
      `,
      errors: [{ messageId: 'missingRequireSession' }],
    },

    // Invalid 6: synchronous call (missing await) — not an AwaitExpression
    {
      code: `
        'use server'
        export async function updatePage(data) {
          const session = requireSession()
          return doSomething(data)
        }
      `,
      errors: [{ messageId: 'missingRequireSession' }],
    },
  ],
})

// RuleTester throws on assertion failure.
// If we reach here, all 12 cases passed.
console.log('require-session-first: all 12 RuleTester cases passed.')
