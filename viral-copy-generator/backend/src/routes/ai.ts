import { Router, type Request, type Response } from 'express'
import OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { decrypt } from '../lib/encryption.js'
import { ValidationError, DatabaseError, StorageError, AIProviderError } from '../lib/errors.js'
import { MODELS } from '../lib/models.js'

export const aiRouter = Router()

interface AIGenerateBody {
  prompt: string
  frames?: string[]  // base64 JPEG strings; omit on second pass per D-05
}

aiRouter.post('/generate', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { prompt, frames } = req.body as AIGenerateBody

  if (!prompt || typeof prompt !== 'string') {
    throw new ValidationError('Prompt is required', 'Empty or missing prompt in request body', { field: 'prompt' })
  }

  let rows: Array<{ api_key_encrypted: string | null; ai_provider: string | null }>
  try {
    rows = await db.select({
      api_key_encrypted: settings.api_key_encrypted,
      ai_provider: settings.ai_provider,
    }).from(settings).where(eq(settings.user_id, userId)).limit(1)
  } catch (err) {
    throw new DatabaseError(
      'Failed to load settings',
      `Could not fetch user settings: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  if (!rows[0]?.api_key_encrypted) {
    throw new ValidationError(
      'API key not configured. Add it in Settings.',
      'User has no API key_encrypted in settings row',
      { field: 'api_key' }
    )
  }

  let apiKey: string
  try {
    apiKey = decrypt(rows[0].api_key_encrypted)
  } catch (err) {
    throw new StorageError(
      'Failed to decrypt API key',
      `Decryption error: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  const provider = rows[0].ai_provider ?? 'openai'

  if (provider !== 'openai' && provider !== 'deepseek') {
    throw new ValidationError(
      `Provider "${provider}" is not supported by this proxy`,
      `Provider ${provider} not in allowed list: [openai, deepseek]`,
      { field: 'ai_provider' }
    )
  }

  const isDeepSeek = provider === 'deepseek'
  const openai = new OpenAI({
    apiKey,
    ...(isDeepSeek ? { baseURL: 'https://api.deepseek.com' } : {}),
  })

  type ContentPart = OpenAI.Chat.ChatCompletionContentPart
  const content: ContentPart[] = []

  if (frames?.length && !isDeepSeek) {
    for (const b64 of frames) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${b64}` },
      })
    }
  }
  content.push({ type: 'text', text: prompt })

  const model = isDeepSeek ? MODELS['deepseek-v4-flash'].id : MODELS['gpt-5.5'].id

  try {
    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
    })

    const rawText = completion.choices[0]?.message?.content ?? ''
    // T-5-01: Return only the AI text — never apiKey, never model, never settings row
    res.json({ text: rawText })
  } catch (err) {
    // Parse OpenAI/DeepSeek errors
    let userMessage = 'AI service is unavailable. Please try again.'
    let retryable = false

    if (err instanceof OpenAI.APIError) {
      const status = err.status
      const code = (err as { code?: string }).code ?? err.message

      if (status === 401 || code === 'invalid_api_key') {
        userMessage = 'Invalid API key. Update it in Settings.'
      } else if (status === 404 || code === 'model_not_found') {
        userMessage = 'Selected model unavailable. Update in Settings.'
        retryable = false
      } else if (status === 429 || code === 'rate_limit_error') {
        userMessage = 'Rate limited. Please wait a few minutes and try again.'
        retryable = true
      } else if (code === 'tokens_per_min_limit_exceeded') {
        userMessage = 'Exceeded token limit. Please try again in a moment.'
        retryable = true
      } else if (code === 'insufficient_quota' || code === 'quota_exceeded') {
        userMessage = 'API quota exceeded. Add credits to your provider account.'
      } else if (status === 500 || status === 502 || status === 503) {
        userMessage = 'AI service is temporarily unavailable. Please try again soon.'
        retryable = true
      }
    }

    throw new AIProviderError(
      userMessage,
      `Provider error from ${provider}: ${err instanceof Error ? err.message : String(err)}`,
      { original: err, retryable }
    )
  }
})
