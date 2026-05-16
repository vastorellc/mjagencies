import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import AdminPage from './AdminPage'
import type { AdminProviderHealth } from '../lib/types'

// Mock supabase — AdminPage API calls use supabase.auth.getSession inside apiFetch
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut:           vi.fn().mockResolvedValue({ error: null }),
      getSession:        vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

// Mock all api.ts exports; we only care about fetchAdminProviderHealth for this test suite
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api') as Record<string, unknown>
  return {
    ...actual,
    fetchAdminJobs:          vi.fn().mockResolvedValue([]),
    fetchAdminUsers:         vi.fn().mockResolvedValue([]),
    fetchAdminHealth:        vi.fn().mockResolvedValue({ cpu: { count: 4 }, memory: { total_mb: 8192, free_mb: 4096, used_mb: 4096, use_pct: 50 }, disk: { size: '100G', used: '30G', avail: '70G', usePct: '30%' }, database: { size: '10MB' }, queue: { pending_jobs: 0 }, apis: {}, timestamp: '2026-05-16T00:00:00Z' }),
    fetchAdminLogs:          vi.fn().mockResolvedValue({ lines: [], meta: { total_lines: 0, filtered_lines: 0, returned: 0 } }),
    fetchAdminPlatformStats: vi.fn().mockResolvedValue({ platform_stats: [], totals: { uploads: 0, succeeded: 0, overall_success_rate: 0 } }),
    fetchAdminProviderHealth: vi.fn(),
  }
})

// Import AFTER the mock is set up
import { fetchAdminProviderHealth } from '../lib/api'

const FIXTURE: AdminProviderHealth[] = [
  {
    provider: 'openai',
    model_id: 'gpt-5.5',
    displayName: 'GPT-5.5',
    tier: 'flagship',
    capabilities: {
      text: true, vision: true, audio: false, video: false,
      maxInputTokens: 1_050_000, maxOutputTokens: 128_000,
      supportsJsonMode: true, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 5,
    pricePerMOutput: 30,
    retiresAt: null,
    latestStatus: 'ok',
    latestErrorMessage: null,
    latestCheckedAt: '2026-05-15T07:00:00Z',
    latencyP95Last7dMs: 245,
  },
  {
    provider: 'deepseek',
    model_id: 'deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash',
    tier: 'fast',
    capabilities: {
      text: true, vision: false, audio: false, video: false,
      maxInputTokens: 1_000_000, maxOutputTokens: 32_768,
      supportsJsonMode: true, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 0.14,
    pricePerMOutput: 0.28,
    retiresAt: null,
    latestStatus: 'model_not_found',
    latestErrorMessage: 'Model not found in DeepSeek registry',
    latestCheckedAt: '2026-05-15T07:00:00Z',
    latencyP95Last7dMs: null,
  },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminPage Providers tab (VERIFY-06)', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminProviderHealth).mockResolvedValue(FIXTURE)
  })

  test('clicking Providers tab triggers fetch and renders rows', async () => {
    render(<AdminPage onNavigate={vi.fn()} />)
    const tab = screen.getByRole('button', { name: /providers/i })
    fireEvent.click(tab)
    await waitFor(() => expect(fetchAdminProviderHealth).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('GPT-5.5')).toBeInTheDocument())
    expect(screen.getByText('DeepSeek V4 Flash')).toBeInTheDocument()
  })

  test('model_not_found row shows red-styled status badge', async () => {
    render(<AdminPage onNavigate={vi.fn()} />)
    const tab = screen.getByRole('button', { name: /providers/i })
    fireEvent.click(tab)
    await waitFor(() => {
      const badge = screen.getByTestId('status-deepseek-v4-flash')
      expect(badge.textContent).toBe('model_not_found')
      expect(badge.className).toMatch(/text-red/)
    })
  })

  test('OK status row shows emerald-styled badge', async () => {
    render(<AdminPage onNavigate={vi.fn()} />)
    const tab = screen.getByRole('button', { name: /providers/i })
    fireEvent.click(tab)
    await waitFor(() => {
      const badge = screen.getByTestId('status-gpt-5.5')
      expect(badge.textContent).toBe('ok')
      expect(badge.className).toMatch(/text-emerald/)
    })
  })

  test('capability chips render only for true-valued capabilities', async () => {
    render(<AdminPage onNavigate={vi.fn()} />)
    const tab = screen.getByRole('button', { name: /providers/i })
    fireEvent.click(tab)
    await waitFor(() => {
      const gptRow = screen.getByTestId('provider-row-gpt-5.5')
      expect(gptRow.textContent).toMatch(/Text/)
      expect(gptRow.textContent).toMatch(/Vision/)
      expect(gptRow.textContent).not.toMatch(/Audio/)
      expect(gptRow.textContent).not.toMatch(/Video/)
    })
  })

  test('Refresh button triggers re-fetch', async () => {
    render(<AdminPage onNavigate={vi.fn()} />)
    const tab = screen.getByRole('button', { name: /providers/i })
    fireEvent.click(tab)
    await waitFor(() => expect(fetchAdminProviderHealth).toHaveBeenCalledTimes(1))
    const refreshBtn = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(refreshBtn)
    await waitFor(() => expect(fetchAdminProviderHealth).toHaveBeenCalledTimes(2))
  })

  test('shows error banner when fetch fails', async () => {
    vi.mocked(fetchAdminProviderHealth).mockRejectedValueOnce(new Error('boom'))
    render(<AdminPage onNavigate={vi.fn()} />)
    const tab = screen.getByRole('button', { name: /providers/i })
    fireEvent.click(tab)
    await waitFor(() => {
      expect(screen.getByText(/Failed to load provider health/i)).toBeInTheDocument()
    })
  })

  test('data-testid attributes are present on card and badge', async () => {
    render(<AdminPage onNavigate={vi.fn()} />)
    const tab = screen.getByRole('button', { name: /providers/i })
    fireEvent.click(tab)
    await waitFor(() => {
      expect(screen.getByTestId('provider-row-gpt-5.5')).toBeInTheDocument()
      expect(screen.getByTestId('provider-row-deepseek-v4-flash')).toBeInTheDocument()
      expect(screen.getByTestId('status-gpt-5.5')).toBeInTheDocument()
      expect(screen.getByTestId('status-deepseek-v4-flash')).toBeInTheDocument()
    })
  })
})
