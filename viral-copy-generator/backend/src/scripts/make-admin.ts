// backend/src/scripts/make-admin.ts
// Run ONCE after creating the admin user in Supabase dashboard.
// Usage: cd backend && npm run make-admin -- admin@example.com
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function makeAdmin(userEmail: string): Promise<void> {
  // listUsers() paginates (default 50/page) — iterate all pages to find the target user
  let page = 1
  let found: User | undefined
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    found = users.find(u => u.email === userEmail)
    if (found || users.length < 100) break
    page++
  }
  if (!found) throw new Error(`User not found: ${userEmail}`)

  const { error } = await supabase.auth.admin.updateUserById(found.id, {
    app_metadata: { role: 'admin' },
  })
  if (error) throw error

  console.log(`[make-admin] Admin role set for: ${userEmail} (id: ${found.id})`)
  console.log('[make-admin] The user must sign out and sign back in for the new JWT claim to take effect.')
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: npm run make-admin -- <email>')
  process.exit(1)
}

makeAdmin(email).catch(err => {
  console.error('[make-admin] Error:', (err as Error).message)
  process.exit(1)
})
