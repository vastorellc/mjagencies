#!/usr/bin/env tsx
/**
 * scripts/content-sprint/seed-agency-content.ts
 *
 * Content sprint seed script (REQ-505).
 * Seeds the ecommerce agency with all required page types, posts, and author profile.
 *
 * Usage:
 *   pnpm tsx scripts/content-sprint/seed-agency-content.ts
 *   pnpm tsx scripts/content-sprint/seed-agency-content.ts --agency ecommerce
 *   pnpm tsx scripts/content-sprint/seed-agency-content.ts --dry-run
 *
 * Requirements:
 *   - DATABASE_URL env var pointing to ecommerce agency Postgres
 *   - PAYLOAD_SECRET env var
 *   - LITELLM_API_URL (optional — falls back to stub if missing)
 *
 * Content-Complete Rule (CLAUDE.md §5): All content must be real and complete.
 * Anti-Fabrication Rule (CLAUDE.md §6): No invented stats, no fake clients.
 * Failed saves do not block other items (error isolation per CLAUDE.md content sprint).
 */
import { getPayload } from 'payload'
import { generateContent } from '@mjagency/ai'
import { computeSeoScoreForContent } from '@mjagency/seo'
import { runContentValidators } from './validators.js'
import { ECOMMERCE_CONTENT_SPEC } from './agency-content-map.js'
import type { AgencyContentSpec, PageSpec, PostSpec } from './agency-content-map.js'

const args = process.argv.slice(2)
const agencyArg = args[args.indexOf('--agency') + 1] ?? 'ecommerce'
const isDryRun = args.includes('--dry-run')

console.info(`[Content Sprint] Starting seed for agency: ${agencyArg}${isDryRun ? ' (DRY RUN)' : ''}`)

const SPECS: Record<string, AgencyContentSpec> = {
  ecommerce: ECOMMERCE_CONTENT_SPEC,
}

const spec = SPECS[agencyArg]
if (!spec) {
  console.error(`[Content Sprint] No content spec found for agency: ${agencyArg}`)
  console.error(`Available agencies: ${Object.keys(SPECS).join(', ')}`)
  process.exit(1)
}

const configModule = await import('../../apps/web-main/payload.config.js')
const payload = await getPayload({ config: configModule.default })

async function upsertAgencySettings(agencyId: string): Promise<void> {
  const existing = await payload.find({
    collection: 'settings',
    where: { agency_id: { equals: agencyId } },
    limit: 1,
  })
  const settingsData = {
    agency_id: agencyId,
    site_name: spec.siteName,
    site_url: `https://${agencyArg}.brand.com`,
    default_meta_title: `${spec.siteName} | ${spec.niche}`,
    default_meta_description: `${spec.siteName} specializes in ${spec.niche.toLowerCase()} solutions for growing businesses.`,
    brand_voice: `Professional, data-driven, results-focused. Use ranges for metrics. Never invent statistics.`,
  }
  if (existing.docs.length > 0) {
    await payload.update({ collection: 'settings', id: String(existing.docs[0]!.id), data: settingsData })
  } else {
    await payload.create({ collection: 'settings', data: settingsData })
  }
  console.info(`[Content Sprint] Settings upserted for ${agencyArg}`)
}

