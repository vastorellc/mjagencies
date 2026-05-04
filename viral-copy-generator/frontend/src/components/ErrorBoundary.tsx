import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  screenName?: string
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // DEV-only — stack traces never logged in production (T-10-04 mitigation)
    if (import.meta.env.DEV) {
      console.error(
        `[ErrorBoundary:${this.props.screenName ?? 'unknown'}]`,
        error,
        info.componentStack,
      )
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-white">
          <p className="max-w-xs text-center text-sm text-zinc-400">
            Something went wrong on this screen. Reload to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
