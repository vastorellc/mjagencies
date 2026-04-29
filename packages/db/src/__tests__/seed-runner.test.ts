/**
 * packages/db/src/__tests__/seed-runner.test.ts
 *
 * Unit tests for the resumable seed framework.
 * All tests are unit-level — no real Postgres DB required.
 *
 * Covers:
 *   1. agencyUuid determinism
 *   2. Skip completed step
 *   3. Run + mark completed for pending step
 *   4. Mark failed + rethrow on error
 *   5. set_config called BEFORE step.run (pitfall 8.5)
 *   6. Resume — second run skips completed, retries failed
 *   7. Empty steps array — no-op
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agencyUuid } from '../seed/uuid.js'
import { runSeed, runSeedAllAgencies } from '../seed/runner.js'
import type { SeedStep } from '../seed/types.js'

// ---------------------------------------------------------------------------
// Minimal AgencyDb mock shape matching Drizzle's chainable API
// ---------------------------------------------------------------------------

function buildMockDb(selectRows: Record<string, { status: string }[]> = {}) {
  // Track calls for assertions
  const calls = {
    insertValues: [] as any[],
    updateSets: [] as any[],
    executeArgs: [] as any[],
    transactionCbs: [] as ((tx: any) => Promise<any>)[],
  }

  // The mock tx passed to db.transaction callback
  const mockTx = {
    execute: vi.fn().mockImplementation((sqlExpr: any) => {
      calls.executeArgs.push(sqlExpr)
      return Promise.resolve({ rows: [] })
    }),
  }

  const mockDb = {
    _calls: calls,
    _mockTx: mockTx,

    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation((n: number) => {
            // Return rows based on the step name tracked separately
            return Promise.resolve([])
          }),
        }),
      }),
    }),

    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: any) => {
        calls.insertValues.push(vals)
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }
      }),
    }),

    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((data: any) => {
        calls.updateSets.push(data)
        return {
          where: vi.fn().mockResolvedValue(undefined),
        }
      }),
    }),

    transaction: vi.fn().mockImplementation((cb: (tx: any) => Promise<any>) => {
      calls.transactionCbs.push(cb)
      return cb(mockTx)
    }),
  }

  return mockDb
}

// ---------------------------------------------------------------------------
// Test 1: agencyUuid is deterministic
// ---------------------------------------------------------------------------

describe('agencyUuid', () => {
  it('returns the same UUID for the same slug (deterministic)', () => {
    const id1 = agencyUuid('ecommerce')
    const id2 = agencyUuid('ecommerce')
    expect(id1).toBe(id2)
  })

  it('matches UUID regex with version 5 marker', () => {
    const id = agencyUuid('ecommerce')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('returns different UUIDs for different slugs', () => {
    expect(agencyUuid('brand')).not.toBe(agencyUuid('ecommerce'))
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a db mock where select().from().where().limit() returns predefined rows per step name. */
function buildMockDbWithStepState(
  stepStates: Record<string, { status: string } | undefined>
) {
  const calls = {
    insertValues: [] as any[],
    updateSets: [] as any[],
    executeArgs: [] as any[],
    transactionCbs: [] as ((tx: any) => Promise<any>)[],
  }

  const mockTx = {
    execute: vi.fn().mockImplementation((sqlExpr: any) => {
      calls.executeArgs.push(sqlExpr)
      return Promise.resolve({ rows: [] })
    }),
  }

  // Track the current step name being queried via a counter approach
  // We use a closure to track which step is being selected
  let selectCallIndex = 0
  const stepNames = Object.keys(stepStates)

  const mockDb = {
    _calls: calls,
    _mockTx: mockTx,

    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((_cond: any) => ({
          limit: vi.fn().mockImplementation((_n: number) => {
            const stepName = stepNames[selectCallIndex++]
            const row = stepName !== undefined ? stepStates[stepName] : undefined
            return Promise.resolve(row ? [row] : [])
          }),
        })),
      }),
    })),

    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: any) => {
        calls.insertValues.push(vals)
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }
      }),
    }),

    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((data: any) => {
        calls.updateSets.push(data)
        return {
          where: vi.fn().mockResolvedValue(undefined),
        }
      }),
    }),

    transaction: vi.fn().mockImplementation((cb: (tx: any) => Promise<any>) => {
      calls.transactionCbs.push(cb)
      return cb(mockTx)
    }),
  }

  return mockDb
}

// ---------------------------------------------------------------------------
// Test 2: Skips completed step
// ---------------------------------------------------------------------------

