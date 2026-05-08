import { supabase } from '../lib/supabase'
import type { Screen } from '../lib/types'

interface Props {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
  isAdmin: boolean
}

export default function TopNav({ currentScreen, onNavigate, isAdmin }: Props) {
  const navItems: Array<{ screen: Screen; label: string; adminOnly?: boolean }> = [
    { screen: 'generator', label: 'Generator' },
    { screen: 'research', label: 'Research' },
    { screen: 'learning', label: 'Learning' },
    { screen: 'settings', label: 'Settings' },
    { screen: 'history', label: 'History' },
    { screen: 'admin', label: 'Admin', adminOnly: true },
  ]

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950 px-4 py-3 shadow-sm">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-6">
        <h1 className="text-lg font-bold text-white">Viral Copy</h1>
        <div className="flex flex-wrap items-center gap-2">
          {navItems.map(item => {
            if (item.adminOnly && !isAdmin) return null
            const isActive = currentScreen === item.screen
            return (
              <button
                key={item.screen}
                type="button"
                onClick={() => onNavigate(item.screen)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {item.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
