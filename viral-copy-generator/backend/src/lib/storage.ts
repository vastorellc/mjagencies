// backend/src/lib/storage.ts
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

export const UPLOADS_ROOT = process.env.UPLOADS_PATH ?? '/var/uploads'

export async function initStorage(): Promise<void> {
  try {
    await mkdir(UPLOADS_ROOT, { recursive: true })
    console.log(`[storage] uploads directory: ${UPLOADS_ROOT}`)
  } catch (err) {
    // Non-fatal on dev machines — uploads will fail at request time until directory is accessible
    console.warn(`[storage] WARNING: could not create uploads directory at ${UPLOADS_ROOT}:`, (err as Error).message)
    console.warn('[storage] Set UPLOADS_PATH in .env to a writable path (e.g. UPLOADS_PATH=./uploads)')
  }
}

/**
 * STORE-03: Delete a single file after successful social upload.
 * Path-traversal guard: resolved path must be inside UPLOADS_ROOT.
 */
export async function deleteFile(filePath: string): Promise<void> {
  const root = path.resolve(UPLOADS_ROOT)
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`deleteFile: path traversal rejected: ${filePath}`)
  }
  await unlink(resolved)
  console.log(`[storage] deleted: ${resolved}`)
}

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