describe('runSeed — skip completed step', () => {
  it('does not call run if step is already completed', async () => {
    const db = buildMockDbWithStepState({ 'init-data': { status: 'completed' } })
    const stepRun = vi.fn().mockResolvedValue(undefined)
    const step: SeedStep = { name: 'init-data', run: stepRun }

    await runSeed(db as any, 'ecommerce', agencyUuid('ecommerce'), [step])

    expect(stepRun).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 3: Calls run + marks completed for pending step
// ---------------------------------------------------------------------------

describe('runSeed — pending step', () => {
  it('calls insert(running), step.run, then update(completed)', async () => {
    const db = buildMockDbWithStepState({ 'init-data': undefined })
    const stepRun = vi.fn().mockResolvedValue(undefined)
    const step: SeedStep = { name: 'init-data', run: stepRun }
    const slug = 'ecommerce'
    const id = agencyUuid(slug)

    await runSeed(db as any, slug, id, [step])

    // insert with status=running called
    expect(db.insert).toHaveBeenCalled()
    const insertedValues = db._calls.insertValues[0]
    expect(insertedValues).toMatchObject({ status: 'running' })

    // step.run called with (tx, slug)
    expect(stepRun).toHaveBeenCalledWith(db._mockTx, slug)

    // update with status=completed called
    expect(db.update).toHaveBeenCalled()
    const updatedData = db._calls.updateSets.find((s: any) => s.status === 'completed')
    expect(updatedData).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Test 4: Marks failed + rethrows on error
// ---------------------------------------------------------------------------

describe('runSeed — failed step', () => {
  it('marks step failed with errorText and rethrows', async () => {
    const db = buildMockDbWithStepState({ 'init-data': undefined })
    const boom = new Error('boom')
    const stepRun = vi.fn().mockRejectedValue(boom)
    const step: SeedStep = { name: 'init-data', run: stepRun }

    await expect(
      runSeed(db as any, 'ecommerce', agencyUuid('ecommerce'), [step])
    ).rejects.toThrow('boom')

    // update with status=failed and errorText containing 'boom'
    const failedUpdate = db._calls.updateSets.find(
      (s: any) => s.status === 'failed'
    )
    expect(failedUpdate).toBeDefined()
    expect(failedUpdate.errorText).toContain('boom')
  })
})

// ---------------------------------------------------------------------------
// Test 5: set_config called BEFORE step.run (pitfall 8.5)
// ---------------------------------------------------------------------------

describe('runSeed — pitfall 8.5 mitigation', () => {
  it('calls set_config as the FIRST execute inside the transaction', async () => {
    const db = buildMockDbWithStepState({ 'init-data': undefined })
    const stepRun = vi.fn().mockImplementation(async (tx: any) => {
      // step itself calls tx.execute (e.g. an insert query)
      await tx.execute({ sql: 'INSERT INTO something ...' })
    })
    const step: SeedStep = { name: 'init-data', run: stepRun }
    const agencyId = agencyUuid('ecommerce')

    await runSeed(db as any, 'ecommerce', agencyId, [step])

    // First execute call must be the set_config
    const firstExecute = db._calls.executeArgs[0]
    // The sql template literal from drizzle-orm wraps content; check it contains set_config and the agencyId
    expect(JSON.stringify(firstExecute)).toContain('set_config')
    expect(JSON.stringify(firstExecute)).toContain(agencyId)
  })
})

// ---------------------------------------------------------------------------
// Test 6: Resume — second run skips completed, retries failed
// ---------------------------------------------------------------------------

describe('runSeed — resume after failure', () => {
  it('skips completed step1 and retries failed step2 on second run', async () => {
    const step1Run = vi.fn().mockResolvedValue(undefined)
    const step2Run = vi.fn().mockResolvedValue(undefined)

    const step1: SeedStep = { name: 'step1', run: step1Run }
    const step2: SeedStep = { name: 'step2', run: step2Run }

    // Second run: step1 is completed, step2 is failed (ready for retry)
    const db = buildMockDbWithStepState({
      step1: { status: 'completed' },
      step2: { status: 'failed' },
    })

    await runSeed(db as any, 'ecommerce', agencyUuid('ecommerce'), [step1, step2])

    // step1 was already completed — should NOT be called
    expect(step1Run).not.toHaveBeenCalled()

    // step2 was failed — SHOULD be retried
    expect(step2Run).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Test 7: Empty steps array — no-op, no error
// ---------------------------------------------------------------------------

describe('runSeed — empty steps', () => {
  it('resolves without error when steps array is empty', async () => {
    const db = buildMockDbWithStepState({})
    await expect(
      runSeed(db as any, 'ecommerce', agencyUuid('ecommerce'), [])
    ).resolves.toBeUndefined()
    expect(db.select).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 8: Orchestration image gate — runSeedAllAgencies fails loudly when
// the manifest has unpopulated cloudflare_image_id slots (CLAUDE.md §5).
// runSeed itself does NOT call the gate — that is by design so unit tests
// can exercise the state machine without a fully populated manifest.
// ---------------------------------------------------------------------------

describe('runSeedAllAgencies — image gate', () => {
  it('rejects with IMAGE SEED GATE FAILED when manifest images are empty', async () => {
    const db = buildMockDbWithStepState({})
    const slug = 'ecommerce' as const
    await expect(
      runSeedAllAgencies(
        [{ slug, db: db as any, agencyId: agencyUuid(slug) }],
        []
      )
    ).rejects.toThrow(/IMAGE SEED GATE FAILED/)
    expect(db.select).not.toHaveBeenCalled()
  })
})
