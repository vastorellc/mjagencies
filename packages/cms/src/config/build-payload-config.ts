/**
 * packages/cms/src/config/build-payload-config.ts
 *
 * Shared Payload CMS configuration factory consumed by all 12 agency apps.
 * Pinned to Payload CMS 3.82.1 — DO NOT UPGRADE (CLAUDE.md §1, REQ-050).
 *
 * Plan 05-01 output — Plan 05-02 adds CORE_COLLECTIONS via the `collections` option.
 * Plan 05-04: full Lexical feature set + BlocksFeature + SeoPanel sidebar component.
 *
 * Architecture note: This factory self-contains the editor and db adapter construction
 * so all agency apps share a single canonical Lexical config. Apps pass databaseUrl
 * and secret; the factory handles adapter wiring.
 */

// SOURCE: payloadcms.com/docs/getting-started/installation
// Pinned: payload 3.82.1 — DO NOT UPGRADE (CLAUDE.md §1, REQ-050, REQ-500)
import { buildConfig } from 'payload'
import type { CollectionConfig, Config } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor, BlocksFeature } from '@payloadcms/richtext-lexical'
import path from 'path'
import { getLexicalFeatures } from '../editor/lexical-features.js'
import { PAYLOAD_BLOCKS } from '../blocks/payload-blocks.js'
// Plan 11-04: Analytics dashboard custom admin view registration (REQ-143, D-13).
import { dashboardView } from '../admin-views/dashboard-view-config.js'

export interface BuildPayloadConfigOptions {
  /** Absolute directory of the calling app (pass `path.dirname(fileURLToPath(import.meta.url))`) */
  dirname: string
  /** Postgres connection string — injected from Doppler at runtime */
  databaseUrl: string
  /** Payload secret key — injected from Doppler at runtime */
  secret: string
  /** Additional collections to register (e.g. CORE_COLLECTIONS from Plan 05-02) */
  collections?: CollectionConfig[]
  /** Override Payload config options (merged, collections/db/editor override not allowed) */
  overrides?: Partial<Omit<Config, 'collections' | 'db' | 'editor'>>
}

/**
 * Builds a Payload CMS config for a single agency app.
 *
 * Usage in apps/web-<agency>/payload.config.ts:
 * ```ts
 * import { buildPayloadConfig, CORE_COLLECTIONS } from '@mjagency/cms'
 * import path from 'path'
 * import { fileURLToPath } from 'url'
 *
 * const filename = fileURLToPath(import.meta.url)
 * const dirname = path.dirname(filename)
 *
 * export default buildPayloadConfig({
 *   dirname,
 *   databaseUrl: process.env['DATABASE_URL'] ?? '',
 *   secret: process.env['PAYLOAD_SECRET'] ?? '',
 *   collections: CORE_COLLECTIONS,
 * })
 * ```
 */
export function buildPayloadConfig({
  dirname,
  databaseUrl,
  secret,
  collections = [],
  overrides = {},
}: BuildPayloadConfigOptions): ReturnType<typeof buildConfig> {
  return buildConfig({
    admin: {
      user: 'users',
      importMap: { baseDir: path.resolve(dirname) },
      meta: {
        // Prevent indexing of admin routes (cms.md PAYLOAD ADMIN SECURITY)
        robots: 'noindex,nofollow',
      },
      // SEO/AIO/GEO panel registered as afterDocControls component.
      // IMPORTANT: Use relative string path (NOT path.resolve absolute) so importMap resolves it.
      // Payload 3.82.1 resolves component paths via importMap.baseDir; absolute paths fail.
      components: {
        afterDocControls: [
          './src/app/(payload)/admin/components/SeoPanel',
        ],
        // Plan 11-04 D-13: register Surface 1 + Surface 2 dashboard at
        // /admin/dashboard. The view component path resolves via importMap;
        // see admin-views/DashboardView.tsx (CLAUDE.md §3 requireSession() first).
        views: {
          Dashboard: dashboardView,
        },
      },
      ...overrides.admin,
    },
    collections,
    editor: lexicalEditor({
      features: ({ defaultFeatures }) => [
        ...defaultFeatures,
        ...getLexicalFeatures(),
        // Register all 45 blocks so Payload Lexical exposes them in the block picker
        // and slash menu. PAYLOAD_BLOCKS is the array of Block configs from Plan 05-03c.
        BlocksFeature({ blocks: PAYLOAD_BLOCKS }),
      ],
    }),
    secret,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
    db: postgresAdapter({
      pool: { connectionString: databaseUrl },
    }),
    ...overrides,
  })
}
