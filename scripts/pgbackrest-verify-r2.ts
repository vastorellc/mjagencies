/**
 * pgbackrest-verify-r2.ts — R2 smoke test for pgBackRest backup bucket
 *
 * Verifies that the `mjagency-backups` R2 bucket is reachable and that the
 * backup upload pipeline is wired correctly after a manual `pgbackrest backup`
 * invocation.
 *
 * Behavior:
 *   - Exits 2 (skip) immediately if R2_ACCOUNT_ID is not set — safe for CI without R2 creds.
 *   - Writes a probe object (`probes/pgbackrest-verify-<ts>.txt`) to the bucket.
 *   - Reads it back and asserts the body is `ok`.
 *   - Lists objects under the `archive/postgres-main/` prefix using a direct
 *     S3Client (createR2Client from @mjagency/media only exposes put/get/signedUrl,
 *     not list — deliberate Phase-1 API gap, tracked for M005 if a list method is needed
 *     elsewhere; here we bypass it with a direct S3Client for the list call only).
 *   - Exits 0 on success.
 *   - Exits 1 on failure (prints diagnostic to stderr).
 *
 * Usage:
 *   pnpm tsx scripts/pgbackrest-verify-r2.ts
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY=... R2_SECRET_KEY=... pnpm tsx scripts/pgbackrest-verify-r2.ts
 *
 * Requirements: real R2 credentials + at least one completed pgbackrest backup
 * (so the archive prefix has objects). Without a prior backup, only the probe
 * put/get is verified (bucket reachability), and the list step reports 0 objects.
 */

const BUCKET = 'mjagency-backups'

async function main(): Promise<void> {
  // Exit 2 (skip) when R2 credentials are absent — CI without R2 creds should not fail.
  // Dynamic imports below are deferred until after this guard so module resolution
  // does not fail in environments where @mjagency/media is not built yet.
  if (!process.env.R2_ACCOUNT_ID) {
    process.stdout.write('[pgbackrest-verify-r2] R2_ACCOUNT_ID not set — skipping (exit 2)\n')
    process.exit(2)
  }

  const accountId = process.env.R2_ACCOUNT_ID as string
  const accessKey = process.env.R2_ACCESS_KEY
  const secretKey = process.env.R2_SECRET_KEY

  if (!accessKey || !secretKey) {
    process.stderr.write(
      '[pgbackrest-verify-r2] R2_ACCESS_KEY and R2_SECRET_KEY are required when R2_ACCOUNT_ID is set\n',
    )
    process.exit(1)
  }

  // Dynamic imports — deferred until env guard passes
  const { createR2Client } = await import('@mjagency/media')
  const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')

  // ── Step 1: Use createR2Client (from @mjagency/media Phase 1) for probe put/get ──
  const r2 = createR2Client({
    R2_ACCOUNT_ID: accountId,
    R2_ACCESS_KEY: accessKey,
    R2_SECRET_KEY: secretKey,
    R2_BUCKET: BUCKET,
  })

  const probeKey = `probes/pgbackrest-verify-${Date.now()}.txt`
  const probeBody = 'ok'

  // Write probe object
  await r2.putObject({ key: probeKey, body: Buffer.from(probeBody), contentType: 'text/plain' })
  console.log(`[pgbackrest-verify-r2] Probe written: ${probeKey}`)

  // Read probe object back and verify body
  const got = await r2.getObject({ key: probeKey })
  const bodyText = await streamToString(got.body)
  if (bodyText.trim() !== probeBody) {
    process.stderr.write(
      `[pgbackrest-verify-r2] Probe body mismatch — expected "ok", got "${bodyText}"\n`,
    )
    process.exit(1)
  }
  console.log('[pgbackrest-verify-r2] Probe read back successfully — body matches "ok"')

  // ── Step 2: List archive objects (direct S3Client — createR2Client has no list method) ──
  // Deliberate design: createR2Client from @mjagency/media Phase 1 exposes put/get/signedUrl
  // only. The list call here uses @aws-sdk/client-s3 directly. If a list abstraction is
  // needed more broadly, track for M005.
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  })

  const listResult = await s3.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'archive/postgres-main/',
      MaxKeys: 1,
    }),
  )

  const objectCount = listResult.KeyCount ?? 0
  if (objectCount > 0) {
    console.log(
      `[pgbackrest-verify-r2] archive/postgres-main/ prefix has ${objectCount}+ object(s) — backup pipeline confirmed`,
    )
  } else {
    console.log(
      '[pgbackrest-verify-r2] archive/postgres-main/ prefix has 0 objects — run "pgbackrest backup" first to populate',
    )
  }

  // ── Step 3: Report ──
  console.log(`[pgbackrest-verify-r2] R2 bucket ${BUCKET} reachable — verification complete`)
  console.log(`[pgbackrest-verify-r2] Probe key: ${probeKey}`)
  process.exit(0)
}

/** Reads a WHATWG ReadableStream to a UTF-8 string. */
async function streamToString(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer))
  }
  return Buffer.concat(chunks).toString('utf-8')
}

main().catch((err: unknown) => {
  process.stderr.write(`[pgbackrest-verify-r2] Unexpected error: ${String(err)}\n`)
  process.exit(1)
})
