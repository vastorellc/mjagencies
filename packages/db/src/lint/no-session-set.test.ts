/**
 * packages/db/src/lint/no-session-set.test.ts
 *
 * Tests for the no-session-set ESLint rule using RuleTester.
 *
 * The rule visits Literal and TemplateElement nodes only — plain // comments
 * are NOT flagged because they are tokens, not AST nodes visited by the rule.
 *
 * Valid cases:   set_config(…), regular DB calls, no SET app.agency_id
 * Invalid cases: string literals and template literals containing SET app.agency_id
 */

import { RuleTester } from 'eslint'
import { noSessionSet } from './no-session-set.js'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

tester.run('no-session-set', noSessionSet, {
  valid: [
    // Correct pattern — set_config with is_local=true (SET LOCAL)
    {
      code: `await tx.execute(sql\`SELECT set_config('app.agency_id', \${id}, true)\`)`,
    },
    // Completely unrelated DB call — no SET app.agency_id
    {
      code: `db.execute('SELECT * FROM users')`,
    },
    // A SELECT with set_config — still valid (not the forbidden session-scoped SET)
    {
      code: `db.execute("SELECT set_config('app.agency_id', '123', true)")`,
    },
    // Inline comment (// SET app.agency_id) is a token, NOT a Literal — not flagged
    {
      code: `const x = 1 // SET app.agency_id = forbidden comment`,
    },
    // set_config in a template literal — valid
    {
      code: `const q = \`SELECT set_config('app.agency_id', '\${id}', true)\``,
    },
    // Unrelated assignment
    {
      code: `const setting = 'app.agency_id'`,
    },
  ],

  invalid: [
    // Session-scoped SET in a string literal — most obvious forbidden pattern
    {
      code: `db.execute("SET app.agency_id = 'foo'")`,
      errors: [{ messageId: 'sessionSet' }],
    },
    // Session-scoped SET in a single-quote string literal
    {
      code: `db.execute('SET app.agency_id = \\'foo\\'')`,
      errors: [{ messageId: 'sessionSet' }],
    },
    // Session-scoped SET in a template literal
    {
      code: "db.execute(`SET app.agency_id = ${id}`)",
      errors: [{ messageId: 'sessionSet' }],
    },
    // Case-insensitive: mixed case matches
    {
      code: `db.execute('Set App.Agency_Id = foo')`,
      errors: [{ messageId: 'sessionSet' }],
    },
    // ALL CAPS
    {
      code: `db.execute('SET APP.AGENCY_ID = foo')`,
      errors: [{ messageId: 'sessionSet' }],
    },
    // Template literal with extra whitespace between SET and app.agency_id
    {
      code: "const q = `SET  app.agency_id = ${agencyId}`",
      errors: [{ messageId: 'sessionSet' }],
    },
  ],
})

// RuleTester throws on assertion failure — if we reach here, all cases passed.
// This export is a Vitest-compatible signal that the test module ran successfully.
export {}
