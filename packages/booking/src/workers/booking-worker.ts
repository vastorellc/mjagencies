/**
 * packages/booking/src/workers/booking-worker.ts
 *
 * Processes cal-booking-sync queue jobs.
 * BOOKING_CREATED: looks up contact by attendee email, creates activity (type: meeting)
 *                  and a follow-up task (due in 24h).
 * BOOKING_CANCELLED: logs the event (full activity cancellation deferred to 09-gap if needed).
 * BOOKING_RESCHEDULED: no-op in Phase 9 (logged for observability).
 *
 * REQ-114 (CRM sync), REQ-420 (booking creates CRM activity)
 */
import { createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-booking-worker' })

interface CalJobData {
  uid: string
  triggerEvent: 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'BOOKING_RESCHEDULED'
  agencyId: string
  attendee: { name: string; email: string; timeZone: string }
  organizer: { name: string; email: string }
  startTime: string
  endTime: string
}

export function createBookingWorker(agencyId: string): ReturnType<typeof createEncryptedWorker> {
  const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
  const payloadBaseUrl = process.env['PAYLOAD_SERVER_URL'] ?? 'http://localhost:3000'
  const payloadApiKey = process.env['PAYLOAD_API_KEY'] ?? ''

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `users API-Key ${payloadApiKey}`,
  }

  return createEncryptedWorker<CalJobData>(
    'cal-booking-sync',
    async (job) => {
      const { agencyId: jobAgencyId, triggerEvent, attendee, uid, startTime } = job.data

      log.info({ agencyId: jobAgencyId, trigger: triggerEvent, uid }, 'Processing booking job')

      if (triggerEvent === 'BOOKING_CREATED') {
        // 1. Look up contact by attendee email
        const contactSearch = await fetch(
          `${payloadBaseUrl}/api/contacts?where[email][equals]=${encodeURIComponent(attendee.email)}&where[agency_id][equals]=${jobAgencyId}&limit=1`,
          { headers: authHeaders }
        )
        const contactData = (await contactSearch.json()) as { docs?: Array<{ id: string }> }
        const contactId = contactData.docs?.[0]?.id ?? null

        // 2. Create activity record (type: meeting)
        const activityRes = await fetch(`${payloadBaseUrl}/api/activities`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            agency_id: jobAgencyId,
            type: 'meeting',
            contact_id: contactId,
            body: `Cal.com booking: ${uid}. Scheduled: ${startTime}. Attendee: ${attendee.email}`,
            status: 'logged',
          }),
        })

        if (!activityRes.ok) {
          log.error(
            { agencyId: jobAgencyId, uid, status: activityRes.status },
            'Failed to create CRM activity for booking'
          )
          throw new Error(`Failed to create CRM activity: ${activityRes.status}`)
        }

        // 3. Create follow-up task (due in 24h)
        const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        const taskRes = await fetch(`${payloadBaseUrl}/api/tasks`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            agency_id: jobAgencyId,
            title: `Follow up with ${attendee.name} after booking`,
            contact_id: contactId,
            due_date: dueDate,
            status: 'open',
          }),
        })

        if (!taskRes.ok) {
          log.error(
            { agencyId: jobAgencyId, uid, status: taskRes.status },
            'Failed to create CRM follow-up task for booking'
          )
          throw new Error(`Failed to create CRM task: ${taskRes.status}`)
        }

        log.info(
          { agencyId: jobAgencyId, uid, contactId },
          'Booking CRM activity and follow-up task created'
        )
      } else if (triggerEvent === 'BOOKING_CANCELLED') {
        // Log the cancellation event — full activity status update deferred to 09-gap if needed
        log.info(
          { agencyId: jobAgencyId, uid },
          'Booking cancelled — activity status update noted for 09-gap'
        )
      } else {
        // BOOKING_RESCHEDULED — no-op in Phase 9
        log.info(
          { agencyId: jobAgencyId, uid, triggerEvent },
          'Booking event received — no action for this trigger in Phase 9'
        )
      }
    },
    {
      host: redisHost,
      port: redisPort,
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    }
  )
}
