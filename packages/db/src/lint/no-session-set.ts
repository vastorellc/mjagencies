/**
 * packages/db/src/lint/no-session-set.ts
 *
 * Custom ESLint rule: no-session-set
 *
 * Rejects any Literal or TemplateElement that contains `SET app.agency_id`
 * (case-insensitive). Session-scoped SET leaks across PgBouncer transaction-mode
 * connection pools (pitfall 8.1).
 *
 * Correct pattern (SET LOCAL):
 *   await tx.execute(sql`SELECT set_config('app.agency_id', ${id}, true)`)
 *
 * Forbidden patterns (session-scoped SET):
 *   db.execute('SET app.agency_id = ...')
 *   db.execute(`SET app.agency_id = ${id}`)
 *
 * Reference: packages/db/src/client.ts, docs/runbooks/pgbouncer-rls.md
 */

import type { Rule } from 'eslint'

export const noSessionSet: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow session-scoped SET app.agency_id (pitfall 8.1)',
      url: 'docs/runbooks/pgbouncer-rls.md',
    },
    schema: [],
    messages: {
      sessionSet:
        "Use `set_config('app.agency_id', id, true)` (SET LOCAL) inside withAgencyContext — session-scoped SET leaks across PgBouncer pool connections.",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return
        if (/SET\s+app\.agency_id/i.test(node.value)) {
          context.report({ node, messageId: 'sessionSet' })
        }
      },
      TemplateElement(node) {
        if (/SET\s+app\.agency_id/i.test(node.value.raw)) {
          context.report({ node, messageId: 'sessionSet' })
        }
      },
    }
  },
}
