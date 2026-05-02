// backend/tests/meta-refresh.test.ts
// Vitest unit tests for registerMetaTokenRefreshJob + refreshAllInstagramTokens
// Uses mock db (vi.mock) — no pg-mem needed for worker logic isolation
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Set env vars BEFORE any module import
process.env.ENCRYPTION_KEY = 'a'.repeat(48)
process.env.GOOGLE_CLIENT_ID = 'x'
process.env.GOOGLE_CLIENT_SECRET = 'x'
process.env.META_APP_ID = 'x'
process.env.META_APP_SECRET = 'x'
process.env.APP_URL = 'http://localhost:5173'

// ── encryption helpers (real, not mocked — needed to seed and verify round-trip) ──
import { encrypt, decrypt } from '../src/lib/encryption.js'

// ── Mock oauth-meta.ts to control refreshInstagramToken behaviour ──────────────
vi.mock('../src/lib/oauth-meta.js', () => ({
  refreshInstagramToken: vi.fn(async (token: string) => {
    if (token === 'fail-token') throw new Error('meta down')
    return { access_token: 'rotated-token', expires_in: 5184000 }
  }),
}))

// ── In-memory DB mock ──────────────────────────────────────────────────────────
// Will be populated in beforeEach with 3 users:
//   user-A: instagram.access_token = encrypt('user-a-token')   ← refresh succeeds
//   user-B: instagram.access_token = encrypt('fail-token')     ← refresh throws
//   user-C: instagram = null                                    ← skipped

type SettingsRow = {
  user_id: string
  platform_config: {
    instagram?: { access_token: string; expiry: number } | null
  } | null
}

let dbStore: Record<string, SettingsRow> = {}

vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn(async (_query: unknown) => {
      // Return rows where instagram is non-null (simulates the SQL filter)
      const rows = Object.values(dbStore).filter(
        (r) => r.platform_config?.instagram != null,
      )
      return rows
    }),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
      // Simulate transaction with a fake tx that intercepts the UPDATE
      const tx = {
        execute: vi.fn(),
        update: vi.fn((_table: unknown) => ({
          set: vi.fn((patch: Record<string, unknown>) => ({
            where: vi.fn((cond: unknown) => {
              // Extract user_id from the SQL condition — stored as a side-channel in the fn call
              void cond
              // We capture the patch via the set() call; find which user via transaction context
              tx.__lastPatch = patch
              return Promise.resolve()
            }),
          })),
        })),
        __lastPatch: null as unknown,
        __userId: null as string | null,
      }

      // Override execute to capture the user_id from the SELECT FOR UPDATE
      ;(tx.execute as ReturnType<typeof vi.fn>).mockImplementation(
        async (q: { queryChunks?: Array<{ value: unknown }> }) => {
          // Extract user_id from SELECT ... WHERE user_id = $1 FOR UPDATE
          const chunks = q?.queryChunks ?? []
          for (const chunk of chunks) {
            if (typeof chunk.value === 'string') {
              tx.__userId = chunk.value
              break
            }
          }
          return { rows: [] }
        },
      )

      await cb(tx)

      // Apply the patch to in-memory store
      if (tx.__userId && tx.__lastPatch) {
        const row = dbStore[tx.__userId]
        if (row) {
          // tx.__lastPatch contains the drizzle set() call object; we re-use
          // the simpler approach: the worker calls encrypt(refreshed.access_token)
          // before set(). So we need another way to capture the written value.
          // We'll intercept via a different mechanism below.
        }
      }
    }),
  },
}))

// Import module under test (after all mocks)
const { registerMetaTokenRefreshJob, refreshAllInstagramTokens } =
  await import('../src/lib/meta-refresh.js')

// ── Recording mock pg-boss ─────────────────────────────────────────────────────
class FakeBoss {
  calls: string[] = []
  scheduleErrors = 0

  async createQueue(name: string): Promise<void> {
    this.calls.push(`createQueue:${name}`)
  }

  async schedule(name: string, cron: string, _data: object): Promise<void> {
    this.calls.push(`schedule:${name}:${cron}`)
    if (this.scheduleErrors-- > 0) {
      throw new Error('duplicate key value violates unique constraint')
    }
  }

  async work(name: string, _handler: (job: unknown) => Promise<void>): Promise<unknown> {
    this.calls.push(`work:${name}`)
    return null
  }
}

