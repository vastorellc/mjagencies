import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import GeneratorPage from './pages/GeneratorPage'
import SettingsPage from './pages/SettingsPage'
import HistoryPage from './pages/HistoryPage'
import LearningPage from './pages/LearningPage'
import type { Screen } from './lib/types'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentScreen, setCurrentScreen] = useState<Screen>('generator')
  // Banner state set from OAuth redirect params; cleared on next manual nav
  const [oauthBanner, setOauthBanner] = useState<
    | { kind: 'connected'; platform: 'youtube' | 'instagram' | 'facebook'; warning?: string }
    | { kind: 'error'; reason: string }
    | null
  >(null)

  useEffect(() => {
    // Restore existing session on mount (handles page refresh — AUTH-03 session persistence)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.warn('[auth] getSession error:', error.message)
      setSession(session)
      setLoading(false)
    })

    // Listen for auth state changes across tabs and windows
    // SIGNED_IN → renders app, SIGNED_OUT → renders LoginPage (AUTH-03 logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // Clean up subscription on unmount
    return () => subscription.unsubscribe()
  }, [])

  // OAuth-redirect param handler — must run after auth render so SettingsPage can refetch.
  // Reads ?screen=settings&connected=...|error=...|warning=... and strips the URL.
  useEffect(() => {
    if (!session) return
    const params = new URLSearchParams(window.location.search)
    if (params.size === 0) return

    const screen = params.get('screen')
    const connected = params.get('connected')
    const error = params.get('error')
    const warning = params.get('warning')

    if (screen === 'settings') setCurrentScreen('settings')
    if (connected === 'youtube' || connected === 'instagram' || connected === 'facebook') {
      setOauthBanner({ kind: 'connected', platform: connected, warning: warning ?? undefined })
    } else if (error) {
      setOauthBanner({ kind: 'error', reason: error })
    }

    // Strip params so a refresh does not re-trigger
    window.history.replaceState({}, '', window.location.pathname)
  }, [session])

  // Blank frame during session check (<100ms in practice)
  if (loading) return null

  // AUTH-02 + UI-06: unauthenticated → login screen only, regardless of URL
  if (!session) return <LoginPage />

  if (currentScreen === 'settings') {
    return (
      <SettingsPage
        onNavigate={setCurrentScreen}
        oauthBanner={oauthBanner}
        clearBanner={() => setOauthBanner(null)}
      />
    )
  }

  if (currentScreen === 'history') {
    return <HistoryPage onNavigate={setCurrentScreen} />
  }

  if (currentScreen === 'learning') {
    return <LearningPage onNavigate={setCurrentScreen} />
  }

  return <GeneratorPage onNavigate={setCurrentScreen} />
}
