/**
 * infra/sgtm-worker/src/index.ts
 * REQ-140: Cloudflare Worker reverse proxy for server-side GTM (sGTM).
 * Forwards analytics.{agency_subdomain}/* requests to per-agency Cloud Run sGTM target.
 *
 * Same-origin to first-party domain: keeps the GA4 collection beacon on a domain the
 * browser treats as first-party, defeating tracking-prevention heuristics that block
 * known third-party analytics CDNs.
 *
 * Pitfall 1.5 (T-11-01-06 mitigation):
 *   - Preserves CF-Connecting-IP (trusted Cloudflare header) via X-Forwarded-For
 *     so the sGTM Cloud Run target sees the real client IP for accurate geo.
 *   - Rejects unknown subdomains with 400 — prevents arbitrary host smuggling.
 *
 * Hostname pattern: analytics.{slug}.{root}
 *   slug must match /^web-[a-z]+$/  (the platform's app slug convention)
 *   root is anything (mjagency.com, dev.mjagency.com, preview-*.pages.dev, etc.)
 *
 * Env vars (per-agency, set via `wrangler secret put SGTM_TARGET_<SLUG_UPPER>`):
 *   SGTM_TARGET_WEB_ECOMMERCE  = https://sgtm-web-ecommerce-xyz.run.app
 *   SGTM_TARGET_WEB_HEALTHCARE = https://sgtm-web-healthcare-abc.run.app
 *   ... etc
 */

export interface Env {
  // Per-agency Cloud Run target. Worker reads SGTM_TARGET_<SLUG_UPPER> based on hostname.
  [key: string]: string | undefined
}

const ANALYTICS_HOST_RE = /^analytics\.(web-[a-z]+)\./

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const match = url.hostname.match(ANALYTICS_HOST_RE)
    if (!match) {
      return new Response('Bad Request: unknown analytics subdomain', { status: 400 })
    }

    const slug = match[1]!
    const slugUpper = slug.replaceAll('-', '_').toUpperCase()
    const target = env[`SGTM_TARGET_${slugUpper}`]
    if (!target) {
      return new Response('sGTM target not configured', { status: 503 })
    }

    const sgtmUrl = `${target}${url.pathname}${url.search}`

    // Pitfall 1.5: preserve client IP for accurate Cloud Run geo.
    // CF-Connecting-IP is set by Cloudflare's edge and cannot be spoofed by clients.
    const headers = new Headers(request.headers)
    const cfIp = request.headers.get('CF-Connecting-IP') ?? ''
    if (cfIp) headers.set('X-Forwarded-For', cfIp)
    headers.set('X-Forwarded-Proto', 'https')
    headers.set('X-Forwarded-Host', url.hostname)

    // Body must be undefined for GET/HEAD per fetch spec.
    const body =
      request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body

    return fetch(sgtmUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    })
  },
} satisfies ExportedHandler<Env>
