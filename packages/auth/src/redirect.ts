/**
 * packages/auth/src/redirect.ts
 *
 * Open-redirect prevention helper — canonical same-origin URL gate.
 *
 * Requirements: REQ-308, REQ-424, SEC-N5
 * Threat mitigated: T-03-021 (tampering via crafted returnTo parameter)
 *
 * Accepts: /dashboard, /agency/ecommerce/posts?x=1#hash (relative paths)
 * Rejects: https://evil.com, //evil.com, javascript:alert(1), data:text/html,...
 *          vbscript:msgbox(1), file:///etc/passwd, malformed URLs
 *
 * Defense-in-depth layers:
 *   1. Empty/null check → fallback
 *   2. Protocol-relative rejection (starts with //) → fallback
 *   3. Dangerous scheme regex early rejection (faster than URL constructor)
 *   4. URL constructor resolution + origin comparison → fallback on mismatch or throw
 *
 * Plan 03-03's login route migrates from the inline validateReturnToInline() helper
 * to this canonical implementation (Plan 03-06 cross-plan touch).
 */

/**
 * Validates that a returnTo redirect target is same-origin.
 *
 * @param returnTo - The candidate redirect target from user input (query/body param).
 * @param origin   - The expected origin (e.g. 'https://accounts.brand.com').
 *                   Pass `new URL(req.url).origin` from the login route handler.
 * @returns The safe returnTo path (pathname + search + hash) on same-origin, or '/dashboard'.
 */
export function validateReturnTo(returnTo: string | null | undefined, origin: string): string {
  if (!returnTo) return '/dashboard'
  // Defense-in-depth: reject protocol-relative URLs explicitly.
  // The URL constructor would handle them, but rejecting here is cheaper and clearer.
  if (returnTo.startsWith('//')) return '/dashboard'
  // Reject suspicious schemes early — cheaper than URL constructor and clearer intent.
  if (/^(javascript|data|vbscript|file):/i.test(returnTo)) return '/dashboard'
  try {
    const resolved = new URL(returnTo, origin)
    if (resolved.origin !== origin) return '/dashboard'
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return '/dashboard'
  }
}
