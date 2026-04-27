/**
 * packages/crm/src/workers/crm-worker.ts
 *
 * CRM lead routing worker.
 * On route-lead job: sets sla_deadline = now + 4 business hours,
 * dispatches an internal BullMQ notification to the assigned_to user.
 *
 * Business hours: Mon–Fri 09:00–17:00 UTC.
 * If computed deadline falls on weekend or outside hours, advance to next open window.
 *
 * REQ-104 (SLA timer), REQ-105 (routing dispatch)
 */
import { createEncryptedWorker, createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'
import type { CrmLeadRoutingJobData } from '../queues/crm-queue.js'

/** Minimal local shape for BullMQ job — avoids direct bullmq devDep on @mjagency/crm. */
type BullJob<T> = { data: T; id?: string; name: string }

const log = createLogger({ service: 'mjagency-crm-worker' })

const BUSINESS_START_HOUR = 9   // UTC
const BUSINESS_END_HOUR = 17    // UTC

/**
 * Add N business hours to a date.
 * Business hours: Mon–Fri 09:00–17:00 UTC.
 * Exported for unit testing.
 */
export function addBusinessHours(from: Date, hoursToAdd: number): Date {
  let remaining = hoursToAdd * 60 * 60 * 1000 // convert to ms
  let cursor = new Date(from)

  // Advance to next business day/hour if starting outside business hours
  cursor = advanceToBusinessHour(cursor)

  while (remaining > 0) {
    const dayOfWeek = cursor.getUTCDay() // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend — advance to Monday 09:00 UTC
      cursor = nextMonday0900(cursor)
      continue
    }
    const endOfDay = new Date(cursor)
    endOfDay.setUTCHours(BUSINESS_END_HOUR, 0, 0, 0)

    const msUntilEod = endOfDay.getTime() - cursor.getTime()
    if (remaining <= msUntilEod) {
      cursor = new Date(cursor.getTime() + remaining)
      remaining = 0
    } else {
      remaining -= msUntilEod
      // Advance to next business day start
      cursor = new Date(endOfDay)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
      cursor.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0)
      // Skip weekend
      while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }
  }
  return cursor
}

function advanceToBusinessHour(d: Date): Date {
  const result = new Date(d)
  const day = result.getUTCDay()
  const hour = result.getUTCHours()

  // Skip Saturday → advance to Monday 09:00 UTC
  if (day === 6) {
    result.setUTCDate(result.getUTCDate() + 2)
    result.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0)
    return result
  }
  // Skip Sunday → advance to Monday 09:00 UTC
  if (day === 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    result.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0)
    return result
  }
  // Before business start — snap to 09:00 same day
  if (hour < BUSINESS_START_HOUR) {
    result.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0)
    return result
  }
  // After or at business end — advance to next weekday 09:00
  if (hour >= BUSINESS_END_HOUR) {
    result.setUTCDate(result.getUTCDate() + 1)
    result.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0)
    while (result.getUTCDay() === 0 || result.getUTCDay() === 6) {
      result.setUTCDate(result.getUTCDate() + 1)
    }
    return result
  }
  return result
}

function nextMonday0900(d: Date): Date {
  const result = new Date(d)
  // Advance until we hit Monday (day === 1)
  while (result.getUTCDay() !== 1) {
    result.setUTCDate(result.getUTCDate() + 1)
  }
  result.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0)
  return result
}

interface CrmNotificationJobData {
  contactId: string
  agencyId: string
  slaDeadline: string
}

export function createCrmWorker(agencyId: string): ReturnType<typeof createEncryptedWorker> {
  const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
  const redisConnection = {
    host: redisHost,
    port: redisPort,
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  }

  return createEncryptedWorker<CrmLeadRoutingJobData>(
    'crm-lead-routing',
    async (job: BullJob<CrmLeadRoutingJobData>) => {
      const { contactId, agencyId: jobAgencyId } = job.data
      const slaDeadline = addBusinessHours(new Date(), 4)

      log.info(
        { contactId, agencyId: jobAgencyId, slaDeadline: slaDeadline.toISOString(), score: job.data.score },
        'Processing CRM lead routing job'
      )

      // Update sla_deadline on the corresponding task row via Drizzle.
      // Dynamic import avoids circular deps at module load time and keeps
      // this worker file importable without a live DB connection.
      const [{ withAgencyContext, createAgencyDb }, { crmTasks }, { eq, and }] = await Promise.all([
        import('@mjagency/db'),
        import('@mjagency/db/src/schema/crm.js'),
        import('drizzle-orm'),
      ])

      const agencySlug = jobAgencyId as Parameters<typeof createAgencyDb>[0]
      const dbPassword = process.env[`AGENCY_DB_PASSWORD_${jobAgencyId.toUpperCase()}`]
        ?? process.env['AGENCY_DB_PASSWORD']
        ?? ''
      const db = createAgencyDb(agencySlug, dbPassword)

      await withAgencyContext(db, jobAgencyId, async (tx) => {
        await tx
          .update(crmTasks)
          .set({ slaDeadline: slaDeadline })
          .where(and(eq(crmTasks.contactId, contactId), eq(crmTasks.agencyId, jobAgencyId)))
      })

      // Internal notification: enqueue to 'crm-notifications' queue for the assigned_to user.
      // Twilio SMS dispatch is added in plan 09-06 — this step enqueues an internal job only.
      const notificationQueue = createEncryptedQueue<CrmNotificationJobData>(
        'crm-notifications',
        redisConnection
      )
      await (notificationQueue as unknown as {
        add: (name: string, data: CrmNotificationJobData, opts: Record<string, unknown>) => Promise<void>
      }).add(
        'new-lead-assigned',
        { contactId, agencyId: jobAgencyId, slaDeadline: slaDeadline.toISOString() },
        { sensitiveData: true }
      )

      log.info({ contactId, agencyId: jobAgencyId, slaDeadline: slaDeadline.toISOString() }, 'CRM SLA deadline set + notification enqueued')
    },
    redisConnection
  )
}
