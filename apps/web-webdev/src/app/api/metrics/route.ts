import { NextResponse } from 'next/server'
import { createMetrics } from '@mjagency/config'

export const runtime = 'nodejs'

const metricsInstance = createMetrics({ agencyId: process.env.AGENCY ?? 'webdev' })

export async function GET(): Promise<NextResponse> {
  const body = await metricsInstance.register.metrics()
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': metricsInstance.register.contentType },
  })
}
