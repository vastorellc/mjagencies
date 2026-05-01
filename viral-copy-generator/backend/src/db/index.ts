// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

// DATABASE_URL must NOT be the transaction pooler (port 6543) — prepared statements
// not supported there. The session pooler (port 5432) or the direct connection are
// both acceptable for a VPS backend using Drizzle and pg-boss.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export const db = drizzle(pool, { schema })
export { pool }
