import { randomBytes } from 'node:crypto'

interface OAuthStateEntry {
  userId: string
  expires: number // ms epoch
}

const TTL_MS = 10 * 60_000 // 10 minutes

// Single-process in-memory store. Acceptable for single-process VPS (research A1).
// On server restart the map is wiped — user simply retries OAuth.
const stateMap = new Map<string, OAuthStateEntry>()

export function createOAuthState(userId: string): string {
  const token = randomBytes(32).toString('hex') // 64 hex chars
  stateMap.set(token, { userId, expires: Date.now() + TTL_MS })
  return token
}

/**
 * Returns the userId associated with the state token, or null if the token
 * is unknown / expired. ALWAYS deletes the token before returning (single-use,
 * prevents replay).
 */
export function consumeOAuthState(token: string): string | null {
  const entry = stateMap.get(token)
  stateMap.delete(token) // single-use BEFORE validating expiry
  if (!entry) return null
  if (Date.now() > entry.expires) return null
  return entry.userId
}

// Test-only export (DO NOT use in production code paths)
export const __test__ = {
  setEntry(token: string, entry: OAuthStateEntry) { stateMap.set(token, entry) },
  size() { return stateMap.size },
  clear() { stateMap.clear() },
}
