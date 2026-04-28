/**
 * packages/esign/src/actions/sign-proposal.ts
 * Public route handler — validates signature data URI, triggers PDF generation + R2 upload.
 * Not a server action (no requireSession) — public proposal page handler.
 * HMAC verification of proposal token is delegated to handleProposalAction in @mjagency/proposals.
 *
 * Security (STRIDE T-10-05-01 through T-10-05-06):
 * - signatureDataUri validated: must be data:image/png;base64, non-empty, max 500KB
 * - signer IP SHA-256 hashed before storage (raw IP never written)
 * - PDF hash stored in esign_records + R2 metadata (tamper detection)
 * - Hash-chain audit record: SHA-256(prevHash + pdfHash + esignId + signerName + timestamp)
 * - ESIGN disclosure text stored verbatim in audit record (legal non-repudiation)
 */
import { createHash } from 'crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { generateEsignPdf } from '../pdf/generate-pdf.js'
import { ESIGN_DISCLOSURE_TEXT } from '../components/EsignDisclosure.js'
import { handleProposalAction } from '@mjagency/proposals'
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'

const R2_BUCKET = process.env['R2_ESIGN_BUCKET'] ?? 'mjagency-esign'
const R2_ENDPOINT = process.env['R2_ENDPOINT'] ?? ''
const R2_ACCESS_KEY = process.env['R2_ACCESS_KEY_ID'] ?? ''
const R2_SECRET = process.env['R2_SECRET_ACCESS_KEY'] ?? ''
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET },
})

export interface SignProposalInput {
  token: string
  hmacSignature: string
  signerName: string
  signatureDataUri: string
  signerIp: string
  signerUserAgent: string
  agencyId: string
}

export interface SignProposalOutput {
  ok: boolean
  esignId?: string
  error?: string
}

export interface EsignCompletionJobData {
  esignId: string
  proposalId: string
  agencyId: string
  r2Key: string
  signerName: string
  pdfHash: string
}

export async function handleSignProposal(input: SignProposalInput): Promise<SignProposalOutput> {
  const log = createLogger({ service: 'mjagency-esign', agencyId: input.agencyId })

  // Validate signature data URI: must be non-empty PNG base64, max 500KB (T-10-05-02)
  if (!input.signatureDataUri?.startsWith('data:image/png;base64,')) {
    return { ok: false, error: 'Invalid signature format' }
  }
  const base64Part = input.signatureDataUri.replace('data:image/png;base64,', '')
  const sigBytes = Buffer.from(base64Part, 'base64')
  if (sigBytes.length === 0) {
    return { ok: false, error: 'Signature is empty' }
  }
  if (sigBytes.length > 500 * 1024) {
    return { ok: false, error: 'Signature image too large' }
  }

  // Fetch proposal details for PDF (title, body, agency confirmation)
  const proposalRes = await fetch(
    `${PAYLOAD_URL}/api/proposals?where[token][equals]=${input.token}&limit=1`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
  )
  const proposalData = await proposalRes.json() as {
    docs: Array<{ id: string; title: string; body_json: { text?: string }; agency_id: string }>
  }

  if (!proposalData.docs.length) {
    return { ok: false, error: 'Proposal not found' }
  }

  const proposal = proposalData.docs[0]!

  // Generate PDF with ESIGN Act disclosure, signature image, signer name, timestamp, proposal token
  const { pdfBytes, pdfHash } = await generateEsignPdf({
    proposalTitle: proposal.title,
    proposalBodyText: proposal.body_json?.text ?? proposal.title,
    signerName: input.signerName,
    signatureDataUri: input.signatureDataUri,
    disclosureText: ESIGN_DISCLOSURE_TEXT,
    signedAt: new Date(),
    proposalToken: input.token,
    agencyName: input.agencyId,
  })

  // Upload to R2: agency:{agencyId}/esign/{esignId}.pdf (private — never publicly accessible)
  const esignId = createHash('sha256')
    .update(`${input.token}-${Date.now()}`)
    .digest('hex')
    .substring(0, 16)
  const r2Key = `agency:${input.agencyId}/esign/${esignId}.pdf`

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: pdfBytes,
      ContentType: 'application/pdf',
      Metadata: { proposalToken: input.token, signerName: input.signerName, pdfHash },
    }),
  )

  log.info({ esignId, r2Key }, 'E-sign PDF uploaded to R2')

  // Hash-chain audit record (Phase 2 pattern — T-10-05-06)
  // Raw IP never stored — SHA-256 hash only (T-10-05-05)
  const signerIpHash = createHash('sha256').update(input.signerIp).digest('hex')

  const prevRecord = await fetch(
    `${PAYLOAD_URL}/api/esign_records?where[agency_id][equals]=${input.agencyId}&sort=-createdAt&limit=1`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
  )
  const prevData = await prevRecord.json() as { docs: Array<{ record_hash: string }> }
  const prevHash = prevData.docs[0]?.record_hash ?? null

  const recordHash = createHash('sha256')
    .update(`${prevHash ?? ''}${pdfHash}${esignId}${input.signerName}${new Date().toISOString()}`)
    .digest('hex')

  // Write audit record to Payload (ESIGN disclosure stored verbatim — legal non-repudiation)
  await fetch(`${PAYLOAD_URL}/api/esign_records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    body: JSON.stringify({
      agency_id: input.agencyId,
      proposal_id: proposal.id,
      pdf_hash: pdfHash,
      r2_key: r2Key,
      signer_ip_hash: signerIpHash,
      signer_user_agent: input.signerUserAgent,
      signer_name: input.signerName,
      disclosure_text: ESIGN_DISCLOSURE_TEXT,
      signed_at: new Date().toISOString(),
      prev_hash: prevHash,
      record_hash: recordHash,
    }),
  })

  // Update proposal status → signed; HMAC verification handled in handleProposalAction
  await handleProposalAction({
    token: input.token,
    action: 'sign',
    hmacSignature: input.hmacSignature,
  })

  // Enqueue e-sign completion worker (emails PDF to both parties + CRM update + invoice trigger)
  const queue = createEncryptedQueue<EsignCompletionJobData>('esign-completion', {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    keyPrefix: REDIS_KEY.bullPrefix(input.agencyId),
  })
  await queue.add(
    'complete',
    {
      esignId,
      proposalId: proposal.id,
      agencyId: input.agencyId,
      r2Key,
      signerName: input.signerName,
      pdfHash,
    } satisfies EsignCompletionJobData,
    { sensitiveData: true },
  )

  return { ok: true, esignId }
}
