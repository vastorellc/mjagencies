import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import GeneratorPage from './pages/GeneratorPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore existing session on mount (handles page refresh — AUTH-03 session persistence)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth state changes across tabs and windows
    // SIGNED_IN → renders GeneratorPage, SIGNED_OUT → renders LoginPage (AUTH-03 logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      },
    )

    // Clean up subscription on unmount
    return () => subscription.unsubscribe()
  }, [])

  // Blank frame during session check (<100ms in practice)
  // No spinner in Phase 1 per UI-SPEC App.tsx Auth Gate section
  if (loading) return null

  // AUTH-02 + UI-06: unauthenticated → login screen only, regardless of URL
  if (!session) return <LoginPage />

  // Authenticated: render app (Phase 2+ adds screen switcher)
  return <GeneratorPage />
}
