import { NextResponse } from 'next/server'
import { createLogger } from '@mjagency/config'

export const runtime = 'nodejs'
const log = createLogger({ service: 'mjagency-main', agencyId: process.env.AGENCY ?? 'main' })

export async function GET(_request: Request): Promise<NextResponse> {
  log.info({ route: '/api/health' }, 'health check')
  return NextResponse.json({
    ok: true,
    service: `mjagency-${process.env.AGENCY ?? 'main'}`,
    agency: process.env.AGENCY ?? 'main',
  })
}
