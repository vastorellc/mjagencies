/**
 * scripts/seed-tool-pages.ts
 *
 * Seeds 36 tool landing pages into Payload CMS via REST API.
 * REQ-121: 2200+ words per page, full SEO/AIO content.
 * REQ-201: word count floor enforced — rejects pages under 2200 words.
 * REQ-124: benchmark citations included in content.
 *
 * Usage:
 *   pnpm tsx scripts/seed-tool-pages.ts --agency=ecommerce
 *   pnpm tsx scripts/seed-tool-pages.ts --all
 *
 * Python3 unavailable on this machine — Node.js ESM only (STATE.md decision).
 * Content generated via packages/ai generateContent() → LiteLLM flash-lite.
 * Pages written via Payload REST API (not direct DB) per CLAUDE.md content rules.
 */
import { generateContent } from '../packages/ai/src/generate-content.js'
import { ALL_TOOLS, getToolsByAgency } from '../packages/tools/src/tools/index.js'
import type { ToolDefinition } from '../packages/tools/src/engine/types.js'

const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''
const MIN_WORD_COUNT = 2200
// Fail fast if more than MAX_FAILURES tool content generations fail
const MAX_FAILURES = 3

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

interface ToolPageContent {
  title: string
  metaDescription: string
  aioTldr: string
  bodyContent: string
  faqs: Array<{ question: string; answer: string }>
}

async function generateToolPageContent(tool: ToolDefinition): Promise<ToolPageContent> {
  const prompt = `
Write a comprehensive ${MIN_WORD_COUNT}-word+ educational landing page for the "${tool.name}" tool for a ${tool.agencySlug} agency.

Requirements:
- Exactly one H1 (the tool name)
- At least 4 H2 sections: What Is ${tool.name}?, How to Use This Calculator, Understanding Your Results, Industry Benchmarks
- 2200+ total words of real educational content — NO placeholder text
- Include specific industry statistics with source citations (cite: real industry publications)
- 3+ internal links to other agency pages (use relative paths like /services, /about, /contact)
- FTC disclaimer if any results-related claims are made
- End with a clear CTA section

Also provide:
1. A meta description (150-160 characters max)
2. An AIO TL;DR (≤120 characters — required for AIO indexing)
3. Exactly 5 FAQ pairs (question + answer, each answer 50-100 words)

Format your response as JSON:
{
  "title": "string",
  "metaDescription": "string (150-160 chars)",
  "aioTldr": "string (≤120 chars)",
  "bodyContent": "string (HTML with <h2>, <p>, <ul>, <strong> — no <h1>, no inline styles)",
  "faqs": [{"question": "string", "answer": "string"}, ...]
}
`
  const result = await generateContent({
    agencySlug: tool.agencySlug,
    prompt,
    pageType: 'tool',
    maxTokens: 4000,
    agencyId: tool.agencySlug,
    tier: 'tier1-bulk',
  })

  const raw = result.text

  let parsed: ToolPageContent

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    parsed = JSON.parse(jsonMatch[0]) as ToolPageContent
  } catch {
    throw new Error(`Failed to parse content JSON for tool: ${tool.slug}`)
  }

  const wordCount = countWords(parsed.bodyContent)
  if (wordCount < MIN_WORD_COUNT) {
    throw new Error(
      `Tool page for ${tool.slug} has only ${wordCount} words — minimum is ${MIN_WORD_COUNT}. Regenerate.`,
    )
  }

  // Enforce AIO TL;DR length ≤120 characters
  if (parsed.aioTldr.length > 120) {
    parsed.aioTldr = parsed.aioTldr.substring(0, 117) + '...'
  }

  return parsed
}

async function upsertToolPage(tool: ToolDefinition, content: ToolPageContent): Promise<void> {
  const slug = `/tools/${tool.slug}`

  const existingRes = await fetch(
    `${PAYLOAD_URL}/api/pages?where[slug][equals]=${encodeURIComponent(slug)}&where[agency_id][equals]=${tool.agencySlug}&limit=1`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
  )
  const existingData = (await existingRes.json()) as { docs: Array<{ id: string }> }

  const pageData = {
    title: content.title,
    slug,
    agency_id: tool.agencySlug,
    status: 'published',
    meta_title: content.title,
    meta_description: content.metaDescription,
    aio_tldr: content.aioTldr,
    faqs: content.faqs,
    blocks: [
      {
        blockType: 'richtext',
        content: content.bodyContent,
      },
    ],
    tool_slug: tool.slug,
    tool_agency_slug: tool.agencySlug,
  }

  if (existingData.docs.length > 0) {
    const id = existingData.docs[0]!.id
    await fetch(`${PAYLOAD_URL}/api/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PAYLOAD_API_KEY}`,
      },
      body: JSON.stringify(pageData),
    })
    console.log(`[update] ${slug}`)
  } else {
    await fetch(`${PAYLOAD_URL}/api/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PAYLOAD_API_KEY}`,
      },
      body: JSON.stringify(pageData),
    })
    console.log(`[create] ${slug}`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const agencyArg = args.find((a) => a.startsWith('--agency='))?.split('=')[1]
  const allFlag = args.includes('--all')

  if (!allFlag && !agencyArg) {
    console.error('Usage: pnpm tsx scripts/seed-tool-pages.ts --agency=ecommerce | --all')
    process.exit(1)
  }

  const tools = allFlag ? ALL_TOOLS : getToolsByAgency(agencyArg!)

  if (tools.length === 0) {
    console.error(`No tools found for agency: ${agencyArg}`)
    process.exit(1)
  }

  console.log(`Seeding ${tools.length} tool pages...`)

  let failureCount = 0

  for (const tool of tools) {
    try {
      console.log(`Generating content for: ${tool.slug}`)
      const content = await generateToolPageContent(tool)
      await upsertToolPage(tool, content)
      console.log(`Done: ${tool.slug}`)
    } catch (err) {
      failureCount++
      console.error(`FAILED: ${tool.slug}`, err)
      // If more than MAX_FAILURES (3) tools fail, abort with non-zero exit
      if (failureCount > MAX_FAILURES) {
        console.error(
          `ERROR: ${failureCount} tool content generations failed (threshold: ${MAX_FAILURES}). Aborting seed.`,
        )
        process.exit(1)
      }
    }
  }

  if (failureCount > 0) {
    console.warn(
      `Completed with ${failureCount} failure(s) — within acceptable threshold of ${MAX_FAILURES}.`,
    )
  }
  console.log('Tool page seeding complete.')
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