async function seedAuthor(agencyId: string): Promise<string> {
  const existing = await payload.find({
    collection: 'authors',
    where: { agency_id: { equals: agencyId } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.info(`[Content Sprint] Author already exists: ${String(existing.docs[0]!.id)}`)
    return String(existing.docs[0]!.id)
  }
  const author = await payload.create({
    collection: 'authors',
    data: {
      agency_id: agencyId,
      name: spec.author.name,
      slug: spec.author.name.toLowerCase().replace(/\s+/g, '-'),
      bio: spec.author.bio,
      role: spec.author.role,
    },
  })
  console.info(`[Content Sprint] Author created: ${String(author.id)}`)
  return String(author.id)
}

async function seedPage(agencyId: string, pageSpec: PageSpec): Promise<void> {
  const existing = await payload.find({
    collection: 'pages',
    where: { agency_id: { equals: agencyId }, slug: { equals: pageSpec.slug } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.info(`[Content Sprint] Page already exists: ${pageSpec.slug}`)
    return
  }

  const generated = await generateContent({
    prompt: pageSpec.promptHint,
    agencySlug: spec.agencySlug,
    pageType: pageSpec.pageType,
    maxTokens: Math.ceil(pageSpec.wordCountFloor * 1.5),
  })

  const validation = runContentValidators(generated.text, {
    wordCountFloor: pageSpec.wordCountFloor,
    requiresFtcDisclaimer: pageSpec.requiresFtcDisclaimer,
    isPublish: true,
  })

  if (!validation.valid) {
    console.error(`[Content Sprint] Validation FAILED for ${pageSpec.slug}:`, validation.errors)
    console.error('[Content Sprint] Skipping this page — seed continues for other items')
    return // Failed saves do not block other items
  }

  if (validation.warnings.length > 0) {
    console.warn(`[Content Sprint] Warnings for ${pageSpec.slug}:`, validation.warnings)
  }

  const seoScore = computeSeoScoreForContent(
    { text: generated.text, metaTitle: pageSpec.title },
    pageSpec.wordCountFloor
  )
  console.info(`[Content Sprint] ${pageSpec.slug} — words: ${validation.wordCount}, SEO: ${seoScore.seoScore}, links: ${validation.internalLinkCount}`)

  if (isDryRun) {
    console.info(`[Content Sprint] DRY RUN — would create page: ${pageSpec.title}`)
    return
  }

  await payload.create({
    collection: 'pages',
    data: {
      agency_id: agencyId,
      title: pageSpec.title,
      slug: pageSpec.slug,
      status: 'published',
      page_type: pageSpec.pageType,
      content: { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: generated.text }] }] } },
      meta_title: pageSpec.title.slice(0, 60),
      meta_description: generated.text.slice(0, 160),
    },
  })
  console.info(`[Content Sprint] Page created: ${pageSpec.title}`)
}

async function seedPost(agencyId: string, authorId: string, postSpec: PostSpec): Promise<void> {
  const existing = await payload.find({
    collection: 'posts',
    where: { agency_id: { equals: agencyId }, slug: { equals: postSpec.slug } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.info(`[Content Sprint] Post already exists: ${postSpec.slug}`)
    return
  }

  const generated = await generateContent({
    prompt: postSpec.promptHint,
    agencySlug: spec.agencySlug,
    pageType: 'blog',
    maxTokens: Math.ceil(postSpec.wordCountFloor * 1.5),
  })

  const validation = runContentValidators(generated.text, {
    wordCountFloor: postSpec.wordCountFloor,
    isPublish: true,
  })

  if (!validation.valid) {
    console.error(`[Content Sprint] Validation FAILED for ${postSpec.slug}:`, validation.errors)
    return // Failed saves do not block other items
  }

  if (isDryRun) {
    console.info(`[Content Sprint] DRY RUN — would create post: ${postSpec.title}`)
    return
  }

  await payload.create({
    collection: 'posts',
    data: {
      agency_id: agencyId,
      title: postSpec.title,
      slug: postSpec.slug,
      status: 'published',
      author: authorId,
      content: { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: generated.text }] }] } },
      excerpt: generated.text.slice(0, 160),
      meta_title: postSpec.title.slice(0, 60),
      meta_description: generated.text.slice(0, 160),
    },
  })
  console.info(`[Content Sprint] Post created: ${postSpec.title}`)
}

async function main(): Promise<void> {
  const agencyId = process.env['ECOMMERCE_AGENCY_ID'] ?? 'ecommerce-placeholder-uuid'

  try {
    await upsertAgencySettings(agencyId)
    const authorId = await seedAuthor(agencyId)

    for (const pageSpec of spec.pages) {
      try {
        await seedPage(agencyId, pageSpec)
      } catch (err) {
        console.error(`[Content Sprint] Error seeding page ${pageSpec.slug}:`, err)
        // Continue with next item
      }
    }

    for (const postSpec of spec.posts) {
      try {
        await seedPost(agencyId, authorId, postSpec)
      } catch (err) {
        console.error(`[Content Sprint] Error seeding post ${postSpec.slug}:`, err)
      }
    }

    console.info(`[Content Sprint] Seed complete for ${agencyArg} agency`)
  } finally {
    await (payload.db as { destroy?: () => Promise<void> }).destroy?.()
  }
}

main().catch((err) => {
  console.error('[Content Sprint] Fatal error:', err)
  process.exit(1)
})
