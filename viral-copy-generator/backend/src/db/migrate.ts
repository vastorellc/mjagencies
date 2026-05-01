// backend/src/db/migrate.ts
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { pool } from './index.js'
import { drizzle } from 'drizzle-orm/node-postgres'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runMigrations(): Promise<void> {
  const db = drizzle(pool)
  const migrationsFolder = resolve(__dirname, '../../drizzle')

  console.log('[migrate] running migrations from:', migrationsFolder)
  await migrate(db, { migrationsFolder })
  console.log('[migrate] all migrations applied')
}
