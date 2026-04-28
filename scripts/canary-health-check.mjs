#!/usr/bin/env node
/**
 * scripts/canary-health-check.mjs
 * Polls GET /api/health for all 12 agency deployments.
 * Usage: node scripts/canary-health-check.mjs --base-domain=mjagency.com [--timeout=30] [--help]
 * Exit codes: 0 = all healthy, 1 = one or more unhealthy after timeout
 */

const AGENCY_SLUGS = [
  'web-ai', 'web-branding', 'web-construction', 'web-dental',
  'web-ecommerce', 'web-financial', 'web-fitness', 'web-homeservices',
  'web-legal', 'web-realestate', 'web-restaurant', 'web-spa',
]

const HELP = `
canary-health-check.mjs — polls /api/health for all 12 MJAgency deployments

Usage:
  node scripts/canary-health-check.mjs --base-domain=<domain> [--timeout=<seconds>] [--help]

Options:
  --base-domain=<domain>   Base domain (e.g., mjagency.com). Checks https://{slug}.{domain}/api/health
  --timeout=<seconds>      Poll window in seconds (default: 30)
  --help                   Show this message

Agencies checked:
  ${AGENCY_SLUGS.join(', ')}
`.trim()

function parseArgs(argv) {
  const args = argv.slice(2)
  const domainArg = args.find(a => a.startsWith('--base-domain='))
  const timeoutArg = args.find(a => a.startsWith('--timeout='))
  return {
    help: args.includes('--help'),
    baseDomain: domainArg ? domainArg.split('=')[1] : null,
    timeoutMs: timeoutArg ? parseInt(timeoutArg.split('=')[1], 10) * 1000 : 30_000,
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) { console.log(HELP); process.exit(0) }
  if (!args.baseDomain) {
    console.error('Error: --base-domain is required')
    console.log(HELP)
    process.exit(1)
  }

  const { baseDomain, timeoutMs } = args
  const deadline = Date.now() + timeoutMs
  const failed = new Set(AGENCY_SLUGS)

  console.log(`[health-check] Polling ${AGENCY_SLUGS.length} agencies (timeout: ${timeoutMs / 1000}s)`)

  while (Date.now() < deadline && failed.size > 0) {
    await new Promise(r => setTimeout(r, 2000))
    for (const slug of [...failed]) {
      try {
        const res = await fetch(`https://${slug}.${baseDomain}/api/health`)
        if (res.status === 200) {
          failed.delete(slug)
          console.log(`[health-check] OK: ${slug}`)
        }
      } catch { /* still unhealthy — retry next loop */ }
    }
    console.log(`[health-check] ${AGENCY_SLUGS.length - failed.size}/${AGENCY_SLUGS.length} healthy`)
  }

  if (failed.size > 0) {
    const failedList = [...failed].join(', ')
    console.error(`[health-check] FAILED: ${failedList} did not return 200 within ${timeoutMs / 1000}s`)
    console.error(`::error::canary health check failed: ${failedList}`)
    process.exit(1)
  }

  console.log('[health-check] All 12 agencies healthy.')
  process.exit(0)
}

main().catch(err => {
  console.error('[health-check] Unexpected error:', err)
  process.exit(1)
})
