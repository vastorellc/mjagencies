MJAgency - CLAUDE.md
Agent instructions for GSD-2 automated build.

==============================================================
PROJECT IDENTITY
==============================================================
Multi-agency platform. brand.com + 11 agency subdomains.
Next.js 15 + Payload CMS 3.82.1 embedded. Per-agency Postgres.
Turborepo monorepo. US-only at v1.

Read PROJECT.md for full context.
Read relevant specs/milestone-M00N.md before each milestone.

==============================================================
CRITICAL RULES (READ FIRST, FOLLOW ALWAYS)
==============================================================

1. PAYLOAD VERSION
   Use EXACTLY Payload CMS 3.82.1.
   Never upgrade Payload without explicit human instruction.
   package.json must have "payload": "3.82.1" (exact, no ^ or ~).

2. JWT LIBRARY
   Use ONLY the 'jose' library for JWT operations.
   NEVER use 'jsonwebtoken' - it does not work in Next.js Edge runtime.
   All JWT verification: import { jwtVerify, SignJWT } from 'jose'
   Always pass algorithms, issuer, audience explicitly:
     jwtVerify(token, secret, { algorithms: ['HS256'], issuer: 'mjagency', audience: 'mjagency-api' })

3. SERVER ACTIONS - AUTH CHECK MANDATORY
   EVERY server action MUST begin with:
     const session = await auth()
     if (!session) throw new Error('Unauthorized')
     if (session.agencyId !== expectedAgencyId) throw new Error('Forbidden')
   No exceptions. Middleware alone is NOT sufficient for server actions.

4. NEXT.JS MIDDLEWARE
   Middleware runs on Edge runtime (no Node.js APIs).
   Only use 'jose' for JWT verification in middleware.
   Exclude Payload routes from middleware matcher:
     matcher: ['/((?!_next|api|\\(payload\\)|admin).*)']
   Never put Payload-dependent logic in middleware.ts

5. CONTENT-COMPLETE RULE
   NEVER generate placeholder text.
   NEVER write "TODO", "Coming soon", "[insert]", "Lorem ipsum".
   ALL content must be real and complete.
   Every image slot must have a real or generated asset.
   Fail fast and loudly if content is missing.

6. ANTI-FABRICATION RULES
   Never invent statistics without a real cited source.
   Never create fake testimonials or client names.
   Never fabricate benchmark numbers.
   AI-generated content >70% requires disclosure metadata.
   Playbook numbers must be ranges (e.g. 30-45%), not exact figures.

7. SECURITY MANDATORY PATTERNS
   All SVGs: sanitize via DOMPurify (server-side, jsdom) + SVGO before save.
   All webhooks: verify HMAC signature before processing.
   Stripe webhooks: use req.text() for raw body (never parsed body).
   No secrets in NEXT_PUBLIC_ env vars.
   No secrets passed as server component props to client.
   Stock API calls: server-side proxy only, never from browser.
   CSP nonce: generate per-request, inject into all inline styles.

8. AGENCY ISOLATION
   Every DB query must filter by agency_id.
   agency_id field: access.update = () => false (immutable)
   tRPC context must inject ctx.agencyId from JWT claims.
   All Payload collections: field-level access enforced.
   RLS must be set on all tables containing agency data.

9. TYPESCRIPT
   Strict mode always. No 'any' types.
   Prefer explicit return types on all functions.
   Import types with 'import type'.

10. TESTING
    Business logic: Vitest unit tests.
    API routes: Vitest integration tests with test DB.
    Critical paths: Playwright e2e tests.
    Webhooks: MSW mock handlers in test environment.

==============================================================
STACK QUICK REFERENCE
==============================================================
Auth tokens:    jose (jwtVerify, SignJWT)
Token storage:  httpOnly + SameSite=Strict + Secure cookies
Refresh tokens: One-time use, family revocation on replay
DB queries:     Drizzle ORM, always .where(eq(table.agencyId, ctx.agencyId))
Queue:          BullMQ, prefix 'agency:<id>:<queue-name>'
Cache:          Redis, prefix 'agency:<id>:cache:<key>'
Images:         Cloudflare Images API (server-side only)
SVG:            SVGO + DOMPurify sanitization on every upload
Email:          BullMQ async, never synchronous in request path
Logs:           Pino with redact config (tokens, emails, phones)
Errors:         Never expose internal details to client

==============================================================
CODING PATTERNS
==============================================================

Pattern: Server action (correct)
  'use server'
  export async function updatePage(data: PageData) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')
    if (session.agencyId !== data.agencyId) throw new Error('Forbidden')
    // proceed with operation
  }

Pattern: tRPC procedure (correct)
  .query(async ({ ctx, input }) => {
    return db.select().from(pages)
      .where(eq(pages.agencyId, ctx.agencyId))
  })

Pattern: Webhook handler (correct)
  export async function POST(req: Request) {
    const body = await req.text() // raw body for signature
    const sig = req.headers.get('stripe-signature')!
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    // check idempotency
    const exists = await redis.get(`stripe:event:${event.id}`)
    if (exists) return Response.json({ ok: true })
    await redis.set(`stripe:event:${event.id}`, '1', { ex: 86400 })
    // process via BullMQ, return 200 immediately
    await queue.add('stripe-event', event)
    return Response.json({ ok: true })
  }

Pattern: Middleware (correct - jose only)
  import { jwtVerify } from 'jose'
  export async function middleware(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET)
      await jwtVerify(token, secret, { issuer: 'mjagency', audience: 'mjagency-api' })
      return NextResponse.next()
    } catch {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }
  export const config = {
    matcher: ['/((?!_next|api|\\(payload\\)|admin|_vercel).*)']
  }

==============================================================
PUCK BUILDER RULES
==============================================================
- Puck editor component must be wrapped in server-side session check
- Auth cookie enables UI toggle only, NOT access control
- Server validates session + agency ownership before rendering Puck
- Puck saves via server action (with auth check per rule 3 above)
- Puck outputs JSON, never dangerouslySetInnerHTML
- All block components sanitize string inputs before rendering

==============================================================
CONTENT SPRINT INTEGRATION
==============================================================
Content workstream starts ONLY after M005 cms-collections slice completes.
Content tasks call LiteLLM via packages/ai to draft content.
Content tasks write to Payload CMS via REST API (not direct DB).
Each content task drafts one agency's content batch.
Validators run on every save (word count, originality, alt text).
Failed content saves do not block engineering progress.
