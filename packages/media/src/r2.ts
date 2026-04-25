import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { R2Client } from './types'

export interface R2Env {
  R2_ACCOUNT_ID: string
  R2_ACCESS_KEY: string
  R2_SECRET_KEY: string
  R2_BUCKET: string
}

export function createR2Client(env: R2Env): R2Client {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY || !env.R2_SECRET_KEY || !env.R2_BUCKET) {
    throw new Error('R2 client requires R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET (server-side only)')
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY, secretAccessKey: env.R2_SECRET_KEY },
  })
  const bucket = env.R2_BUCKET

  return {
    async putObject({ key, body, contentType }) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body as Buffer, ContentType: contentType }))
    },
    async getObject({ key }) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      const body = res.Body as unknown as ReadableStream
      return { body, contentType: res.ContentType }
    },
    async signedUrl({ key, expiresInSeconds }) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: expiresInSeconds })
    },
  }
}
