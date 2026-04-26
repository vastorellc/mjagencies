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
