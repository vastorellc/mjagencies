/**
 * packages/esign/src/workers/esign-worker.ts
 * BullMQ worker: emails signed PDF to both parties, updates CRM deal → won, triggers deposit invoice.
 *
 * REQ-127: deposit invoice auto-triggered on e-sign.
 * REQ-133: signed PDF emailed to both signer + agency owner.
 * REQ-401: signed PDF stored in R2 (done in sign-proposal.ts), emailed here.
 *
 * Agency owner email: fetched from Payload agencies collection at runtime (never from env vars —
 * consistent with project pattern; project context note: "Agency owner email fetched from
 * Payload agencies collection at runtime (NOT from env vars)").
 */
import { createEncryptedWorker, createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { EsignCompletionJobData } from '../actions/sign-proposal.js'

const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env['R2_ENDPOINT'] ?? '',
  credentials: {
    accessKeyId: process.env['R2_ACCESS_KEY_ID'] ?? '',
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
  },
})

export function startEsignWorker(): void {
  createEncryptedWorker<EsignCompletionJobData>(
    'esign-completion',
    async (job) => {
      const { esignId, proposalId, agencyId, r2Key, signerName, pdfHash } = job.data
      const log = createLogger({ service: 'mjagency-esign', agencyId })

      // 1. Fetch proposal to get contact email + CRM deal ID
      const proposalRes = await fetch(
        `${PAYLOAD_URL}/api/proposals/${proposalId}`,
        { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
      )
      const proposal = await proposalRes.json() as {
        id: string
        title: string
        agency_id: string
        contact_id?: { email?: string }
        deal_id?: string
      }

      // 2. Download signed PDF from R2 for email attachment
      const getCmd = new GetObjectCommand({
        Bucket: process.env['R2_ESIGN_BUCKET'] ?? 'mjagency-esign',
        Key: r2Key,
      })
      const r2Res = await r2Client.send(getCmd)
      const pdfBuffer = await r2Res.Body?.transformToByteArray()

      // 3. Set up shared email queue (sensitiveData: true — email addresses are PII)
      const emailQueue = createEncryptedQueue<{
        to: string
        subject: string
        attachmentBase64: string
        agencyId: string
      }>('email-send', {
        host: redisHost,
        port: redisPort,
        keyPrefix: REDIS_KEY.bullPrefix(agencyId),
      })

      // 4. Email signer (contact email from proposal)
      const signerEmail = proposal.contact_id?.email
      if (signerEmail && pdfBuffer) {
        await emailQueue.add(
          'send',
          {
            to: signerEmail,
            subject: `Signed: ${proposal.title}`,
            attachmentBase64: Buffer.from(pdfBuffer).toString('base64'),
            agencyId,
          },
          { sensitiveData: true },
        )
        log.info({ esignId }, 'Signer email enqueued for signed proposal')
      }

      // 5. Fetch agency owner email from Payload agencies collection (NOT from env vars —
      //    pattern: agency owner email fetched at runtime from Payload agencies collection)
      const agencyRes = await fetch(
        `${PAYLOAD_URL}/api/agencies?where[id][equals]=${agencyId}&limit=1`,
        { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
      )
      const agencyData = await agencyRes.json() as { docs: Array<{ ownerEmail?: string }> }
      const agencyOwnerEmail = agencyData.docs[0]?.ownerEmail ?? ''

      if (agencyOwnerEmail && pdfBuffer) {
        await emailQueue.add(
          'send',
          {
            to: agencyOwnerEmail,
            subject: `Proposal Signed: ${proposal.title} — by ${signerName}`,
            attachmentBase64: Buffer.from(pdfBuffer).toString('base64'),
            agencyId,
          },
          { sensitiveData: true },
        )
        log.info({ agencyId, esignId }, 'Agency owner email enqueued for signed proposal')
      }

      // 6. Update CRM deal stage → won (REQ-133: CRM deal closed on sign)
      if (proposal.deal_id) {
        await fetch(`${PAYLOAD_URL}/api/deals/${proposal.deal_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${PAYLOAD_API_KEY}`,
          },
          body: JSON.stringify({ stage: 'won' }),
        })
        log.info({ dealId: proposal.deal_id }, 'CRM deal → won')
      }

      // 7. Enqueue deposit invoice creation (REQ-127: deposit auto-triggered on sign)
      //    Invoice payload contains only proposalId + agencyId — no financial data (T-10-05-07)
      const invoiceQueue = createEncryptedQueue<{
        proposalId: string
        agencyId: string
        esignId: string
      }>('invoice-create', {
        host: redisHost,
        port: redisPort,
        keyPrefix: REDIS_KEY.bullPrefix(agencyId),
      })
      await invoiceQueue.add(
        'create-deposit',
        { proposalId, agencyId, esignId },
        { sensitiveData: false },
      )

      log.info(
        { esignId, pdfHash },
        'E-sign completion processed: PDF emailed to both parties, CRM deal → won, invoice enqueued',
      )
    },
    { host: redisHost, port: redisPort, keyPrefix: REDIS_KEY.bullPrefix('platform') },
  )
}
