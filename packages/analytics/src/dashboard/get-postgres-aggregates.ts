/**
 * packages/analytics/src/dashboard/get-postgres-aggregates.ts
 *
 * REQ-143 + D-12: Postgres aggregate queries for CRM + invoicing KPIs.
 * Phase 9 crm_contacts + crm_deals (note: actual table names are prefixed `crm_`).
 * Phase 10 invoices (status enum: draft|sent|viewed|paid|partial|refunded|disputed).
 *
 * All aggregates run inside withAgencyContext so app.agency_id RLS is set
 * transaction-locally (CLAUDE.md §8 + Pitfall 8.1 from Plan 02-01).
 */
import 'server-only'
import { sql } from 'drizzle-orm'
import { withAgencyContext } from '@mjagency/db'
import type { AgencyDbContext } from './get-rum-percentiles.js'

/** Count of crm_contacts created in the last `days` days for the agency. */
export async function getLeadsCount(ctx: AgencyDbContext, days = 7): Promise<number> {
  const result = await withAgencyContext(ctx.db, ctx.agencyId, async (tx) => {
    return tx.execute<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM crm_contacts
      WHERE agency_id = ${ctx.agencyId}::uuid
        AND created_at > NOW() - make_interval(days => ${days}::int)
    `)
  })
  const rows = (result as unknown as { rows?: Array<{ c: number }> }).rows ?? []
  return rows[0]?.c ?? 0
}

/** Sum of crm_deals.value for deals NOT in won/lost stage. */
export async function getOpenPipelineValue(ctx: AgencyDbContext): Promise<number> {
  const result = await withAgencyContext(ctx.db, ctx.agencyId, async (tx) => {
    return tx.execute<{ s: number | null }>(sql`
      SELECT COALESCE(sum(value), 0)::double precision AS s FROM crm_deals
      WHERE agency_id = ${ctx.agencyId}::uuid
        AND stage NOT IN ('won','lost')
    `)
  })
  const rows = (result as unknown as { rows?: Array<{ s: number | null }> }).rows ?? []
  return rows[0]?.s ?? 0
}

/** Count of crm_deals NOT in won/lost stage. */
export async function getOpenPipelineCount(ctx: AgencyDbContext): Promise<number> {
  const result = await withAgencyContext(ctx.db, ctx.agencyId, async (tx) => {
    return tx.execute<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM crm_deals
      WHERE agency_id = ${ctx.agencyId}::uuid
        AND stage NOT IN ('won','lost')
    `)
  })
  const rows = (result as unknown as { rows?: Array<{ c: number }> }).rows ?? []
  return rows[0]?.c ?? 0
}

/** Sum of paid invoices total_amount for the current calendar month. */
export async function getRevenueMtd(
  ctx: AgencyDbContext,
): Promise<{ amount: number; invoiceCount: number }> {
  const result = await withAgencyContext(ctx.db, ctx.agencyId, async (tx) => {
    return tx.execute<{ amount: number | null; cnt: number }>(sql`
      SELECT
        COALESCE(sum(total_amount), 0)::double precision AS amount,
        count(*)::int AS cnt
      FROM invoices
      WHERE agency_id = ${ctx.agencyId}::uuid
        AND status = 'paid'
        AND paid_at > date_trunc('month', NOW())
    `)
  })
  const rows = (result as unknown as { rows?: Array<{ amount: number | null; cnt: number }> }).rows ?? []
  return { amount: rows[0]?.amount ?? 0, invoiceCount: rows[0]?.cnt ?? 0 }
}

/**
 * Week-over-week leads delta as a percent.
 * Returns positive number for growth (e.g. +12 = 12% more leads vs prior week).
 * If prior week had zero leads and this week has any leads, returns 100.
 */
export async function getLeadsTrendWoW(ctx: AgencyDbContext): Promise<number> {
  const thisWeek = await getLeadsCount(ctx, 7)
  const result = await withAgencyContext(ctx.db, ctx.agencyId, async (tx) => {
    return tx.execute<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM crm_contacts
      WHERE agency_id = ${ctx.agencyId}::uuid
        AND created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
    `)
  })
  const rows = (result as unknown as { rows?: Array<{ c: number }> }).rows ?? []
  const priorWeek = rows[0]?.c ?? 0
  if (priorWeek === 0) return thisWeek > 0 ? 100 : 0
  return Math.round(((thisWeek - priorWeek) / priorWeek) * 100)
}
