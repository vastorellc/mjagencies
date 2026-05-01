import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

// UPLOADS_ROOT: set via UPLOADS_PATH env var; defaults to /var/uploads for production
// STORE-01: directory is created on startup via initStorage()
function getUploadsRoot(): string {
  return process.env.UPLOADS_PATH ?? '/var/uploads'
}

export async function initStorage(): Promise<void> {
  const uploadsRoot = getUploadsRoot()
  await mkdir(uploadsRoot, { recursive: true })
  console.log(`[storage] uploads directory: ${uploadsRoot}`)
}

// STORE-04: Cleanup job deletes files older than maxAgeMs (default: 1 hour)
// Called by the pg-boss cleanup-stale-files schedule job
export async function cleanupStaleFiles(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  const uploadsRoot = getUploadsRoot()
  const now = Date.now()
  const userDirs = await readdir(uploadsRoot)
  for (const userDir of userDirs) {
    const userPath = path.join(uploadsRoot, userDir)
    const files = await readdir(userPath)
    for (const file of files) {
      const filePath = path.join(userPath, file)
      const stats = await stat(filePath)
      if (now - stats.mtimeMs > maxAgeMs) {
        await unlink(filePath)
      }
    }
  }
}
