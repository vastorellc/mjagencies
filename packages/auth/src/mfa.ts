/**
 * packages/auth/src/mfa.ts
 *
 * TOTP MFA module — RFC 6238 compliant.
 * REQ-025: TOTP via otpauth@9.5.1, SHA1/6 digits/30s period/window=±1.
 *
 * TOTP secrets are stored ENCRYPTED via Phase 2 vault helper:
 *   putVaultValue(db, agencyId, `mfa.totp_secret.${userId}`, secret)
 *   getVaultValue(db, agencyId, `mfa.totp_secret.${userId}`)
 *
 * This module is Node-only (QR code generation requires Node crypto).
 * The verifyTotp function can be called from server actions only.
 */

import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'

/**
 * Generate a cryptographically secure TOTP secret.
 * Returns a base32 string (160-bit / 20-byte) — the format authenticator apps expect.
 *
 * REQ-025, RFC 6238: 160-bit secret is the minimum for RFC 4226 compliance.
 * OTPAuth.Secret uses crypto.getRandomValues — works in Edge + Node runtimes.
 */
export function generateTotpSecret(): string {
  // 160-bit (20-byte) cryptographically secure random secret
  // OTPAuth.Secret uses crypto.getRandomValues — works in Edge + Node
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32 // base32 string — what authenticator apps consume
}

/**
 * Create a TOTP URI in the otpauth:// format for scanning with authenticator apps.
 * Default issuer is 'MJAgency'; override via MFA_ISSUER_NAME env var in production.
 *
 * REQ-025, RFC 6238 defaults: SHA1, 6 digits, 30s period.
 */
export function createTotpUri(
  secret: string,
  userEmail: string,
  issuer: string = 'MJAgency',
): string {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: userEmail,
    algorithm: 'SHA1', // RFC 6238 standard; required for compatibility with Google Authenticator etc.
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
  return totp.toString() // otpauth://totp/MJAgency:user@example.com?secret=...&issuer=MJAgency
}

/**
 * Generate a QR code data URL from a TOTP URI.
 * Returns a PNG data URL (data:image/png;base64,...) suitable for display in an <img> tag.
 * Error correction level M provides a balance of data density and scan resilience.
 */
export async function generateQrCodeDataUrl(totpUri: string): Promise<string> {
  return QRCode.toDataURL(totpUri, { errorCorrectionLevel: 'M' })
}

/**
 * Verify a TOTP token against a stored base32 secret.
 * window: 1 accepts ±1 step (30s before / 30s after) — standard clock-skew tolerance.
 * Returns null on invalid; 0 / ±1 on valid — we return boolean for caller simplicity.
 *
 * REQ-025: on success, the verify endpoint calls Plan 03-01's regenerateSession
 * with mfaVerifiedAt set to the current timestamp.
 */
export function verifyTotp(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
  // window: 1 = accept ±1 step (30s before / 30s after) — standard clock-skew tolerance
  // Returns null on invalid; 0 / ±1 on valid
  const delta = totp.validate({ token, window: 1 })
  return delta !== null
}
