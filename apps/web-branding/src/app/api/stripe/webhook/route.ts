// Stripe webhook stub at M001.
// M002 will implement full webhook handling with HMAC verification and BullMQ queuing.
//
// IMPORTANT: We MUST use req.text() (raw body) here — NEVER req.json().
// Stripe signature verification (stripe.webhooks.constructEvent) requires the raw body
// string. Parsing with req.json() first would prevent HMAC verification from working.
// Per CLAUDE.md §7 ("Stripe webhooks: use req.text() for raw body") and pitfall 3.10.
//
// REQ-303: Stripe webhook HMAC verification is mandatory (M002 implements).

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  // Read raw body for future Stripe signature verification (CLAUDE.md §7, pitfall 3.10)
  const _rawBody = await req.text()

  return Response.json(
    { error: 'M002 will implement webhook handling' },
    { status: 501 },
  )
}
