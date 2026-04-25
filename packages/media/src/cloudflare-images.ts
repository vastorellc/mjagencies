import type { ImagesClient } from './types'

export interface ImagesEnv {
  CLOUDFLARE_API_TOKEN: string
  CLOUDFLARE_IMAGES_ACCOUNT_ID: string
}

/**
 * REQ-304: Cloudflare Images API token NEVER reaches client bundles.
 * This factory accepts the token only via server-side env. M005 wires
 * `apps/<app>/api/media/upload-url/route.ts` to invoke this and return
 * the one-time upload URL to the browser.
 */
export function createImagesClient(env: ImagesEnv): ImagesClient {
  if (!env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required (server-side only)')
  if (!env.CLOUDFLARE_IMAGES_ACCOUNT_ID) throw new Error('CLOUDFLARE_IMAGES_ACCOUNT_ID is required')
  const accountId = env.CLOUDFLARE_IMAGES_ACCOUNT_ID
  const token = env.CLOUDFLARE_API_TOKEN

  return {
    async createUploadUrl({ agencyId, metadata, requireSignedURLs }) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: (() => {
          const fd = new FormData()
          if (requireSignedURLs) fd.append('requireSignedURLs', 'true')
          fd.append('metadata', JSON.stringify({ agencyId, ...(metadata ?? {}) }))
          return fd
        })(),
      })
      if (!res.ok) throw new Error(`CF Images direct_upload failed: ${res.status} ${await res.text()}`)
      const data = (await res.json()) as { result: { uploadURL: string; id: string } }
      return { url: data.result.uploadURL, id: data.result.id }
    },
    deliveryUrl(imageId: string, variant: string): string {
      return `https://imagedelivery.net/${accountId}/${imageId}/${variant}`
    },
  }
}
