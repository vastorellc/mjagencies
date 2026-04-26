import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './src/migrations',
  migrations: { table: '__drizzle_migrations', schema: 'public' },
  entities: { roles: true }, // pgPolicy needs role references
})
