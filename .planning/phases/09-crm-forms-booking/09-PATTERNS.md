# Phase 9: CRM + Forms + Booking — Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 14 new/modified file areas
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/crm/src/collections/*.ts` | model (Payload collection) | CRUD | `packages/cms/src/collections/pages.ts` + `forms.ts` | exact |
| `packages/crm/src/scoring/lead-score.ts` | service | transform | `packages/seo/src/` (plugin engine transform) | role-match |
| `packages/crm/src/queues/crm-queue.ts` | service | event-driven | `packages/cms/src/hooks/scheduled-publish.ts` | exact |
| `packages/email/src/sender.ts` | service | event-driven | `packages/queue/src/encrypted-queue.ts` | exact |
| `packages/email/src/queue/email-queue.ts` | service | event-driven | `packages/queue/src/encrypted-queue.ts` | exact |
| `packages/forms/src/collections/form-submissions.ts` | model | CRUD | `packages/cms/src/collections/forms.ts` | exact |
| `packages/forms/src/actions/submit-form.ts` | service | request-response | `apps/web-main/src/actions/seo-score.ts` | exact |
| `packages/sms/src/twilio.ts` | service | event-driven | `packages/queue/src/encrypted-queue.ts` | role-match |
| `packages/sms/src/queue/sms-queue.ts` | service | event-driven | `packages/queue/src/encrypted-queue.ts` | exact |
| `packages/booking/src/webhook-sync.ts` | middleware | event-driven | `apps/web-ecommerce/src/app/api/stripe/webhook/route.ts` | exact |
| `apps/web-ecommerce/src/app/api/contact/route.ts` | controller | request-response | `apps/web-ecommerce/src/app/api/health/route.ts` | role-match |
| `scripts/seed-crm-*.ts` | utility | batch | `packages/db/src/seed/steps/agencies.ts` + `admin-users.ts` | exact |
| `packages/crm/package.json` (fill deps) | config | — | `packages/queue/package.json` | exact |
| `packages/email/package.json` (fill deps) | config | — | `packages/queue/package.json` | exact |

---

## Pattern Assignments

### `packages/crm/src/collections/*.ts` (model, CRUD)

**Analog:** `packages/cms/src/collections/pages.ts` and `packages/cms/src/collections/forms.ts`

**Imports pattern** (pages.ts lines 1–27, forms.ts lines 1–18):
```typescript
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}
```

**Core collection pattern** (pages.ts lines 51–82):
```typescript
export const contactsCollection: CollectionConfig = {
  slug: 'contacts',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'first_name', 'last_name', 'agency_id', 'updatedAt'],
    group: 'CRM',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  fields: [
    AGENCY_ID_FIELD,
    // ... entity-specific fields
  ],
}
```

**Status/select field pattern** (pages.ts lines 37–49):
```typescript
const STATUS_FIELD: Field = {
  name: 'status',
  type: 'select',
  defaultValue: 'new',
  options: [
    { label: 'New', value: 'new' },
    { label: 'Qualified', value: 'qualified' },
    { label: 'Closed Won', value: 'closed_won' },
    { label: 'Closed Lost', value: 'closed_lost' },
  ],
  admin: { position: 'sidebar' },
}
```

**afterChange hook wiring** (pages.ts lines 68–81):
```typescript
hooks: {
  afterChange: [crmLeadRoutingHook],
},
```

**Note:** Five CRM collections follow this same pattern: `contacts`, `accounts`, `deals`, `activities`, `lead_scores`. All require `AGENCY_ID_FIELD` with `access: { update: fieldImmutable }`.

---

### `packages/crm/src/queues/crm-queue.ts` (service, event-driven)

**Analog:** `packages/cms/src/hooks/scheduled-publish.ts`

**Imports pattern** (scheduled-publish.ts lines 1–21):
```typescript
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'
import type { CollectionAfterChangeHook } from 'payload'
```

**Queue creation and job dispatch pattern** (scheduled-publish.ts lines 51–72):
```typescript
export interface CrmLeadRoutingJobData {
  contactId: string
  agencyId: string
  formId?: string
  score: number
}

const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

const queue = createEncryptedQueue<CrmLeadRoutingJobData>('crm-lead-routing', {
  host: redisHost,
  port: redisPort,
  keyPrefix: REDIS_KEY.bullPrefix(agencyId),  // agency:<id>:bull
})

await (queue as unknown as { add: (name: string, data: CrmLeadRoutingJobData, opts?: Record<string, unknown>) => Promise<void> }).add(
  'route-lead',
  jobData,
  { sensitiveData: true }  // PII — must encrypt
)
```

**Agency prefix convention** (from `packages/config/src/agency-constants.ts` line 39):
```typescript
bullPrefix: (a: string) => `agency:${a}:bull`,
// Always pass as keyPrefix to createEncryptedQueue/createEncryptedWorker
```

---

### `packages/email/src/sender.ts` + `packages/email/src/queue/email-queue.ts` (service, event-driven)

**Analog:** `packages/queue/src/encrypted-queue.ts`

**Worker pattern** (encrypted-queue.ts lines 102–124):
```typescript
import { createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'

export interface EmailJobData {
  to: string
  subject: string
  html: string
  from: string
  agencyId: string
  replyTo?: string
}

createEncryptedWorker<EmailJobData>(
  'email-send',
  async (job) => {
    // job.data is already decrypted by the worker proxy
    await sendViaSMTP(job.data)  // nodemailer / resend
  },
  {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    keyPrefix: REDIS_KEY.bullPrefix(job.data.agencyId),
  }
)
```

**Sensitive data flag** — Email jobs contain PII (to, subject body). Always pass `{ sensitiveData: true }` to `queue.add()` per the encrypted-queue.ts design.

**Queue enqueue pattern** (encrypted-queue.ts lines 63–88):
```typescript
const queue = createEncryptedQueue<EmailJobData>('email-send', {
  host: redisHost,
  port: redisPort,
  keyPrefix: REDIS_KEY.bullPrefix(agencyId),
})
// sensitiveData: true — triggers AES-GCM-256 encryption of payload in Redis
await queue.add('send', jobData, { sensitiveData: true })
```

**CLAUDE.md constraint:** Email MUST be dispatched via BullMQ async, never synchronous in the request path.

---

### `packages/forms/src/collections/form-submissions.ts` (model, CRUD)

**Analog:** `packages/cms/src/collections/forms.ts`

**Full collection pattern** (forms.ts lines 1–79):
```typescript
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const formSubmissionsCollection: CollectionConfig = {
  slug: 'form_submissions',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['form_id', 'agency_id', 'createdAt'],
    group: 'Forms',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,       // public POST allowed via API key or server action
    update: deleteAccess,           // admin/super_admin only
    delete: deleteAccess,
  },
  fields: [
    AGENCY_ID_FIELD,
    // form_id, data (json), ip_hash, honeypot_passed, spam_score, etc.
  ],
}
```

**Spam protection select** (forms.ts lines 68–77):
```typescript
{
  name: 'spam_protection',
  type: 'select',
  defaultValue: 'honeypot',
  options: [
    { label: 'Honeypot', value: 'honeypot' },
    { label: 'reCAPTCHA v3', value: 'recaptcha' },
    { label: 'Cloudflare Turnstile', value: 'turnstile' },
  ],
  admin: { position: 'sidebar' },
},
```

---

### `packages/forms/src/actions/submit-form.ts` (service, request-response)

**Analog:** `apps/web-main/src/actions/seo-score.ts`

**Auth check pattern — mandatory first lines** (seo-score.ts lines 1–29):
```typescript
'use server'
import { requireSession } from '@mjagency/auth'

export interface SubmitFormInput {
  formId: string
  agencyId: string
  data: Record<string, unknown>
  honeypot?: string
}

export async function submitForm(input: SubmitFormInput): Promise<{ ok: boolean }> {
  // CLAUDE.md Rule 3: auth check as first lines
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  // honeypot check before any DB write
  if (input.honeypot) return { ok: true } // silent discard

  // ... form processing, enqueue email job
}
```

**Agency isolation pattern** (seo-score.ts line 29):
```typescript
if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
```

**Note:** For public-facing contact forms (no session), use API route `apps/web-ecommerce/src/app/api/contact/route.ts` instead of a server action. The server action pattern above applies to authenticated dashboard form management.

---

### `apps/web-ecommerce/src/app/api/contact/route.ts` (controller, request-response)

**Analog:** `apps/web-ecommerce/src/app/api/stripe/webhook/route.ts` for structure + `apps/web-ecommerce/src/app/api/health/route.ts` for response pattern

**Route file structure** (stripe webhook route.ts lines 1–21):
```typescript
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const body = await req.json()  // contact forms use json (not raw text like Stripe)

  // Validate origin agency
  const agencyId = req.headers.get('x-agency-id') ?? body.agencyId
  if (!agencyId) return Response.json({ error: 'Missing agency' }, { status: 400 })

  // Honeypot check
  if (body._hp) return Response.json({ ok: true })  // silent discard

  // Enqueue to BullMQ — never process synchronously (CLAUDE.md BullMQ rule)
  await queue.add('contact-form', { ...body, agencyId }, { sensitiveData: true })

  return Response.json({ ok: true })
}
```

**HMAC webhook pattern** (CLAUDE.md §7, stripe webhook route.ts):
```typescript
// For Cal.com/Twilio webhooks — use raw body for HMAC verification
const body = await req.text()                          // raw body — NEVER req.json() first
const sig  = req.headers.get('x-webhook-signature')!
// verify HMAC before processing
```

**Idempotency pattern** (CLAUDE.md webhook pattern):
```typescript
const exists = await redis.get(`agency:${agencyId}:event:${eventId}`)
if (exists) return Response.json({ ok: true })
await redis.set(`agency:${agencyId}:event:${eventId}`, '1', { ex: 86400 })
```

---

### `packages/booking/src/webhook-sync.ts` (middleware, event-driven)

**Analog:** `apps/web-ecommerce/src/app/api/stripe/webhook/route.ts` (HMAC + BullMQ dispatch)

**HMAC + BullMQ dispatch pattern** (CLAUDE.md §7 + stripe route pattern):
```typescript
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  // Cal.com webhook: raw body required for HMAC (CLAUDE.md §7)
  const body = await req.text()
  const sig  = req.headers.get('x-cal-signature-256')!

  // HMAC verification — verify before any processing
  const hmac = createHmac('sha256', process.env['CAL_WEBHOOK_SECRET']!)
  hmac.update(body)
  const expected = hmac.digest('hex')
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body) as CalWebhookEvent

  // Idempotency check (CLAUDE.md webhook pattern)
  const exists = await redis.get(`agency:${event.agencyId}:cal:${event.uid}`)
  if (exists) return Response.json({ ok: true })
  await redis.set(`agency:${event.agencyId}:cal:${event.uid}`, '1', { ex: 86400 })

  // Dispatch to BullMQ — return 200 immediately (CLAUDE.md webhook pattern)
  await queue.add('cal-booking-sync', event, { sensitiveData: true })
  return Response.json({ ok: true })
}
```

---

### `packages/sms/src/twilio.ts` + `packages/sms/src/queue/sms-queue.ts` (service, event-driven)

**Analog:** `packages/queue/src/encrypted-queue.ts` (same encrypted BullMQ pattern as email)

**Queue + worker pattern** (encrypted-queue.ts lines 63–124):
```typescript
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'

export interface SmsJobData {
  to: string         // E.164 phone number
  body: string
  agencyId: string
  consentVerified: boolean   // TCPA: must be true before send
}

// Enqueue — sensitiveData: true because phone number is PII (CLAUDE.md §7)
const queue = createEncryptedQueue<SmsJobData>('sms-send', {
  host: redisHost,
  port: redisPort,
  keyPrefix: REDIS_KEY.bullPrefix(agencyId),
})
await queue.add('send', jobData, { sensitiveData: true })

// Worker
createEncryptedWorker<SmsJobData>('sms-send', async (job) => {
  if (!job.data.consentVerified) {
    throw new Error('TCPA: consentVerified must be true before sending SMS')
  }
  await twilioClient.messages.create({ to: job.data.to, body: job.data.body, from: ... })
}, { host: redisHost, port: redisPort, keyPrefix: REDIS_KEY.bullPrefix(agencyId) })
```

**Pino logging pattern** (CLAUDE.md §stack, config/src/logger.ts):
```typescript
import { createLogger } from '@mjagency/config'
const log = createLogger({ service: 'mjagency-sms', agencyId })
log.info({ to: '[REDACTED]' }, 'SMS dispatched')  // redact phone per CLAUDE.md
```

---

### `scripts/seed-crm-*.ts` (utility, batch)

**Analog:** `packages/db/src/seed/steps/agencies.ts` + `packages/db/src/seed/steps/admin-users.ts` + `scripts/seed-runner.ts`

**SeedStep contract** (types.ts lines 24–44):
```typescript
import type { SeedStep } from '../types.js'
import { agencyUuid } from '../uuid.js'
// SeedStep: { name: string; run: (tx: AgencyTx, agencySlug: string) => Promise<void> }
```

**Idempotent INSERT pattern** (agencies.ts lines 33–48):
```typescript
export const crmContactsPreSeedStep: SeedStep = {
  name: 'crm-contacts-preseed',
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)
    // ON CONFLICT DO NOTHING — idempotent (T-02-010)
    await tx.insert(crmContacts)
      .values(getNicheContacts(slug).map(c => ({ ...c, agencyId })))
      .onConflictDoNothing({ target: crmContacts.externalId })
  },
}
```

**SELECT-then-INSERT pattern for no unique constraint** (admin-users.ts lines 44–68):
```typescript
const existing = await tx.execute(
  sql`SELECT 1 FROM crm_contacts WHERE agency_id = ${agencyId}::uuid AND email = ${email} LIMIT 1`
)
const rows = (existing as { rows?: unknown[] }).rows ?? []
if (rows.length === 0) {
  await tx.execute(
    sql`INSERT INTO crm_contacts (id, agency_id, email, first_name, last_name, source)
        VALUES (gen_random_uuid(), ${agencyId}::uuid, ${email}, ${firstName}, ${lastName}, 'preseed')`
  )
}
```

**RLS context — already set by runner** (runner.ts lines 98–100):
```typescript
// runner sets this BEFORE calling step.run — no need to call it inside step
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT set_config('app.agency_id', ${agencyId}, true)`)
  await step.run(tx, agencySlug)
})
```

**CLI integration** (seed-runner.ts lines 34–43):
```typescript
import { runSeed, runSeedAllAgencies, allSteps, agencyUuid } from '../packages/db/src/seed/index.js'
// Add CRM pre-seed step to allSteps in packages/db/src/seed/index.ts
// Then run with: pnpm tsx scripts/seed-runner.ts --agency=ecommerce --steps=crm-contacts-preseed
```

---

### `packages/crm/package.json` (fill existing stub — config)

**Analog:** `packages/queue/package.json`

**Package.json pattern** (queue/package.json lines 1–30):
```json
{
  "name": "@mjagency/crm",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" }
  },
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@mjagency/db": "workspace:*",
    "@mjagency/queue": "workspace:*",
    "@mjagency/config": "workspace:*",
    "payload": "3.82.1"
  },
  "peerDependencies": {
    "next": ">=15.0.0",
    "payload": "3.82.1"
  },
  "devDependencies": {
    "@mjagency/testing": "workspace:*",
    "@types/node": "22.9.0",
    "typescript": "5.6.3",
    "vitest": "2.1.8"
  }
}
```

---

### `packages/email/package.json` (fill existing stub — config)

**Analog:** `packages/queue/package.json`

Additional deps beyond base pattern:
```json
"dependencies": {
  "@mjagency/queue": "workspace:*",
  "@mjagency/config": "workspace:*",
  "nodemailer": "^6.9.0",
  "@types/nodemailer": "^6.4.0"
}
```
No `twilio` or `resend` in email package. Email = Nodemailer (SMTP). SMS = Twilio in `packages/sms`.

---

## Shared Patterns

### Authentication (server actions)
**Source:** `apps/web-main/src/actions/seo-score.ts` lines 26–29 and `packages/auth/src/require-session.ts` lines 71–95
**Apply to:** All server actions in `packages/forms/src/actions/`, `packages/crm/src/actions/`
```typescript
'use server'
import { requireSession } from '@mjagency/auth'

export async function myAction(input: { agencyId: string; ... }) {
  const session = await requireSession()          // FIRST LINE — mandatory (CLAUDE.md Rule 3)
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
  // ... body
}
```

### Agency Isolation (Drizzle queries)
**Source:** `packages/db/src/client.ts` lines 68–79 and `CLAUDE.md §8`
**Apply to:** All Drizzle queries in CRM, forms, booking services
```typescript
import { withAgencyContext } from '@mjagency/db'
import { eq } from 'drizzle-orm'

// ONLY approved path for agency-scoped queries
const rows = await withAgencyContext(db, agencyId, async (tx) => {
  return tx.select().from(contacts)
    .where(eq(contacts.agencyId, agencyId))  // explicit filter even with RLS
})
```

### Payload Collection Access Control
**Source:** `packages/cms/src/access/collection-access.ts` lines 43–75
**Apply to:** All new CRM Payload collections (`contacts`, `accounts`, `deals`, `activities`, `lead_scores`, `form_submissions`)
```typescript
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

// Every new collection uses these three — no custom access functions needed
access: {
  read: collectionAccess,
  create: collectionAccess,
  update: collectionAccess,
  delete: deleteAccess,
}

// agency_id field always immutable:
access: { update: fieldImmutable }
```

### Webhook HMAC + Idempotency
**Source:** `CLAUDE.md §7` webhook pattern + `apps/web-ecommerce/src/app/api/stripe/webhook/route.ts`
**Apply to:** `packages/booking/src/webhook-sync.ts` (Cal.com), `packages/sms/src/twilio-webhook.ts` (Twilio status callbacks)
```typescript
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const body = await req.text()  // raw body — NEVER req.json() first (CLAUDE.md §7)
  // ... HMAC verify ...
  // ... idempotency check via Redis ...
  await queue.add('event-name', parsedEvent)  // dispatch immediately
  return Response.json({ ok: true })          // return 200 fast
}
```

### BullMQ Encrypted Queue
**Source:** `packages/queue/src/encrypted-queue.ts` lines 63–88 and `packages/config/src/agency-constants.ts` line 39
**Apply to:** All new queues in `packages/email/`, `packages/sms/`, `packages/crm/`, `packages/booking/`
```typescript
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'

// Queue name convention: '<package>-<action>'
// sensitiveData: true for any job containing PII (email addresses, phone numbers, names)
const queue = createEncryptedQueue<T>('email-send', {
  host: process.env['REDIS_HOST'] ?? 'localhost',
  port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  keyPrefix: REDIS_KEY.bullPrefix(agencyId),  // 'agency:<id>:bull'
})
await queue.add('send', data, { sensitiveData: true })
```

### Pino Logger
**Source:** `apps/web-ecommerce/src/app/api/health/route.ts` line 5 and `packages/config/src/logger.ts`
**Apply to:** All new packages and route files
```typescript
import { createLogger } from '@mjagency/config'
const log = createLogger({ service: 'mjagency-crm', agencyId: process.env.AGENCY ?? 'unknown' })
// Redact PII fields: tokens, emails, phones — set in Pino redact config (CLAUDE.md)
```

### Error Classes
**Source:** `packages/auth/src/errors.ts` lines 9–23
**Apply to:** All new service files, server actions
```typescript
import { UnauthorizedError, ForbiddenError } from '@mjagency/auth'

// Use typed errors — never expose internal details to client (CLAUDE.md §errors)
throw new ForbiddenError('Agency mismatch')   // 403
throw new UnauthorizedError('No session')     // 401
```

### Seed Step Structure
**Source:** `packages/db/src/seed/steps/agencies.ts` and `packages/db/src/seed/types.ts`
**Apply to:** All `scripts/seed-crm-*.ts` files
```typescript
import type { SeedStep } from '../packages/db/src/seed/types.js'
import { agencyUuid } from '../packages/db/src/seed/uuid.js'

export const mySeedStep: SeedStep = {
  name: 'crm-<entity>-preseed',   // unique name — becomes _seed_state.step_name PK
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)
    // tx already has set_config('app.agency_id', agencyId, true) set by runner
    // use .onConflictDoNothing() or SELECT-then-INSERT for idempotency
  },
}
// Register in packages/db/src/seed/index.ts allSteps array
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/crm/src/scoring/lead-score.ts` | service | transform | No scoring/ranking engine exists yet — use RESEARCH.md algorithm patterns. Lead scoring is pure function: `score = weights.pageViews * views + weights.formFill * fills + ...` |

---

## Metadata

**Analog search scope:**
- `/c/Users/jamshaid_pph/ClaudeMJ/.claude/worktrees/agent-accfc500ad0137dde/packages/`
- `/c/Users/jamshaid_pph/ClaudeMJ/.claude/worktrees/agent-accfc500ad0137dde/apps/web-ecommerce/src/`
- `/c/Users/jamshaid_pph/ClaudeMJ/.claude/worktrees/agent-accfc500ad0137dde/apps/web-main/src/`
- `/c/Users/jamshaid_pph/ClaudeMJ/.claude/worktrees/agent-accfc500ad0137dde/scripts/`

**Files scanned:** 28
**Pattern extraction date:** 2026-04-27
