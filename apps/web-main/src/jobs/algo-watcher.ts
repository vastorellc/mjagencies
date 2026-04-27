/**
 * apps/web-main/src/jobs/algo-watcher.ts
 *
 * BullMQ repeatable worker for RSS algorithm watcher (REQ-074).
 * Registered at server startup in instrumentation.node.ts.
 * Cron: every 6 hours (cron expression: 0 every-6h every-hour every-day every-weekday) per D-13.
 *
 * Feed sources (D-10):
 *   1. Google Search Central blog (hardcoded): https://developers.google.com/search/blog/rss.xml
 *   2. Configurable secondary feed URL(s) from Payload settings.algo_watcher_feeds
 *
 * Keywords (D-11): from Payload settings (instance-level, not per-agency).
 * Default keywords: ['core update', 'helpful content', 'spam', 'ranking', 'algorithm']
 *
 * Idempotency: Redis SADD on seo:algo-watcher:seen-guids per D-13.
 * Pitfall 7: getRepeatableJobs() check before queue.add to prevent duplicate job registration.
 */
import { createEncryptedWorker, createEncryptedQueue } from '@mjagency/queue'
import { processRssFeed } from '@mjagency/seo'
import { Redis } from 'ioredis'

export interface AlgoWatcherJobData {
  // Empty — no input data; all config from Payload settings + env
}

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
const REDIS_OPTS = { host: REDIS_HOST, port: REDIS_PORT }

const GSC_BLOG_FEED = 'https://developers.google.com/search/blog/rss.xml'
const DEFAULT_KEYWORDS = ['core update', 'helpful content', 'spam', 'ranking', 'algorithm']
const ALGO_WATCHER_CRON = '0 */6 * * *'
const ALGO_WATCHER_JOB_NAME = 'check'

export async function registerAlgoWatcher(): Promise<void> {
  // Pitfall 7: idempotency check before registering repeatable job
  const queue = createEncryptedQueue<AlgoWatcherJobData>('seo-algo-watcher', REDIS_OPTS)
  const existingJobs = await (
    queue as unknown as {
      getRepeatableJobs(): Promise<Array<{ name: string; cron?: string; pattern?: string }>>
    }
  ).getRepeatableJobs()
  const alreadyRegistered = existingJobs.some(
    j =>
      j.name === ALGO_WATCHER_JOB_NAME &&
      (j.cron === ALGO_WATCHER_CRON || j.pattern === ALGO_WATCHER_CRON),
  )
  if (!alreadyRegistered) {
    await (
      queue as unknown as {
        add(name: string, data: AlgoWatcherJobData, opts: Record<string, unknown>): Promise<unknown>
      }
    ).add(ALGO_WATCHER_JOB_NAME, {}, { repeat: { cron: ALGO_WATCHER_CRON } })
  }

  createEncryptedWorker<AlgoWatcherJobData>(
    'seo-algo-watcher',
    async (_job) => {
      // Load settings (instance-level: use findOne on any settings record for global config)
      const { getPayload } = await import('payload')
      const config = await import('@payload-config')
      const payload = await getPayload({ config: config.default })

      // Fetch global settings — take first record for instance-level keyword config (D-11)
      const settingsResult = await payload.find({
        collection: 'settings',
        limit: 1,
        overrideAccess: true,
      })

      const firstSetting = settingsResult.docs[0] as Record<string, unknown> | undefined
      const configuredFeeds = (firstSetting?.['algo_watcher_feeds'] as string[] | null) ?? []
      const keywords =
        (firstSetting?.['algo_watcher_keywords'] as string[] | null) ?? DEFAULT_KEYWORDS

      const redis = new Redis(REDIS_OPTS)
      try {
        // Process Google Search Central feed (D-10 — always present)
        const gscAlerts = await processRssFeed(GSC_BLOG_FEED, 'google_search_central', keywords, redis)

        // Process configurable secondary feed(s) (D-10)
        const configurableAlerts: typeof gscAlerts = []
        for (const feedUrl of configuredFeeds) {
          // Security: validate URL is http/https before fetch (SSRF prevention per threat model)
          if (!/^https?:\/\//.test(feedUrl)) {
            console.warn(`[algo-watcher] Skipping non-http feed URL: ${feedUrl}`)
            continue
          }
          const alerts = await processRssFeed(feedUrl, 'configurable_feed', keywords, redis)
          configurableAlerts.push(...alerts)
        }

        const allAlerts = [...gscAlerts, ...configurableAlerts]

        // Create algo_alerts records in Payload for each new match
        for (const alert of allAlerts) {
          try {
            await payload.create({
              collection: 'algo_alerts',
              data: {
                title: alert.title,
                source: alert.source,
                link: alert.link,
                matched_keywords: alert.matchedKeywords,
                snippet: alert.snippet,
                pub_date: alert.pubDate ? new Date(alert.pubDate) : undefined,
                status: 'new',
                guid: alert.guid,
              },
              overrideAccess: true,
            })
          } catch (err) {
            console.error(
              `[algo-watcher] Failed to create alert for "${alert.title}":`,
              (err as Error).message,
            )
            // Continue to next alert
          }
        }

        console.info(`[algo-watcher] Processed ${allAlerts.length} new alerts`)
      } finally {
        await redis.quit()
      }
    },
    REDIS_OPTS,
  )

  console.info('[algo-watcher] Repeatable job registered (cron: 0 */6 * * *)')
}
