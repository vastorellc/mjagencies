import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import GeneratorPage from './pages/GeneratorPage'
import SettingsPage from './pages/SettingsPage'
import HistoryPage from './pages/HistoryPage'
import LearningPage from './pages/LearningPage'
import AdminPage from './pages/AdminPage'
import ResearchPage from './pages/ResearchPage'
import type { Screen } from './lib/types'
import { ErrorBoundary } from './components/ErrorBoundary'
import TopNav from './components/TopNav'

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

  // ADMIN-01: Derive admin status from Supabase app_metadata (set by service role — not forgeable by client)
  const isAdmin = session.user.app_metadata?.['role'] === 'admin'

  let pageContent: React.ReactNode = null

  if (currentScreen === 'admin') {
    // ADMIN-01: Double-check isAdmin before rendering — prevents accidental render if state drifts
    if (!isAdmin) {
      pageContent = <GeneratorPage onNavigate={setCurrentScreen} />
    } else {
      pageContent = (
        <ErrorBoundary screenName="admin">
          <AdminPage onNavigate={setCurrentScreen} />
        </ErrorBoundary>
      )
    }
  } else if (currentScreen === 'settings') {
    pageContent = (
      <SettingsPage
        onNavigate={setCurrentScreen}
        oauthBanner={oauthBanner}
        clearBanner={() => setOauthBanner(null)}
      />
    )
  } else if (currentScreen === 'history') {
    pageContent = <HistoryPage onNavigate={setCurrentScreen} />
  } else if (currentScreen === 'learning') {
    pageContent = <LearningPage onNavigate={setCurrentScreen} />
  } else if (currentScreen === 'research') {
    pageContent = (
      <ErrorBoundary screenName="research">
        <ResearchPage onNavigate={setCurrentScreen} />
      </ErrorBoundary>
    )
  } else {
    // Generator (default)
    pageContent = (
      <ErrorBoundary screenName="generator">
        <GeneratorPage onNavigate={setCurrentScreen} />
      </ErrorBoundary>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
      <TopNav currentScreen={currentScreen} onNavigate={setCurrentScreen} isAdmin={isAdmin} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 py-6">
          {pageContent}
        </div>
      </div>
    </div>
  )
}
