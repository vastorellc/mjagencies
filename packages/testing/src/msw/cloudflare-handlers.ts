import { http, HttpResponse } from 'msw'
import type { HttpHandler } from 'msw'

/**
 * MSW handlers for Cloudflare Images API.
 * Used by @mjagency/media unit tests to mock CF Images direct_upload endpoint.
 */
export const cloudflareHandlers: HttpHandler[] = [
  http.post(
    'https://api.cloudflare.com/client/v4/accounts/:accountId/images/v2/direct_upload',
    () => {
      return HttpResponse.json({
        result: {
          uploadURL: 'https://upload.imagedelivery.net/x',
          id: 'img-test',
        },
        success: true,
        errors: [],
        messages: [],
      })
    },
  ),
]
