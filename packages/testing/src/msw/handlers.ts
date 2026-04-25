import type { HttpHandler } from 'msw'

// Base MSW handlers at M001 — empty array.
// Plan 01-02 adds Stripe webhook handler at the route stub.
// Plan 01-03 adds Cloudflare Images handler for media package tests.
export const baseHandlers: HttpHandler[] = []