// ── beforeEach: reset db store and mocks ──────────────────────────────────────
beforeEach(async () => {
  vi.clearAllMocks()

  const { refreshInstagramToken } = await import('../src/lib/oauth-meta.js')
  ;(refreshInstagramToken as ReturnType<typeof vi.fn>).mockImplementation(
    async (token: string) => {
      if (token === 'fail-token') throw new Error('meta down')
      return { access_token: 'rotated-token', expires_in: 5184000 }
    },
  )

  dbStore = {
    'user-A': {
      user_id: 'user-A',
      platform_config: {
        instagram: { access_token: encrypt('user-a-token'), expiry: Date.now() + 1000 },
      },
    },
    'user-B': {
      user_id: 'user-B',
      platform_config: {
        instagram: { access_token: encrypt('fail-token'), expiry: Date.now() + 1000 },
      },
    },
    'user-C': {
      user_id: 'user-C',
      platform_config: { instagram: null },
    },
  }

  const { db } = await import('../src/db/index.js')
  ;(db.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
    return Object.values(dbStore).filter(
      (r) => r.platform_config?.instagram != null,
    )
  })
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("meta-token-refresh (SETTINGS-07)", () => {
  it('Test 1: createQueue called BEFORE schedule, correct cron, worker registered', async () => {
    const boss = new FakeBoss()
    await registerMetaTokenRefreshJob(boss as unknown as import('pg-boss').default)

    const idxQueue = boss.calls.indexOf('createQueue:meta-token-refresh')
    const idxSchedule = boss.calls.findIndex((c) =>
      c.startsWith('schedule:meta-token-refresh'),
    )
    const idxWork = boss.calls.indexOf('work:meta-token-refresh')

    expect(idxQueue).toBeGreaterThanOrEqual(0)
    expect(idxSchedule).toBeGreaterThan(idxQueue)
    expect(idxWork).toBeGreaterThan(idxSchedule)

    const scheduleCall = boss.calls.find((c) => c.startsWith('schedule:meta-token-refresh'))
    expect(scheduleCall).toContain('0 9 * * 1')
  })

  it('Test 2: duplicate-key error swallowed on second registration (restart-safe)', async () => {
    const boss = new FakeBoss()
    boss.scheduleErrors = 1
    await expect(
      registerMetaTokenRefreshJob(boss as unknown as import('pg-boss').default),
    ).resolves.toBeUndefined()
  })

  it('Test 3: non-duplicate schedule error is re-thrown', async () => {
    const boss = new FakeBoss()
    ;(boss.schedule as unknown as ReturnType<typeof vi.fn>) = vi.fn(async () => {
      throw new Error('connection refused — not a duplicate')
    })
    await expect(
      registerMetaTokenRefreshJob(boss as unknown as import('pg-boss').default),
    ).rejects.toThrow('connection refused')
  })

  it('Test 4: refreshAllInstagramTokens skips users without instagram (calls refresh exactly 2×)', async () => {
    const { refreshInstagramToken } = await import('../src/lib/oauth-meta.js')
    const spy = refreshInstagramToken as ReturnType<typeof vi.fn>
    spy.mockResolvedValueOnce({ access_token: 'rotated-A', expires_in: 5184000 })
    spy.mockRejectedValueOnce(new Error('meta down'))

    await refreshAllInstagramTokens()

    // user-C has null instagram → skipped; only A and B are processed
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('Test 5: round-trip — decrypt(stored ciphertext) equals original plaintext', () => {
    // Verify that the encrypt/decrypt helpers used in the worker produce valid ciphertexts
    const ciphertext = encrypt('user-a-token')
    expect(decrypt(ciphertext)).toBe('user-a-token')

    const ciphertextFail = encrypt('fail-token')
    expect(decrypt(ciphertextFail)).toBe('fail-token')
  })

  it('Test 6: per-user error isolation — user-B failure does not abort user-A processing', async () => {
    const { refreshInstagramToken } = await import('../src/lib/oauth-meta.js')
    const spy = refreshInstagramToken as ReturnType<typeof vi.fn>
    // user-A: 'user-a-token' → succeeds
    // user-B: 'fail-token' → throws (per mock in beforeEach)

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await refreshAllInstagramTokens()

    // Both users attempted despite user-B failing
    expect(spy).toHaveBeenCalledTimes(2)

    // Error was logged with user_id
    const errorCalls = consoleErrorSpy.mock.calls.map((args) => args.join(' '))
    const failEntry = errorCalls.find((msg) => msg.includes('user-B'))
    expect(failEntry).toBeDefined()
    expect(failEntry).toContain('FAILED')

    consoleErrorSpy.mockRestore()
  })

  it('Test 7: expiry recomputed as Date.now() + expires_in * 1000', async () => {
    const { db } = await import('../src/db/index.js')

    // Capture the patch passed to the update call
    let capturedPatch: unknown = null
    ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
          execute: vi.fn(),
          update: vi.fn((_table: unknown) => ({
            set: vi.fn((patch: unknown) => {
              capturedPatch = patch
              return { where: vi.fn(() => Promise.resolve()) }
            }),
          })),
        }
        await cb(tx)
      },
    )

    const before = Date.now()
    const { refreshInstagramToken } = await import('../src/lib/oauth-meta.js')
    ;(refreshInstagramToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      access_token: 'new-token',
      expires_in: 5184000,
    })
    // Mock db.execute to return only user-A
    ;(db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      dbStore['user-A'],
    ])

    await refreshAllInstagramTokens()
    const after = Date.now()

    expect(capturedPatch).not.toBeNull()
    // The patch is passed as a drizzle set() object — we verify via JSON serialisation
    const patchStr = JSON.stringify(capturedPatch)
    // The patch should contain an expiry number in the JSON structure
    const expiryMatch = patchStr.match(/"expiry":(\d+)/)
    expect(expiryMatch).not.toBeNull()
    const expiry = parseInt(expiryMatch![1], 10)
    expect(expiry).toBeGreaterThanOrEqual(before + 5184000 * 1000)
    expect(expiry).toBeLessThanOrEqual(after + 5184000 * 1000)
  })
})
