import { google } from 'googleapis'

// Scopes per research Pattern 2 + ROADMAP Phase 2 + Phase 9 prep:
//   youtube.upload    → required for SETTINGS-04 / AUTOUP-01
//   youtube.readonly  → required for RESEARCH-02 (added now to avoid breaking re-consent later)
export const GOOGLE_YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
] as const

export function getGoogleOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const appUrl = process.env.APP_URL
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL must be set')
  }
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${appUrl}/api/auth/google/callback`,
  )
}

export interface YouTubeTokenSet {
  access_token: string
  refresh_token: string
  expiry: number // ms epoch
}

/**
 * Refresh an existing YouTube access_token using the stored refresh_token.
 * Used by Phase 6 (auto-upload) when access_token is past expiry.
 * Returns the FULL set with new access_token + (possibly rotated) refresh_token.
 */
export async function refreshYouTubeToken(refreshToken: string): Promise<YouTubeTokenSet> {
  const client = getGoogleOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await client.refreshAccessToken()
  if (!credentials.access_token) throw new Error('Google refresh did not return access_token')
  return {
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token ?? refreshToken, // Google may rotate or keep
    expiry: credentials.expiry_date ?? Date.now() + 3600_000,
  }
}
