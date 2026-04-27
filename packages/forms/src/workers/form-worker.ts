import { createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-forms-worker' })

export interface FormSubmissionJobData {
  agencyId: string
  formId?: string
  name: string
  email: string
  phone?: string
  message: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

export function createFormWorker(agencyId: string) {
  const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

  return createEncryptedWorker<FormSubmissionJobData>(
    'form-submissions',
    async (job) => {
      const { agencyId: jobAgencyId, name, email, phone, message, utmSource } = job.data

      log.info({ email: '[REDACTED]', agencyId: jobAgencyId }, 'Processing form submission')

      const payloadBaseUrl = process.env['PAYLOAD_SERVER_URL'] ?? 'http://localhost:3000'
      const payloadApiKey = process.env['PAYLOAD_API_KEY'] ?? ''

      const [firstName, ...rest] = name.trim().split(' ')
      const lastName = rest.join(' ') || '-'

      const contactRes = await fetch(`${payloadBaseUrl}/api/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `users API-Key ${payloadApiKey}`,
        },
        body: JSON.stringify({
          agency_id: jobAgencyId,
          email,
          first_name: firstName ?? name,
          last_name: lastName,
          phone: phone ?? null,
          source: utmSource ?? 'inbound_content',
          status: 'new',
        }),
      })

      if (!contactRes.ok) {
        const err = await contactRes.text()
        log.error({ agencyId: jobAgencyId, status: contactRes.status }, `CRM contact creation failed: ${err}`)
        throw new Error(`CRM contact creation failed with status ${contactRes.status}`)
      }

      const contactData = await contactRes.json() as { doc?: { id?: string } }
      const contactId = contactData.doc?.id ?? 'unknown'
      log.info({ contactId, agencyId: jobAgencyId }, 'Contact created in CRM')

      const { createEncryptedQueue } = await import('@mjagency/queue')
      const emailQueue = createEncryptedQueue<{
        to: string; subject: string; html: string; from: string; agencyId: string
      }>('email-send', {
        host: redisHost,
        port: redisPort,
        keyPrefix: REDIS_KEY.bullPrefix(jobAgencyId),
      })

      const agencyName = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? 'MJAgency'
      const agencyEmail = process.env['NEXT_PUBLIC_CONTACT_EMAIL'] ?? `hello@${jobAgencyId}.com`

      // agencyName used only for logging context; suppress unused-var lint
      void agencyName

      await (emailQueue as unknown as {
        add: (name: string, data: object, opts: object) => Promise<void>
      }).add('send', {
        to: agencyEmail,
        subject: `New contact form submission from ${firstName ?? name}`,
        html: `<p>New contact from ${name} (${email}).</p><p>Message: ${message}</p>`,
        from: agencyEmail,
        agencyId: jobAgencyId,
      }, { sensitiveData: true })

      log.info({ agencyId: jobAgencyId, contactId }, 'Email notification enqueued')
    },
    {
      host: redisHost,
      port: redisPort,
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    }
  )
}
