// Meta OAuth helpers — Instagram Login + Facebook Login for Business
// Two separate flows on the same Meta app (research Pitfall 9).
// All HTTP calls use global fetch (Node 24 built-in).

export const INSTAGRAM_SCOPES = 'instagram_business_basic,instagram_business_content_publish' as const
export const FACEBOOK_SCOPES = 'pages_show_list,pages_manage_posts,pages_read_engagement' as const

const INSTAGRAM_AUTH = 'https://api.instagram.com/oauth/authorize'
const INSTAGRAM_TOKEN = 'https://api.instagram.com/oauth/access_token'
const INSTAGRAM_GRAPH = 'https://graph.instagram.com'
const FACEBOOK_AUTH = 'https://www.facebook.com/v22.0/dialog/oauth'
const FACEBOOK_GRAPH = 'https://graph.facebook.com/v22.0'

function requireEnv(): { appId: string; appSecret: string; appUrl: string } {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  const appUrl = process.env.APP_URL
  if (!appId || !appSecret || !appUrl) throw new Error('META_APP_ID, META_APP_SECRET, APP_URL must be set')
  return { appId, appSecret, appUrl }
}

// ── URL builders ────────────────────────────────────────────────────────────

export function buildInstagramAuthUrl(state: string): string {
  const { appId, appUrl } = requireEnv()
  const url = new URL(INSTAGRAM_AUTH)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', `${appUrl}/api/auth/instagram/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_SCOPES)
  url.searchParams.set('state', state)
  return url.toString()
}

export function buildFacebookAuthUrl(state: string): string {
  const { appId, appUrl } = requireEnv()
  const url = new URL(FACEBOOK_AUTH)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', `${appUrl}/api/auth/facebook/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', FACEBOOK_SCOPES)
  url.searchParams.set('state', state)
  return url.toString()
}

// ── Instagram token exchange (3 steps) ──────────────────────────────────────

export interface InstagramConnection {
  longLivedToken: string
  expiresIn: number      // seconds (~5184000 for 60 days)
  accountType: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL'
  username: string
}

export async function exchangeInstagramCode(rawCode: string): Promise<InstagramConnection> {
  const { appId, appSecret, appUrl } = requireEnv()
  // Pitfall 1: strip trailing '#_' that Meta appends to the redirect URI code
  const code = rawCode.replace(/#_$/, '')

  // Step A: short-lived token (1h)
  const shortRes = await fetch(INSTAGRAM_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: `${appUrl}/api/auth/instagram/callback`,
      code,
    }).toString(),
  })
  if (!shortRes.ok) throw new Error(`instagram short-lived exchange failed: ${shortRes.status}`)
  const shortJson = await shortRes.json() as { access_token: string }
  if (!shortJson.access_token) throw new Error('instagram short-lived: no access_token')

  // Step B: long-lived (60 days)
  const longUrl = new URL(`${INSTAGRAM_GRAPH}/access_token`)
  longUrl.searchParams.set('grant_type', 'ig_exchange_token')
  longUrl.searchParams.set('client_secret', appSecret)
  longUrl.searchParams.set('access_token', shortJson.access_token)
  const longRes = await fetch(longUrl)
  if (!longRes.ok) throw new Error(`instagram long-lived exchange failed: ${longRes.status}`)
  const longJson = await longRes.json() as { access_token: string; expires_in: number }
  if (!longJson.access_token) throw new Error('instagram long-lived: no access_token')

  // Step C: account_type preflight (Pitfall 4)
  const profileUrl = new URL(`${INSTAGRAM_GRAPH}/me`)
  profileUrl.searchParams.set('fields', 'account_type,username')
  profileUrl.searchParams.set('access_token', longJson.access_token)
  const profileRes = await fetch(profileUrl)
  if (!profileRes.ok) throw new Error(`instagram /me failed: ${profileRes.status}`)
  const profile = await profileRes.json() as { account_type: string; username: string }

  return {
    longLivedToken: longJson.access_token,
    expiresIn: longJson.expires_in,
    accountType: profile.account_type as InstagramConnection['accountType'],
    username: profile.username,
  }
}

/** Used by Plan 02-05 weekly refresh job. */
export async function refreshInstagramToken(currentLongLived: string): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL(`${INSTAGRAM_GRAPH}/refresh_access_token`)
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', currentLongLived)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`instagram refresh failed: ${res.status}`)
  return await res.json() as { access_token: string; expires_in: number }
}

// ── Facebook token exchange + page selection ────────────────────────────────

export interface FacebookPage {
  id: string
  name: string
  access_token: string  // page_access_token
  tasks?: string[]
}

export interface FacebookConnection {
  page: FacebookPage | null  // null when user has no qualifying Page (setup_required)
}

export async function exchangeFacebookCode(code: string): Promise<FacebookConnection> {
  const { appId, appSecret, appUrl } = requireEnv()

  // Step A: exchange code for user access token
  const tokenUrl = new URL(`${FACEBOOK_GRAPH}/oauth/access_token`)
  tokenUrl.searchParams.set('client_id', appId)
  tokenUrl.searchParams.set('client_secret', appSecret)
  tokenUrl.searchParams.set('redirect_uri', `${appUrl}/api/auth/facebook/callback`)
  tokenUrl.searchParams.set('code', code)
  const tokenRes = await fetch(tokenUrl)
  if (!tokenRes.ok) throw new Error(`facebook token exchange failed: ${tokenRes.status}`)
  const tokenJson = await tokenRes.json() as { access_token: string }
  if (!tokenJson.access_token) throw new Error('facebook token exchange: no access_token')

  // Step B: GET /me/accounts -> page list with per-page access tokens
  const accountsUrl = new URL(`${FACEBOOK_GRAPH}/me/accounts`)
  accountsUrl.searchParams.set('access_token', tokenJson.access_token)
  accountsUrl.searchParams.set('fields', 'id,name,access_token,tasks')
  const accountsRes = await fetch(accountsUrl)
  if (!accountsRes.ok) throw new Error(`facebook /me/accounts failed: ${accountsRes.status}`)
  const accountsJson = await accountsRes.json() as { data?: FacebookPage[] }
  const pages = accountsJson.data ?? []

  // Pick the first page with CREATE_CONTENT (research Pattern 4)
  const page = pages.find(p => p.tasks?.includes('CREATE_CONTENT')) ?? null
  return { page }
}
