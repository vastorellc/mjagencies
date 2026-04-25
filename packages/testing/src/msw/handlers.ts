import type { HttpHandler } from 'msw'
import { cloudflareHandlers } from './cloudflare-handlers'

// Base MSW handlers — includes all handler groups.
// Plan 01-03 adds Cloudflare Images handler for media package tests.
export { cloudflareHandlers } from './cloudflare-handlers'

export const baseHandlers: HttpHandler[] = [...cloudflareHandlers]
