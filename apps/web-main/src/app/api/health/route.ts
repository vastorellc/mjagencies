import { NextResponse } from 'next/server'
import { trace } from '@opentelemetry/api'
import { createLogger } from '@mjagency/config'

export const runtime = 'nodejs'
const log = createLogger({ service: 'mjagency-main', agencyId: process.env.AGENCY ?? 'main' })

export async function GET(req: Request): Promise<NextResponse> {
  const span = trace.getActiveSpan()
  const traceId = span?.spanContext().traceId
  log.info({ route: '/api/health', traceparent: req.headers.get('traceparent'), trace_id: traceId }, 'health check')
  return NextResponse.json({
    ok: true,
    service: `mjagency-${process.env.AGENCY ?? 'main'}`,
    agency: process.env.AGENCY ?? 'main',
    trace_id: traceId,
  })
}
