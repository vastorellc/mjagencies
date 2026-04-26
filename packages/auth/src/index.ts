/**
 * packages/auth/src/index.ts
 *
 * Public API for @mjagency/auth.
 * Each module re-exported on its own line so Plan 03-04 (Cloudflare middleware)
 * can append new exports cleanly without merge conflicts.
 */

export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type AccessTokenClaims,
  type RefreshTokenClaims,
  type VerifiedAccessPayload,
} from './tokens.js'

export {
  setAuthCookies,
  clearAuthCookies,
  readAccessCookie,
  readRefreshCookie,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from './cookie.js'

export {
  UnauthorizedError,
  ForbiddenError,
  MfaRequiredError,
  TokenReplayError,
} from './errors.js'

export { rotateRefreshToken, revokeFamilyTokens, type RotationResult } from './refresh.js'

export { regenerateSession } from './session.js'

export { createAuthRedis } from './redis.js'

// SSO state token helpers (Node-runtime only — not for middleware.ts)
// Stub created in Plan 03-04; Plan 03-03 replaces with HMAC implementation.
export { generateSsoState, verifySsoState, type SsoStateResult } from './sso-state.js'

// Edge-safe helpers — also exported from '@mjagency/auth/middleware' sub-path (lean Edge bundle).
// The sub-path is the preferred import in app middleware.ts files (keeps Node-only modules
// from leaking into the Edge bundle via transitive imports on the '.' export).
export { applySecurityHeaders } from './security-headers.js'
export { extractAgencyFromHost } from './agency-from-host.js'
export { createAuthMiddleware } from './middleware.js'

// MFA — TOTP + recovery codes + lockout (Plan 03-02)
export {
  generateTotpSecret,
  createTotpUri,
  generateQrCodeDataUrl,
  verifyTotp,
} from './mfa.js'

export {
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyRecoveryCode,
  invalidateRecoverySlot,
} from './recovery-codes.js'

export {
  isLockedOut,
  recordFailedAttempt,
  clearLockout,
} from './mfa-lockout.js'
