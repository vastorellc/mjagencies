// backend/src/lib/supabase.ts
// Backend-only Supabase client.
// Uses SUPABASE_SERVICE_ROLE_KEY (sb_secret_xxx for new projects, service_role JWT for old).
// NEVER use this module in frontend code.
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
