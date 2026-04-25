import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { cloudflareHandlers } from '@mjagency/testing/msw'
import { createImagesClient } from '../cloudflare-images'

const server = setupServer(...cloudflareHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => server.close())

describe('createImagesClient', () => {
  it('throws if CLOUDFLARE_API_TOKEN is missing', () => {
    expect(() =>
      createImagesClient({ CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_IMAGES_ACCOUNT_ID: 'acc' }),
    ).toThrow('CLOUDFLARE_API_TOKEN is required')
  })

  it('throws if CLOUDFLARE_IMAGES_ACCOUNT_ID is missing', () => {
    expect(() =>
      createImagesClient({ CLOUDFLARE_API_TOKEN: 'token', CLOUDFLARE_IMAGES_ACCOUNT_ID: '' }),
    ).toThrow('CLOUDFLARE_IMAGES_ACCOUNT_ID is required')
  })

  it('deliveryUrl returns a URL containing imagedelivery.net, account id, image id, and ends with /avif', () => {
    const client = createImagesClient({
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_IMAGES_ACCOUNT_ID: 'acc-123',
    })
    const url = client.deliveryUrl('img-456', 'avif')
    expect(url).toContain('imagedelivery.net')
    expect(url).toContain('acc-123')
    expect(url).toContain('img-456')
    expect(url.endsWith('/avif')).toBe(true)
  })

  it('createUploadUrl posts to CF Images direct_upload endpoint and returns { url, id }', async () => {
    const client = createImagesClient({
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_IMAGES_ACCOUNT_ID: 'test-account',
    })
    const result = await client.createUploadUrl({ agencyId: 'ecommerce' })
    expect(result).toHaveProperty('url')
    expect(result).toHaveProperty('id')
    expect(typeof result.url).toBe('string')
    expect(typeof result.id).toBe('string')
    expect(result.url).toMatch(/^https:\/\//)
  })
})
