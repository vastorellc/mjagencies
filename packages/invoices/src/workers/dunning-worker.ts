/**
 * packages/invoices/src/workers/dunning-worker.ts
 * Dunning: day 3, 7, 14 email reminders then close at day 30.
 * REQ-128: invoice tracked in CRM with visible balance.
 */
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'

interface DunningJobData { agencyId: string; triggeredAt: string }

const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

type DunningSentInvoice = {
  id: string; title: string; total_amount: number; remaining_balance: number;
  sent_at: string; status: string; due_date?: string; stripe_payment_link_url?: string;
  contact_id?: { email?: string }; agency_id: string
}

export function startDunningWorker(): void {
  const queue = createEncryptedQueue<DunningJobData>('invoice-dunning', {
    host: redisHost, port: redisPort,
    keyPrefix: 'platform:bull',
  })

  // Register daily dunning check
  void queue.add(
    'daily-dunning',
    { agencyId: 'all', triggeredAt: new Date().toISOString() },
    { repeat: { cron: '0 8 * * *' }, jobId: 'invoice-dunning-daily' }, // 8am UTC daily
  )

  createEncryptedWorker<DunningJobData>(
    'invoice-dunning',
    async (_job: import('bullmq').Job<DunningJobData>) => {
      const log = createLogger({ service: 'mjagency-invoices', agencyId: 'platform' })
      const now = new Date()

      // Fetch all sent/partial invoices
      const res = await fetch(
        `${PAYLOAD_URL}/api/invoices?where[status][in]=sent,partial&limit=200`,
        { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
      )
      const data = await res.json() as { docs: DunningSentInvoice[] }

      for (const invoice of data.docs) {
        if (!invoice.sent_at) continue
        const sentAt = new Date(invoice.sent_at)
        const daysSinceSent = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24))
        const contactEmail = invoice.contact_id?.email

        const emailQueue = createEncryptedQueue<{ to: string; subject: string; body: string; agencyId: string }>(
          'email-send',
          { host: redisHost, port: redisPort, keyPrefix: REDIS_KEY.bullPrefix(invoice.agency_id) },
        )

        // Day 3, 7, 14 reminders
        if ([3, 7, 14].includes(daysSinceSent) && contactEmail) {
          await emailQueue.add('send', {
            to: contactEmail,
            subject: `Payment Reminder: ${invoice.title}`,
            body: `This is a reminder that invoice "${invoice.title}" for $${(Number(invoice.remaining_balance) / 100).toFixed(2)} is awaiting payment.${invoice.stripe_payment_link_url ? `\n\nPay now: ${invoice.stripe_payment_link_url}` : ''}`,
            agencyId: invoice.agency_id,
          }, { sensitiveData: true })
          log.info({ invoiceId: invoice.id, daysSinceSent }, `Dunning reminder sent (day ${daysSinceSent})`)
        }

        // Day 30: close invoice
        if (daysSinceSent >= 30 && invoice.status === 'sent') {
          await fetch(`${PAYLOAD_URL}/api/invoices/${invoice.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
            body: JSON.stringify({ status: 'draft', due_date: null }), // move back to draft for manual handling
          })
          log.info({ invoiceId: invoice.id }, 'Invoice closed at day 30 (no payment received)')
        }
      }
    },
    { host: redisHost, port: redisPort, keyPrefix: 'platform:bull' },
  )
}
