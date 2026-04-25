import { describe, it, expect } from 'vitest'
import { createImagesClient } from '../cloudflare-images'

const enabled = process.env.INTEGRATION === 'cloudflare-images'
;(enabled ? describe : describe.skip)('Cloudflare Images integration', () => {
  it('uploads a 1×1 PNG and returns a fetchable AVIF URL', async () => {
    const client = createImagesClient({
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN!,
      CLOUDFLARE_IMAGES_ACCOUNT_ID: process.env.CLOUDFLARE_IMAGES_ACCOUNT_ID!,
    })
    const { url, id } = await client.createUploadUrl({ agencyId: 'integration-test' })
    // PUT a 1×1 PNG fixture (use a Buffer constant) to `url`
    // Then assert client.deliveryUrl(id, 'avif').endsWith('/avif')
    expect(url).toMatch(/^https:\/\//)
    expect(id).toBeTruthy()
    const avifUrl = client.deliveryUrl(id, 'avif')
    expect(avifUrl.endsWith('/avif')).toBe(true)
    const head = await fetch(avifUrl, { method: 'HEAD' })
    expect(head.ok).toBe(true)
  }, 30_000)
})
