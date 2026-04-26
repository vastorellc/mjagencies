/**
 * packages/auth/eslint/require-session-first.js
 *
 * ESLint rule: require-session-first
 *
 * In any file with a top-level 'use server' directive, every exported async function
 * MUST have `const ... = await requireSession()` (or `await requireSession({...})`)
 * as its first statement.
 *
 * Covers BOTH export forms:
 *   - `export async function action() {}` (FunctionDeclaration)
 *   - `export const action = async () => {}` (VariableDeclaration > ArrowFunctionExpression)
 *
 * Exempt: function names starting with '_' (private helpers not callable as server actions).
 * Also accepts: namespaced calls like `await auth.requireSession()` (MemberExpression form).
 *
 * No auto-fix: incorrect insertion would be unsafe — the action's argument types affect
 * the call shape. See docs/runbooks/server-action-pattern.md for the canonical pattern.
 *
 * Reference: CLAUDE.md §3, REQ-031, docs/runbooks/server-action-pattern.md
 */

/**
 * @type {import('eslint').Rule.RuleModule}
 */
const requireSessionFirst = {
  meta: {
    type:     'problem',
    docs:     {
      description: "Require requireSession() as first statement in 'use server' files",
      url:         'docs/runbooks/server-action-pattern.md',
    },
    schema:   [],
    messages: {
      missingRequireSession:
        'Server action "{{name}}" must call `requireSession()` as its first statement (CLAUDE.md §3, REQ-031). See docs/runbooks/server-action-pattern.md.',
    },
  },

  create(context) {
    let isUseServerFile = false

    /**
     * Returns true if the given statement is:
     *   `const ... = await requireSession()` or `const ... = await requireSession({...})`
     * Also accepts `const ... = await something.requireSession()` (namespaced member-expression).
     */
    function isRequireSessionCall(statement) {
      if (!statement) return false
      if (statement.type !== 'VariableDeclaration') return false

      const init = statement.declarations?.[0]?.init
      if (!init) return false
      if (init.type !== 'AwaitExpression') return false

      const callee = init.argument?.callee
      if (!callee) return false

      // Direct call: requireSession()
      if (callee.type === 'Identifier' && callee.name === 'requireSession') return true

      // Namespaced call: auth.requireSession() or any.requireSession()
      if (
        callee.type === 'MemberExpression' &&
        callee.property?.name === 'requireSession'
      ) {
        return true
      }

      return false
    }

    /**
     * Core checker called for each exported async function node.
     * @param {object} node - AST node (FunctionDeclaration or synthetic faux-node for arrow)
     * @param {string} name - Function name for error message
     */
    function checkFunction(node, name) {
      if (!isUseServerFile) return
      if (!node.async) return

      // Exempt private helpers (names starting with '_')
      if (typeof name === 'string' && name.startsWith('_')) return

      const body = node.body?.body ?? []
      const firstStatement = body[0]

      if (!isRequireSessionCall(firstStatement)) {
        context.report({
          node,
          messageId: 'missingRequireSession',
          data:      { name: name ?? '(anonymous)' },
        })
      }
    }

    return {
      // Detect top-level 'use server' directive at file level
      Program(node) {
        const firstStatement = node.body?.[0]
        if (
          firstStatement?.type === 'ExpressionStatement' &&
          firstStatement.expression?.type === 'Literal' &&
          firstStatement.expression.value === 'use server'
        ) {
          isUseServerFile = true
        }
      },

      // Cover FunctionDeclaration: export async function action() {}
      'ExportNamedDeclaration > FunctionDeclaration'(node) {
        const name = node.id?.name ?? '(anonymous)'
        checkFunction(node, name)
      },

      // Cover VariableDeclarator with ArrowFunctionExpression:
      //   export const action = async () => {}
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression'(node) {
        const name = node.parent?.id?.name ?? '(anonymous)'
        checkFunction(node, name)
      },
    }
  },
}

export default requireSessionFirst
