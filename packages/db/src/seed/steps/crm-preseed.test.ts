import { describe, it, expect, vi } from 'vitest'
import { crmContactsPreSeedStep } from './crm-contacts.js'

vi.mock('../uuid.js', () => ({
  agencyUuid: vi.fn(() => '00000000-0000-0000-0000-000000000001'),
}))

vi.mock('../../schema/crm.js', () => ({
  crmContacts: { externalId: 'external_id' },
  crmDeals: { externalId: 'external_id' },
  crmActivities: { externalId: 'external_id' },
}))

function makeMockTx() {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    execute: vi.fn().mockResolvedValue(undefined),
  }
}

describe('crmContactsPreSeedStep', () => {
  it('has the correct step name', () => {
    expect(crmContactsPreSeedStep.name).toBe('crm-contacts-preseed')
  })

  it('run completes without throwing for ecommerce slug', async () => {
    const mockTx = makeMockTx()
    await expect(
      crmContactsPreSeedStep.run(mockTx as unknown as Parameters<typeof crmContactsPreSeedStep.run>[0], 'ecommerce')
    ).resolves.not.toThrow()
    expect(mockTx.insert).toHaveBeenCalledTimes(15)
  })

  it('run completes without throwing for finance slug', async () => {
    const mockTx = makeMockTx()
    await expect(
      crmContactsPreSeedStep.run(mockTx as unknown as Parameters<typeof crmContactsPreSeedStep.run>[0], 'finance')
    ).resolves.not.toThrow()
    expect(mockTx.insert).toHaveBeenCalledTimes(15)
  })

  it('run completes without throwing for ai slug (niche-specific data path)', async () => {
    const mockTx = makeMockTx()
    await expect(
      crmContactsPreSeedStep.run(mockTx as unknown as Parameters<typeof crmContactsPreSeedStep.run>[0], 'ai')
    ).resolves.not.toThrow()
    expect(mockTx.insert).toHaveBeenCalledTimes(15)
  })

  it('run completes without throwing for growth slug (fallback path)', async () => {
    const mockTx = makeMockTx()
    await expect(
      crmContactsPreSeedStep.run(mockTx as unknown as Parameters<typeof crmContactsPreSeedStep.run>[0], 'growth')
    ).resolves.not.toThrow()
    expect(mockTx.insert).toHaveBeenCalledTimes(15)
  })
})
