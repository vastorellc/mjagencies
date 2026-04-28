/**
 * packages/compliance/src/erasure/upload-r2.ts
 * Plan 11-05 / REQ-144 D-06:
 *
 * Uploads the receipt PDF to R2 vault at erasure-receipts/{agencyId}/{requestId}.pdf.
 * Reuses the @aws-sdk/client-s3 PutObjectCommand pattern from Phase 10 esign.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export interface UploadR2Result {
  ok: boolean
  key: string
  bucket: string
  errorMessage?: string
}

export async function uploadReceiptToR2(
  key: string,
  body: Uint8Array,
): Promise<UploadR2Result> {
  const endpoint = process.env['R2_ENDPOINT'] ?? ''
  const accessKey = process.env['R2_ACCESS_KEY_ID'] ?? ''
  const secret = process.env['R2_SECRET_ACCESS_KEY'] ?? ''
  const bucket = process.env['R2_RECEIPTS_BUCKET'] ?? 'mjagency-erasure-receipts'

  if (!endpoint || !accessKey || !secret) {
    return {
      ok: false,
      key,
      bucket,
      errorMessage: 'R2 credentials missing — receipt PDF generated but not uploaded',
    }
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secret },
  })

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
      }),
    )
    return { ok: true, key, bucket }
  } catch (err) {
    return {
      ok: false,
      key,
      bucket,
      errorMessage: err instanceof Error ? err.message : 'Unknown R2 upload error',
    }
  }
}
