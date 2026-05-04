// backend/src/lib/research-ai.ts
// RESEARCH-08: AI idea generation using combined trend + learning context
// TEXT-ONLY prompt (no video frames) — simpler than Phase 5 ai.ts
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { decrypt } from './encryption.js'
import type { TrendItem, ContentIdeaData } from '../db/schema.js'

// ── Types for learning data passed from route handler ─────────────────────────
export interface ResearchAIParams {
  userId: string
  trends: TrendItem[]
  topHooks: Array<{ hook_text: string; max_views: number }>
  topHashtags: Array<{ hashtag: string; avg_views: number }>
  bestNiche: string
  postingTimes: Array<{ dow: number; hour: number; platform: string; avg_views: number }>
  userNiches: string[]
  topic?: string        // optional: user-supplied topic/idea
  instructions?: string // optional: user-supplied scope and instructions
}

// ── Prompt builder ────────────────────────────────────────────────────────────
// RESEARCH-10: Gap warnings are requested from AI using content type analysis cues
export function buildResearchPrompt(params: Omit<ResearchAIParams, 'userId'>): string {
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // T-09-04: Sanitize trend titles — strip backticks and braces to prevent prompt injection
  const sanitize = (s: string) => s.replace(/`/g, "'").replace(/\{|\}/g, '')

  const trendsSection = params.trends.slice(0, 20)
    .map(t => `- ${sanitize(t.title)} (score: ${t.score}, source: ${t.source})`)
    .join('\n') || 'No trend data available'

  const hooksSection = params.topHooks
    .map(h => `- "${sanitize(h.hook_text)}" (${h.max_views} views)`)
    .join('\n') || 'No data yet'

  const hashtagsSection = params.topHashtags
    .map(h => `#${sanitize(h.hashtag)} (${Math.round(h.avg_views)} avg views)`)
    .join(', ') || 'No data yet'

  const timesSection = params.postingTimes.slice(0, 3)
    .map(t => `${DOW_LABELS[t.dow] ?? '?'} ${t.hour}:00 PKT (${t.platform})`)
    .join(', ') || 'No posting time data'

  const topicSection = params.topic
    ? `\nUSER'S TOPIC / IDEA: ${sanitize(params.topic)}`
    : ''
  const instructionsSection = params.instructions
    ? `\nUSER'S SCOPE & INSTRUCTIONS: ${sanitize(params.instructions)}`
    : ''

  return `You are a content strategist for Pakistani short-form video creators.

TRENDING TOPICS (last 24h, Pakistan region):
${trendsSection}

USER'S TOP-PERFORMING HOOKS:
${hooksSection}

USER'S TOP HASHTAGS:
${hashtagsSection}

USER'S BEST NICHE: ${params.bestNiche}
USER'S CONTENT NICHES: ${params.userNiches.join(', ')}
PKT OPTIMAL POSTING WINDOWS: ${timesSection}${topicSection}${instructionsSection}

Generate 5 to 10 content ideas for Pakistani short-form video creators in the niches: ${params.userNiches.join(', ')}.${params.topic ? ` Focus the ideas around the user's topic: "${sanitize(params.topic)}".` : ''}${params.instructions ? ` Follow the user's instructions: ${sanitize(params.instructions)}` : ''}

For face-free outdoor content, include a gapWarning: "expect low face score — compensate with strong hook and high pacing".
For niche-specific content, add relevant gap warnings about common scoring pitfalls.

Return a JSON array with this exact schema:
[{
  "title": "string",
  "angle": "string",
  "hookVariants": ["hook1", "hook2", "hook3"],
  "scriptOutline": "string",
  "keyMoments": [{"timestamp": "0:00", "description": "string"}],
  "brollSuggestions": ["string"],
  "platforms": ["youtube", "instagram"],
  "estimatedStrength": 75,
  "gapWarnings": ["string"],
  "hashtagSuggestions": ["string"]
}]

Use English with natural Urdu code-switching (e.g., "yaar", "bhai", "scene kya hai") for Pakistani audience resonance.
Return ONLY valid JSON. No markdown fences. No explanation text.`
}

// ── Safe JSON parse ───────────────────────────────────────────────────────────
// RESEARCH-09 + Pitfall 8: Strips fences, finds array bounds, parses safely
// exported so research-ai.test.ts can test it directly
export function safeParseIdeas(raw: string): ContentIdeaData[] {
  try {
    const stripped = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/```\s*$/m, '')
      .trim()
    const start = stripped.indexOf('[')
    const end = stripped.lastIndexOf(']')
    if (start === -1 || end === -1 || end <= start) return []
    return JSON.parse(stripped.slice(start, end + 1)) as ContentIdeaData[]
  } catch {
    return []
  }
}

// ── AI provider routing ───────────────────────────────────────────────────────
// Reuses user's ai_provider + encrypted key from settings table (same pattern as ai.ts)
// TEXT-ONLY — no video frames; no Files API needed; no dangerouslyAllowBrowser needed
export async function callResearchAI(params: ResearchAIParams): Promise<ContentIdeaData[]> {
  // Fetch user's AI provider + encrypted API key
  const rows = await db
    .select({ api_key_encrypted: settings.api_key_encrypted, ai_provider: settings.ai_provider })
    .from(settings)
    .where(eq(settings.user_id, params.userId))
    .limit(1)

  if (!rows[0]?.api_key_encrypted) {
    throw new Error('no_api_key_configured')
  }

  let apiKey: string
  try {
    apiKey = decrypt(rows[0].api_key_encrypted)
  } catch {
    throw new Error('key_decrypt_failed')
  }

  const provider = rows[0].ai_provider
  const prompt = buildResearchPrompt(params)
  let rawText = ''

  if (provider === 'openai') {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    rawText = completion.choices[0]?.message?.content ?? ''

  } else if (provider === 'gemini') {
    const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title:             { type: SchemaType.STRING },
              angle:             { type: SchemaType.STRING },
              hookVariants:      { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              scriptOutline:     { type: SchemaType.STRING },
              keyMoments:        { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { timestamp: { type: SchemaType.STRING }, description: { type: SchemaType.STRING } }, required: ['timestamp', 'description'] } },
              brollSuggestions:  { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              platforms:         { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              estimatedStrength: { type: SchemaType.NUMBER },
              gapWarnings:       { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              hashtagSuggestions:{ type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
            required: ['title', 'angle', 'hookVariants', 'scriptOutline', 'keyMoments', 'brollSuggestions', 'platforms', 'estimatedStrength', 'gapWarnings', 'hashtagSuggestions'],
          },
        },
      },
    })
    const result = await model.generateContent(prompt)
    rawText = result.response.text()

  } else if (provider === 'claude') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = msg.content[0]
    rawText = block?.type === 'text' ? block.text : ''

  } else if (provider === 'deepseek') {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' })
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    rawText = completion.choices[0]?.message?.content ?? ''

  } else {
    throw new Error(`unsupported_provider: ${String(provider)}`)
  }

  return safeParseIdeas(rawText)
}
