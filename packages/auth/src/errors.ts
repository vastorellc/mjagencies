/**
 * packages/auth/src/errors.ts
 *
 * Auth-layer typed error classes.
 * Downstream handlers (route handlers, server actions, middleware) catch these
 * to return the appropriate HTTP status (401/403/MFA redirect).
 */

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') { super(message); this.name = 'UnauthorizedError' }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') { super(message); this.name = 'ForbiddenError' }
}

export class MfaRequiredError extends Error {
  constructor(message = 'MFA required') { super(message); this.name = 'MfaRequiredError' }
}

export class TokenReplayError extends Error {
  constructor(message = 'Token replay detected — family revoked') {
    super(message); this.name = 'TokenReplayError'
  }
}
