# @mjagency/queue

BullMQ wrapper that transparently AES-GCM-256-encrypts job payloads before they enter
Redis and decrypts them inside the worker processor. Satisfies REQ-306, REQ-425, and SEC-N10.

## Why Encryption?

Sensitive job payloads (PII, API tokens, webhook bodies, user emails) must not be visible
in Redis plaintext. A Redis `MONITOR` session, an RDB snapshot, or a misconfigured Redis
ACL could expose all queued jobs. Encrypting payloads at the application layer ensures
that even a full Redis compromise reveals only ciphertext.

## Usage

```typescript
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'

// Producer — encrypt sensitive jobs
const emailQueue = createEncryptedQueue<EmailJobData>('emails', {
  host: process.env.REDIS_HOST,
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  // Agency isolation: prefix all keys per CLAUDE.md §8
  keyPrefix: REDIS_KEY.bullPrefix(agencyId),
})

// Opt-in encryption per job (sensitiveData: true)
await emailQueue.add('send', { to: 'user@example.com', body: 'Welcome!' }, { sensitiveData: true })

// Non-sensitive job — passes through unencrypted
await emailQueue.add('notify-internal', { type: 'rate-limit-warning' })

// Consumer — automatic decryption before processor
createEncryptedWorker<EmailJobData>('emails', async (job) => {
  // job.data is already decrypted — use directly
  await sendEmail(job.data.to, job.data.body)
}, {
  host: process.env.REDIS_HOST,
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  keyPrefix: REDIS_KEY.bullPrefix(agencyId),
})
```

## Key Derivation

The queue encryption key is derived from `BULLMQ_ENCRYPTION_KEY` via `scryptSync` with
the queue-domain salt `'mjagency-queue-kdf-salt-v1'`:

```
queue_key = scryptSync(BULLMQ_ENCRYPTION_KEY, 'mjagency-queue-kdf-salt-v1', 32)
```

The vault domain uses salt `'mjagency-vault-kdf-salt-v1'`. The distinct salts ensure
that even if both env vars hold the same raw material, they produce cryptographically
different keys — preventing cross-domain key reuse.

Set `BULLMQ_ENCRYPTION_KEY` in Doppler (never in `.env` files committed to git).
See `docs/runbooks/vault-audit.md` for key rotation procedures.

## Encrypted Payload Shape

```json
{
  "__enc": true,
  "v": 1,
  "data": "<base64-AES-GCM-256-ciphertext>"
}
```

`v` is the key version — supports future rotation without re-queuing in-flight jobs.

## Performance

Per RESEARCH §7.3: AES-GCM-256 adds less than 0.1ms overhead per typical job payload
(tested at 1KB payload size). Negligible compared to Redis round-trip latency (~1ms local).

## Agency Prefix Convention (CLAUDE.md §8)

This wrapper does NOT enforce the `agency:<id>:bull` key prefix. Pass it via
`connection.keyPrefix` using the `REDIS_KEY.bullPrefix(agencyId)` helper from
`@mjagency/config`:

```typescript
import { REDIS_KEY } from '@mjagency/config'
// keyPrefix: 'agency:ecommerce:bull'
const conn = { host, keyPrefix: REDIS_KEY.bullPrefix('ecommerce') }
```

## Requirements Satisfied

| Requirement | Description |
|-------------|-------------|
| REQ-306 | BullMQ sensitive payloads encrypted before Redis |
| REQ-425 | BullMQ sensitive payloads — AES-GCM-256 encrypted |
| SEC-N10 | AES-GCM-256 via Node crypto (not pgcrypto — pitfall 8.7) |

## Roadmap

- **Per-tenant key derivation** — Phase 11 hardening: derive queue key per agency_id
  so a compromised per-agency key cannot decrypt another agency's jobs.
- **Queue prefix enforcement** — Optional: validate `connection.keyPrefix` matches
  the `agency:<id>:bull` pattern at construction time.
- **Key version `v: 2`** — When `BULLMQ_ENCRYPTION_KEY` is rotated, workers read `v`
  to select the correct key for decryption.
