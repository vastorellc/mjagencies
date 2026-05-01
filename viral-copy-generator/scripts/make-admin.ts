// scripts/make-admin.ts
// Run ONCE after creating the admin user in Supabase dashboard.
// Usage: cd backend && npm run make-admin -- admin@example.com
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function makeAdmin(userEmail: string): Promise<void> {
  // Step 1: look up the user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw listError

  const user = users.find(u => u.email === userEmail)
  if (!user) throw new Error(`User not found: ${userEmail}`)

  // Step 2: set role in app_metadata
  // app_metadata is immutable by the user — only the admin API (service role key) can change it
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { role: 'admin' },
  })
  if (error) throw error

  console.log(`[make-admin] Admin role set for: ${userEmail} (id: ${user.id})`)
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
