import type { AgencySlug } from './agency-seed-manifest.js'

export interface SeedResult {
  seeded: number
  skipped: number
  errors: string[]
}

export async function seedPayloadCollection(opts: {
  baseUrl: string
  collection: string
  records: unknown[]
  jwtToken: string
}): Promise<SeedResult> {
  const { baseUrl, collection, records, jwtToken } = opts
  const result: SeedResult = { seeded: 0, skipped: 0, errors: [] }

  for (const record of records) {
    try {
      const r = record as Record<string, unknown>
      const slug = String(r['slug'] ?? '')
      if (slug) {
        const checkRes = await fetch(
          `${baseUrl}/api/${collection}?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
          { headers: { Authorization: `Bearer ${jwtToken}` } }
        )
        if (checkRes.ok) {
          const data = await checkRes.json() as { docs?: unknown[] }
          if ((data.docs?.length ?? 0) > 0) { result.skipped++; continue }
        }
      }
      const createRes = await fetch(`${baseUrl}/api/${collection}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })
      if (!createRes.ok) {
        result.errors.push(`${collection}/${slug}: HTTP ${createRes.status}`)
      } else {
        result.seeded++
      }
    } catch (err) {
      result.errors.push(`${collection}: ${String(err)}`)
    }
  }
  return result
}

// CLI entry point — invoked by seed-all-agencies.mjs via execSync
if (import.meta.url === `file://${process.argv[1]}`) {
  const agencyArg = process.argv.find((a) => a.startsWith('--agency='))
  if (!agencyArg) {
    console.error('seed-payload-collections: --agency=<slug> is required')
    process.exit(1)
  }
  const agencySlug = agencyArg.split('=')[1] as AgencySlug
  const baseUrl = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
  const jwtToken = process.env['SEED_JWT_TOKEN'] ?? ''
  if (!jwtToken) {
    console.error('seed-payload-collections: SEED_JWT_TOKEN env var is required')
    process.exit(1)
  }
  import('./agency-seed-manifest.js')
    .then(({ AGENCY_SEED_MANIFEST, validateAgencySeedImages }) => {
      try {
        validateAgencySeedImages()
      } catch (err) {
        console.error('seed-payload-collections: IMAGE SEED GATE FAILED — run image pipeline first')
        console.error(String((err as { cause?: unknown }).cause ?? err))
        process.exit(1)
      }
      const manifest = AGENCY_SEED_MANIFEST[agencySlug]
      if (!manifest) {
        console.error(`seed-payload-collections: unknown agency slug "${agencySlug}"`)
        process.exit(1)
      }
      const collections: Array<{ name: string; records: unknown[] }> = [
        { name: 'pages', records: manifest.pages },
        { name: 'services', records: manifest.services },
        { name: 'tools', records: manifest.tools },
        { name: 'team', records: manifest.team },
        { name: 'testimonials', records: manifest.testimonials },
        { name: 'faqs', records: manifest.faqs },
        { name: 'blog-posts', records: manifest.blogPosts },
        { name: 'case-studies', records: manifest.caseStudies },
      ]
      return collections.reduce(
        (chain, col) =>
          chain.then(() =>
            seedPayloadCollection({ baseUrl, collection: col.name, records: col.records, jwtToken }).then(
              (r) => { console.log(`[${agencySlug}] ${col.name}: seeded=${r.seeded} skipped=${r.skipped} errors=${r.errors.length}`) }
            )
          ),
        Promise.resolve()
      )
    })
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1) })
}
