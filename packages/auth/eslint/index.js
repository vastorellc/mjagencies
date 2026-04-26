/**
 * packages/auth/eslint/index.js
 *
 * ESLint plugin for @mjagency/auth.
 *
 * Registers the `require-session-first` rule for use in flat-config eslint.config.js:
 *
 *   import authPlugin from '@mjagency/auth/eslint'
 *   // or: const authPlugin = require('@mjagency/auth/eslint')
 *
 *   export default [
 *     {
 *       plugins: { 'mjagency-auth': authPlugin },
 *       rules:   { 'mjagency-auth/require-session-first': 'error' },
 *     },
 *   ]
 *
 * Reference: CLAUDE.md §3, REQ-031, packages/config/eslint/index.js
 */

import requireSessionFirst from './require-session-first.js'

const plugin = {
  rules: {
    'require-session-first': requireSessionFirst,
  },
}

export default plugin
