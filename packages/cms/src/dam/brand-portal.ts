/**
 * packages/cms/src/dam/brand-portal.ts
 *
 * Brand portal: signed URL generation for external partner access (REQ-062).
 * External partners get a signed JWT in the URL that grants read-only access
 * to agency-scoped assets for 7 days.
 *
 * Security (CLAUDE.md §2 — jose only):
 *   - Signed with HS256 using BRAND_PORTAL_SECRET env var
 *   - Claims: { assetId, agencyId, purpose: 'brand-portal', role: 'external' }
 *   - Server action that calls this MUST call requireSession() first (CLAUDE.md §3)
 *   - Signed URLs are agency-scoped — never cross-agency (T-05-05-03 mitigation)
 *   - 7-day expiry (REQ-062)
 *
 * NEVER use jsonwebtoken — Edge runtime incompatible (CLAUDE.md §2).
 */
import { SignJWT } from 'jose'

export interface BrandPortalTokenClaims {
  assetId: string
  agencyId: string
  purpose: 'brand-portal'
  role: 'external'
}

/**
 * Generates a signed brand portal URL for a specific asset.
 * The URL embeds a JWT token that the brand portal API route validates.
 *
 * @param assetId - media_assets document ID
 * @param agencyId - Agency UUID (ensures cross-agency isolation — T-05-05-03)
 * @param baseUrl - Base URL of the admin app e.g. 'https://brand.com'
 * @returns Signed URL with embedded JWT, valid for 7 days
 */
export async function generateBrandPortalUrl(
  assetId: string,
  agencyId: string,
  baseUrl: string
): Promise<string> {
  const secret = process.env['BRAND_PORTAL_SECRET']
  if (!secret) throw new Error('BRAND_PORTAL_SECRET env var is not set')

  const secretKey = new TextEncoder().encode(secret)
  const token = await new SignJWT({
    assetId,
    agencyId,
    purpose: 'brand-portal',
    role: 'external',
  } satisfies BrandPortalTokenClaims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer('mjagency')
    .setAudience('mjagency-brand-portal')
    .sign(secretKey)

  return `${baseUrl}/api/brand-portal/asset?token=${encodeURIComponent(token)}`
}
