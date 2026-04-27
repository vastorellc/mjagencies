/**
 * packages/seo/src/self-learning/worker.ts
 *
 * Self-learning loop worker: pulls GSC + GA4 signals per agency,
 * calls generateContent() as an AI tuner, writes seo_suggestions records.
 *
 * REQ-073: Self-learning loop (signals → AI tuner → suggestions).
 * Runs via BullMQ repeatable job registered in instrumentation.node.ts.
 *
 * GSC/GA4 credentials: per-agency Doppler secrets
 *   GSC_SERVICE_ACCOUNT_KEY_<AGENCY_ID> (JSON string)
 *   GA4_SERVICE_ACCOUNT_KEY_<AGENCY_ID> (JSON string)
 *   GA4_PROPERTY_ID_<AGENCY_ID> (numeric string)
 *
 * Security: credentials read from env; never logged; server-side only.
 * Fallback: if credentials absent for an agency, skip that agency silently.
 */
import { searchconsole, auth as gscAuth } from '@googleapis/searchconsole'
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import type { Payload } from 'payload'

export interface SelfLearningJobData {
  // Empty — all agencies processed in one job run
}

interface GscPageMetrics {
  page: string
  impressions: number
  clicks: number
  ctr: number
  position: number
}

interface Ga4PageMetrics {
  pagePath: string
  bounceRate: number
  avgSessionDuration: number
  sessions: number
}

async function fetchGscMetrics(agencyId: string, siteUrl: string): Promise<GscPageMetrics[]> {
  const keyJson = process.env[`GSC_SERVICE_ACCOUNT_KEY_${agencyId.toUpperCase()}`]
  if (!keyJson) return []
  try {
    // gscAuth.GoogleAuth is the GoogleAuth class (AuthPlus stores it as a static property)
    const authClient = new gscAuth.GoogleAuth({
      credentials: JSON.parse(keyJson) as object,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
    const sc = searchconsole({ version: 'v1', auth: authClient })
    const endDate = new Date().toISOString().slice(0, 10)
    const startDate = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10)
    const res = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 500,
      },
    })
    return (res.data.rows ?? []).map(row => ({
      page: (row.keys ?? [])[0] ?? '',
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }))
  } catch (err) {
    console.error(
      `[seo-self-learning] GSC fetch failed for agency ${agencyId}:`,
      (err as Error).message,
    )
    return []
  }
}

async function fetchGa4Metrics(agencyId: string): Promise<Ga4PageMetrics[]> {
  const keyJson = process.env[`GA4_SERVICE_ACCOUNT_KEY_${agencyId.toUpperCase()}`]
  const propertyId = process.env[`GA4_PROPERTY_ID_${agencyId.toUpperCase()}`]
  if (!keyJson || !propertyId) return []
  try {
    const client = new BetaAnalyticsDataClient({
      credentials: JSON.parse(keyJson) as object,
    })
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'sessions' },
      ],
    })
    return (response.rows ?? []).map(row => ({
      pagePath: row.dimensionValues?.[0]?.value ?? '',
      bounceRate: parseFloat(row.metricValues?.[0]?.value ?? '0'),
      avgSessionDuration: parseFloat(row.metricValues?.[1]?.value ?? '0'),
      sessions: parseInt(row.metricValues?.[2]?.value ?? '0', 10),
    }))
  } catch (err) {
    console.error(
      `[seo-self-learning] GA4 fetch failed for agency ${agencyId}:`,
      (err as Error).message,
    )
    return []
  }
}

export async function runSelfLearningForAgency(
  agencyId: string,
  agencySlug: string,
  siteUrl: string,
  payload: Payload,
): Promise<void> {
  const gscMetrics = await fetchGscMetrics(agencyId, siteUrl)
  const ga4Metrics = await fetchGa4Metrics(agencyId)

  // Need at least some signal data to generate a suggestion
  if (gscMetrics.length === 0 && ga4Metrics.length === 0) {
    console.info(`[seo-self-learning] No signal data for agency ${agencySlug} — skipping`)
    return
  }

  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10)
  const dataWindow = `${startDate} to ${endDate} (28 days)`

  // Build signal summary for AI prompt
  const avgCtr =
    gscMetrics.length > 0
      ? (gscMetrics.reduce((s, r) => s + r.ctr, 0) / gscMetrics.length).toFixed(3)
      : 'n/a'
  const avgPosition =
    gscMetrics.length > 0
      ? (gscMetrics.reduce((s, r) => s + r.position, 0) / gscMetrics.length).toFixed(1)
      : 'n/a'
  const avgBounceRate =
    ga4Metrics.length > 0
      ? (ga4Metrics.reduce((s, r) => s + r.bounceRate, 0) / ga4Metrics.length).toFixed(3)
      : 'n/a'
  const avgSessionDuration =
    ga4Metrics.length > 0
      ? (ga4Metrics.reduce((s, r) => s + r.avgSessionDuration, 0) / ga4Metrics.length).toFixed(0)
      : 'n/a'

  const signalSummary = {
    gscPageCount: gscMetrics.length,
    avgCtr,
    avgPosition,
    ga4PageCount: ga4Metrics.length,
    avgBounceRate,
    avgSessionDuration,
  }

  // AI tuner: use generateContent() from @mjagency/ai (falls back to '' when LiteLLM absent)
  let aiRationale = ''
  let suggestedConfig: Record<string, unknown> = {}
  try {
    const { generateContent } = await import('@mjagency/ai')
    const prompt = `You are an SEO configuration advisor. Based on these performance signals for the agency website, suggest SEO plugin weight adjustments as a JSON object (merge-patch format, only include keys to change).

Agency: ${agencySlug}
Data window: ${dataWindow}
GSC signals: avg CTR=${avgCtr}, avg position=${avgPosition} (${gscMetrics.length} pages)
GA4 signals: avg bounce rate=${avgBounceRate}, avg session duration=${avgSessionDuration}s (${ga4Metrics.length} pages)

Current plugin config keys you can suggest overrides for:
- seo_classic: { titleMinChars, titleMaxChars, metaDescMinChars, metaDescMaxChars, keywordDensityMin, keywordDensityMax, wordCountFloor, internalLinkMin }
- score_thresholds: { seoClassic, aioCitations, geoChunking }

Respond with JSON only: { "suggested_config": { ... }, "rationale": "..." }`
    const result = await generateContent({ prompt, agencySlug, pageType: 'blog', maxTokens: 500 })
    const raw = result.text
    // Parse JSON from LiteLLM response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      suggestedConfig = (parsed['suggested_config'] as Record<string, unknown>) ?? {}
      aiRationale = (parsed['rationale'] as string) ?? raw.slice(0, 500)
    }
  } catch {
    aiRationale = 'AI tuner unavailable — signal data captured for manual review.'
  }

  // Write suggestion to Payload (overrideAccess:true — worker is system-level)
  await payload.create({
    collection: 'seo_suggestions',
    data: {
      agency_slug: agencySlug,
      suggestion_type: 'weight_adjustment',
      status: 'pending_review',
      signal_summary: signalSummary,
      suggested_config: suggestedConfig,
      ai_rationale: aiRationale,
      data_window: dataWindow,
    },
    overrideAccess: true,
  })

  console.info(`[seo-self-learning] Suggestion created for ${agencySlug}`)
}
