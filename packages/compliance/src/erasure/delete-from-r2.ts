/**
 * packages/compliance/src/erasure/delete-from-r2.ts
 * Plan 11-05 / REQ-144 D-05 (system 3 of 7):
 *
 * Lists media uploaded under agency:<agencyId>/uploads/* and deletes objects
 * whose object metadata `email-sha256` matches the requester. Files inside
 * `agency:<agencyId>/esign/*` are protected by the ESIGN Act retention check
 * upstream (legal-hold module) — the worker does NOT call this function for
 * esign objects within the retention window.
 *
 * Reuses the S3 client from Phase 10 (R2 endpoint).
 */
import { createHash } from 'node:crypto'
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'

export interface DeleteFromR2Input {
  agencyId: string
  email: string
}

export interface DeleteFromR2Result {
  deleted: number
  skipped: number
  scanned: number
}

function getR2Client(): { client: S3Client; bucket: string } {
  const endpoint = process.env['R2_ENDPOINT'] ?? ''
  const accessKey = process.env['R2_ACCESS_KEY_ID'] ?? ''
  const secret = process.env['R2_SECRET_ACCESS_KEY'] ?? ''
  const bucket = process.env['R2_MEDIA_BUCKET'] ?? 'mjagency-media'
  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secret },
  })
  return { client, bucket }
}

export async function deleteFromR2(input: DeleteFromR2Input): Promise<DeleteFromR2Result> {
  const { client, bucket } = getR2Client()
  const prefix = `agency:${input.agencyId}/uploads/`
  const emailHash = createHash('sha256').update(input.email).digest('hex')

  let scanned = 0
  let deleted = 0
  let continuationToken: string | undefined

  // Bail if R2 not configured (dev / CI).
  if (!process.env['R2_ENDPOINT']) {
    return { deleted: 0, skipped: 0, scanned: 0 }
  }

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 100,
      }),
    )
    continuationToken = list.NextContinuationToken
    const objects = list.Contents ?? []

    for (const obj of objects) {
      if (!obj.Key) continue
      scanned += 1
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: obj.Key }))
        const meta = head.Metadata ?? {}
        const tag = meta['email-sha256'] ?? meta['email_sha256']
        if (tag === emailHash) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }))
          deleted += 1
        }
      } catch {
        // Best-effort; continue listing.
      }
    }
  } while (continuationToken)

  return { deleted, skipped: 0, scanned }
}
