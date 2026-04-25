import type { StreamClient } from './types'

export interface StreamEnv {
  CLOUDFLARE_API_TOKEN: string
  CLOUDFLARE_STREAM_ACCOUNT_ID: string
}

export function createStreamClient(env: StreamEnv): StreamClient {
  if (!env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required (server-side only)')
  if (!env.CLOUDFLARE_STREAM_ACCOUNT_ID) throw new Error('CLOUDFLARE_STREAM_ACCOUNT_ID is required')
  const accountId = env.CLOUDFLARE_STREAM_ACCOUNT_ID
  const token = env.CLOUDFLARE_API_TOKEN

  return {
    async createUploadUrl({ agencyId, maxDurationSeconds }) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxDurationSeconds: maxDurationSeconds ?? 600,
          meta: { agencyId },
        }),
      })
      if (!res.ok) throw new Error(`CF Stream direct_upload failed: ${res.status} ${await res.text()}`)
      const data = (await res.json()) as { result: { uploadURL: string; uid: string } }
      return { url: data.result.uploadURL, id: data.result.uid }
    },
    embedUrl(videoId: string): string {
      return `https://customer-${accountId}.cloudflarestream.com/${videoId}/iframe`
    },
  }
}
