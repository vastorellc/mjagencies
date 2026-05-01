import { describe, it } from 'vitest'

// AUTH-04: RLS prevents cross-user data reads
// Integration test — requires two Supabase test user accounts
// Run manually against a test Supabase project
describe('Row Level Security (AUTH-04)', () => {
  it.todo('User A cannot read posts belonging to User B')
  it.todo('User A can read their own posts')
  it.todo('INSERT with foreign user_id is rejected by RLS')
})
