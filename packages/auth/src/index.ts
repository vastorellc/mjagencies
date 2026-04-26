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
// Plan 03-03: real HMAC-SHA256 + timingSafeEqual implementation (replaces 03-04 stub).
export {
  generateSsoState,
  verifySsoState,
  type SsoStateVerifyResult,
} from './sso-state.js'

// SSO opaque-code store — cross-agency platform namespace accounts:sso:code:* (Plan 03-03, Q2).
export {
  createSsoCode,
  redeemSsoCode,
  type SsoCodePayload,
} from './sso-code.js'

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

// Server-action session helper — Node-runtime only (uses next/headers + next/navigation).
// NOT re-exported from '@mjagency/auth/middleware' to keep the Edge bundle lean.
// MUST be the FIRST call in every server action (CLAUDE.md §3, REQ-031, REQ-301).
export { requireSession, type RequireSessionOpts } from './require-session.js'

// Open-redirect prevention (Plan 03-06) — canonical same-origin URL gate.
// REQ-308, REQ-424, SEC-N5. Plan 03-03's login route migrates to this helper.
export { validateReturnTo } from './redirect.js'

// Agency-owner self-delete guard (Plan 03-06) — server-action layer (REQ-028, REQ-400).
// Backed by DB trigger 006_prevent_last_admin_delete.sql (defense-in-depth).
export { assertNotAgencyOwner } from './guards.js'

// Audit emit helpers (Plan 03-06):
//   setAppActor    — SET LOCAL app.actor_id for Phase 2 capture_audit_row() (REQ-027, T-03-023)
//   emitAuthAudit  — Pino observability (NOT the compliance audit log; complements DB hash chain)
//   AuthEventName  — locked union of auth event name strings
export { setAppActor, emitAuthAudit, type AuthEventName } from './audit-emit.js'
