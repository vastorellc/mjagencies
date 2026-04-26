/**
 * packages/cms/src/config/build-payload-config.ts
 *
 * buildPayloadConfig() — Shared Payload 3.82.1 config factory.
 *
 * apps/web-main/payload.config.ts imports this function and passes
 * the collections array (assembled in Plan 05-02).
 *
 * Constraints (specs/cms.md PAYLOAD ADMIN SECURITY):
 *   - X-Robots-Tag: noindex on /admin routes
 *   - robots.txt: Disallow: /admin (handled in Phase 8 public frontend)
 *   - Admin not linked from any public page
 *
 * Constraint (specs/cms.md IMPORTANT CONSTRAINTS — 3.82.1 pinned):
 *   - All custom collection views: exact: true (3.83.0 regression workaround)
 *
 * Scheduled publishing (REQ-057):
 *   - BullMQ queue name: 'cms-scheduled-publish'
 *   - Key prefix: REDIS_KEY.bullPrefix(agencyId) from @mjagency/config
 *   - Worker imported by apps/web-main instrumentation.node.ts (not in this file)
 */
import type { CollectionConfig } from 'payload'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'

export interface BuildPayloadConfigOptions {
  /** Absolute dirname of the app's payload.config.ts (pass path.dirname(fileURLToPath(import.meta.url))) */
  dirname: string
  /** DATABASE_URL for this app's Postgres connection (via PgBouncer). Always required. */
  databaseUrl: string
  /** PAYLOAD_SECRET from env. Must be ≥32 chars. */
  secret: string
  /** Collections assembled in Plan 05-02. Empty array for Plan 05-01 bootstrap. */
  collections?: CollectionConfig[]
}

export function buildPayloadConfig(opts: BuildPayloadConfigOptions): ReturnType<typeof buildConfig> {
  const { dirname, databaseUrl, secret, collections = [] } = opts
  return buildConfig({
    admin: {
      user: 'users',
      importMap: { baseDir: path.resolve(dirname) },
      meta: {
        // Security: X-Robots-Tag noindex on admin (specs/cms.md PAYLOAD ADMIN SECURITY)
        robots: 'noindex, nofollow',
      },
    },
    collections,
    editor: lexicalEditor({}), // Plan 05-04 replaces this with full feature set
    secret,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
    db: postgresAdapter({
      pool: { connectionString: databaseUrl },
    }),
    // Payload 3.82.1 pin: do not remove the version comment — CI gate checks this
    // pnpm list payload | grep 3.82.1 (REQ-501)
  })
}
