/**
 * packages/cms/src/config/build-payload-config.ts
 *
 * Shared Payload CMS configuration factory consumed by all 12 agency apps.
 * Pinned to Payload CMS 3.82.1 — DO NOT UPGRADE (CLAUDE.md §1, REQ-050).
 *
 * Plan 05-01 output — Plan 05-02 adds CORE_COLLECTIONS via the `collections` option.
 * Plan 05-04 adds full Lexical feature set via the `editor` option.
 *
 * NOTE: This factory does not import @payloadcms/db-postgres or @payloadcms/richtext-lexical
 * directly — those are consumed by each app's payload.config.ts (they are app-level deps).
 * The factory only imports from 'payload' which is a peer dep of @mjagency/cms.
 */

import { buildConfig } from 'payload'
import type { CollectionConfig, Config } from 'payload'

export interface BuildPayloadConfigOptions {
  /** Absolute directory of the calling app (pass `path.dirname(fileURLToPath(import.meta.url))`) */
  dirname: string
  /** Postgres connection string — injected from Doppler at runtime */
  databaseUrl: string
  /** Payload secret key — injected from Doppler at runtime */
  secret: string
  /** Additional collections to register (e.g. CORE_COLLECTIONS from Plan 05-02) */
  collections?: CollectionConfig[]
  /**
   * Database adapter — must be constructed by the calling app:
   * ```ts
   * import { postgresAdapter } from '@payloadcms/db-postgres'
   * db: postgresAdapter({ pool: { connectionString: databaseUrl } })
   * ```
   */
  db: Config['db']
  /**
   * Rich-text editor — must be constructed by the calling app:
   * ```ts
   * import { lexicalEditor } from '@payloadcms/richtext-lexical'
   * editor: lexicalEditor({})
   * ```
   * Plan 05-04 replaces this with the full Lexical feature set.
   */
  editor: Config['editor']
  /** Override Payload config options (merged, collections-override not allowed) */
  overrides?: Partial<Omit<Config, 'collections' | 'db' | 'editor'>>
}

/**
 * Builds a Payload CMS config for a single agency app.
 *
 * Usage in apps/web-<agency>/payload.config.ts:
 * ```ts
 * import { buildPayloadConfig, CORE_COLLECTIONS } from '@mjagency/cms'
 * import { postgresAdapter } from '@payloadcms/db-postgres'
 * import { lexicalEditor } from '@payloadcms/richtext-lexical'
 * import path from 'path'
 * import { fileURLToPath } from 'url'
 *
 * const filename = fileURLToPath(import.meta.url)
 * const dirname = path.dirname(filename)
 *
 * export default buildPayloadConfig({
 *   dirname,
 *   databaseUrl: process.env.DATABASE_URL ?? '',
 *   secret: process.env.PAYLOAD_SECRET ?? '',
 *   collections: CORE_COLLECTIONS,
 *   db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL ?? '' } }),
 *   editor: lexicalEditor({}),
 * })
 * ```
 */
export function buildPayloadConfig({
  dirname,
  secret,
  collections = [],
  db,
  editor,
  overrides = {},
}: BuildPayloadConfigOptions): ReturnType<typeof buildConfig> {
  return buildConfig({
    admin: {
      user: 'users',
      importMap: { baseDir: dirname },
      meta: {
        // Prevent indexing of admin routes (cms.md PAYLOAD ADMIN SECURITY)
        robots: 'noindex,nofollow',
      },
      ...overrides.admin,
    },
    collections,
    editor,
    secret,
    typescript: {
      outputFile: `${dirname}/payload-types.ts`,
    },
    db,
    ...overrides,
  })
}
