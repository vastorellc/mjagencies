import { Router, type Request, type Response } from 'express'
import OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { decrypt } from '../lib/encryption.js'

export const aiRouter = Router()

interface AIGenerateBody {
  prompt: string
  frames?: string[]  // base64 JPEG strings; omit on second pass per D-05
}

aiRouter.post('/generate', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { prompt, frames } = req.body as AIGenerateBody

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt_required' })
    return
  }

  const rows = await db.select({
    api_key_encrypted: settings.api_key_encrypted,
    ai_provider: settings.ai_provider,
  }).from(settings).where(eq(settings.user_id, userId)).limit(1)

  if (!rows[0]?.api_key_encrypted) {
    res.status(400).json({ error: 'no_api_key' })
    return
  }

  let apiKey: string
  try {
    apiKey = decrypt(rows[0].api_key_encrypted)
  } catch {
    res.status(500).json({ error: 'key_decrypt_failed' })
    return
  }

  const provider = rows[0].ai_provider ?? 'openai'

  if (provider !== 'openai' && provider !== 'deepseek') {
    res.status(400).json({ error: 'provider_not_supported_by_proxy' })
    return
  }

  const isDeepSeek = provider === 'deepseek'
  const openai = new OpenAI({
    apiKey,
    ...(isDeepSeek ? { baseURL: 'https://api.deepseek.com/v1' } : {}),
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

  const model = isDeepSeek ? 'deepseek-chat' : 'gpt-4.1'

  const completion = await openai.chat.completions.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
  })

  const rawText = completion.choices[0]?.message?.content ?? ''
  // T-5-01: Return only the AI text — never apiKey, never model, never settings row
  res.json({ text: rawText })
})
