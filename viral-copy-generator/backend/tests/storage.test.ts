import { describe, it, expect } from 'vitest'
import { mkdtemp, rmdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// STORE-01: initStorage() creates the uploads directory
describe('Storage init (STORE-01)', () => {
  it('initStorage creates UPLOADS_PATH directory if it does not exist', async () => {
    const tmpBase = await mkdtemp(path.join(os.tmpdir(), 'vcg-test-'))
    const testDir = path.join(tmpBase, 'uploads')
    process.env.UPLOADS_PATH = testDir

    const { initStorage } = await import('../src/lib/storage.js')
    await initStorage()

    const { existsSync } = await import('node:fs')
    expect(existsSync(testDir)).toBe(true)

    await rmdir(testDir)
    await rmdir(tmpBase)
    delete process.env.UPLOADS_PATH
  })
})
