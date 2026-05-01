// backend/src/lib/storage.ts
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

export const UPLOADS_ROOT = process.env.UPLOADS_PATH ?? '/var/uploads'

export async function initStorage(): Promise<void> {
  await mkdir(UPLOADS_ROOT, { recursive: true })
  console.log(`[storage] uploads directory: ${UPLOADS_ROOT}`)
}

// deleteFile() — implemented in Phase 6 after upload job completes (STORE-03)

// STORE-04: Cleanup job deletes files older than maxAgeMs (default: 1 hour)
// Called by the pg-boss cleanup-stale-files schedule job
export async function cleanupStaleFiles(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  const now = Date.now()
  const root = path.resolve(UPLOADS_ROOT)
  try {
    const userDirs = await readdir(root)
    for (const userDir of userDirs) {
      const userPath = path.resolve(root, userDir)
      if (!userPath.startsWith(root + path.sep)) {
        console.warn(`[storage] suspicious directory entry skipped: ${userDir}`)
        continue
      }
      try {
        const files = await readdir(userPath)
        for (const file of files) {
          const filePath = path.resolve(userPath, file)
          if (!filePath.startsWith(userPath + path.sep)) {
            console.warn(`[storage] suspicious file entry skipped: ${file}`)
            continue
          }
          const stats = await stat(filePath)
          if (now - stats.mtimeMs > maxAgeMs) {
            await unlink(filePath)
            console.log(`[storage] cleaned up stale file: ${filePath}`)
          }
        }
      } catch {
        // Skip directories that cannot be read (permission errors, symlinks)
      }
    }
  } catch {
    // UPLOADS_ROOT may not exist yet — initStorage() handles creation
  }
}
