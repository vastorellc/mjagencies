/**
 * packages/db/src/migrate/apply-custom.ts
 *
 * Reads and applies custom DDL files that drizzle-kit does not generate.
 * These files are applied in order AFTER the drizzle-kit generated migration.
 *
 * Apply order (per Plans 02-01, 02-03, 02-06, 03-02, 03-06):
 *   1. custom/001_agency_id_immutable.sql  — immutability trigger
 *   2. custom/002_force_rls_and_app_role.sql — FORCE RLS + per-agency role grants
 *
 * Template substitution:
 *   :'app_role' and :"app_role" placeholders are replaced with <slug>_user before
 *   the SQL is applied. This avoids psql variable syntax which postgres-js cannot execute.
 *
 * psql meta-command stripping:
 *   Lines beginning with \ (psql meta-commands like \connect) are stripped.
 *   postgres-js cannot run psql meta-commands and will throw on them.
 *
 * Security note (T-02-008):
 *   All slug values come from the compile-time AGENCIES constant in @mjagency/config.
 *   No user-provided input reaches this substitution path.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Sql } from 'postgres'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Path to custom migration files, resolved relative to this module's location.
// This module lives at packages/db/src/migrate/apply-custom.ts
// Custom files live at packages/db/src/migrations/custom/
const CUSTOM_DIR = path.resolve(__dirname, '../migrations/custom')

/**
 * Ordered list of custom DDL files to apply after drizzle-kit generated migrations.
 *
 * Apply order (per Plans 02-01, 02-03, 02-06, 03-02, 03-06):
 *   001 — agency_id immutability trigger (Plan 02-01)
 *   002 — FORCE RLS + per-agency app role grants (Plan 02-01)
 *   003 — audit log hash chain trigger + per-table capture triggers (Plan 02-06)
 *   004 — convert audit_log to monthly RANGE-partitioned table (Plan 02-06)
 *   005 — mfa_config: agency_id immutability + FORCE RLS + audit trigger + grants (Plan 03-02)
 *   006 — prevent_last_admin_delete() trigger on users (Plan 03-06)
 *
 * Cross-plan touch: entries 003 and 004 were appended by Plan 02-06.
 * Plan 02-03 shipped entries 001 and 002. Entry 005 appended by Plan 03-02.
 * Entry 006 appended by Plan 03-06.
 */
export const CUSTOM_FILES: readonly string[] = [
  '001_agency_id_immutable.sql',         // Plan 02-01
  '002_force_rls_and_app_role.sql',      // Plan 02-01
  '003_audit_triggers.sql',             // Plan 02-06
  '004_partition_audit_log.sql',         // Plan 02-06
  '005_audit_mfa_config.sql',            // Plan 03-02
  '006_prevent_last_admin_delete.sql',   // Plan 03-06 (NEW)
]

/**
 * Reads each custom DDL file, performs app_role substitution, strips psql meta-commands,
 * and applies via `client.unsafe()` (multi-statement DDL — requires direct port 5432).
 *
 * @param client - postgres-js Sql client connected as migrations_runner on port 5432
 * @param slug - agency slug (e.g. 'ecommerce') — used to derive role name '<slug>_user'
 */
export async function applyCustomDdl(client: Sql, slug: string): Promise<void> {
  for (const file of CUSTOM_FILES) {
    const raw = await readFile(path.join(CUSTOM_DIR, file), 'utf8')
    const substituted = raw
      .replace(/:'app_role'/g, `${slug}_user`)
      .replace(/:"app_role"/g, `${slug}_user`)
    // postgres-js does not run \connect or other psql meta-commands — strip them
    const sqlBody = substituted
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('\\'))
      .join('\n')
    await client.unsafe(sqlBody) // multi-statement DDL — port 5432 only (pitfall 8.2)
  }
}
