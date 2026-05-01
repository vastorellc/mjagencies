// Frontend Supabase client — uses VITE_SUPABASE_ANON_KEY (anon/publishable key only)
// NEVER use SUPABASE_SERVICE_ROLE_KEY in frontend code
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
