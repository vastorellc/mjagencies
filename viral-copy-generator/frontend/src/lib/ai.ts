import { GoogleGenAI, type Content } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import type { AIOutput, AIProvider, AIProxyBody } from './types'
import { proxyAIGenerate } from './api'

// ============================================================================
// Gemini response schema — mirrors D-03 AIOutput exactly (AI-06)
// BOTH responseMimeType AND responseSchema required per CLAUDE.md + AI-06.
// ============================================================================
const AI_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    youtube: {
      type: 'object',
      properties: {
        title:       { type: 'string' },
        description: { type: 'string' },
        tags:        { type: 'array', items: { type: 'string' } },
        hook:        { type: 'string' },
      },
      required: ['title', 'description', 'tags', 'hook'],
    },
    instagram: {
      type: 'object',
      properties: {
        caption:    { type: 'string' },
        hashtags:   { type: 'array', items: { type: 'string' } },
        cover_text: { type: 'string' },
      },
      required: ['caption', 'hashtags', 'cover_text'],
    },
    tiktok: {
      type: 'object',
      properties: {
        hook:     { type: 'string' },
        caption:  { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['hook', 'caption', 'hashtags'],
    },
    facebook: {
      type: 'object',
      properties: {
        caption:  { type: 'string' },
        cta:      { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['caption', 'cta', 'hashtags'],
    },
    x: {
      type: 'object',
      properties: {
        tweet:    { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['tweet', 'hashtags'],
    },
    script_outline: { type: 'string' },
  },
  required: ['youtube', 'instagram', 'tiktok', 'facebook', 'x', 'script_outline'],
}

export function getGeminiConfig() {
  return {
    responseMimeType: 'application/json' as const,
    responseSchema: AI_OUTPUT_SCHEMA,
  }
}

// ============================================================================
// JSON parsing + hydration (AI-09, T-5-02)
// NEVER use eval(). Parse only. Hydrate missing fields with empty defaults.
// ============================================================================

function emptyAIOutput(): AIOutput {
  return {
    youtube:   { title: '', description: '', tags: [], hook: '' },
    instagram: { caption: '', hashtags: [], cover_text: '' },
    tiktok:    { hook: '', caption: '', hashtags: [] },
    facebook:  { caption: '', cta: '', hashtags: [] },
    x:         { tweet: '', hashtags: [] },
    script_outline: '',
  }
}

function hydrateAIOutput(partial: Partial<AIOutput>): AIOutput {
  return {
    youtube: {
      title:       partial.youtube?.title       ?? '',
      description: partial.youtube?.description ?? '',
      tags:        Array.isArray(partial.youtube?.tags) ? partial.youtube!.tags : [],
      hook:        partial.youtube?.hook        ?? '',
    },
    instagram: {
      caption:    partial.instagram?.caption    ?? '',
      hashtags:   Array.isArray(partial.instagram?.hashtags) ? partial.instagram!.hashtags : [],
      cover_text: partial.instagram?.cover_text ?? '',
    },
    tiktok: {
      hook:     partial.tiktok?.hook     ?? '',
      caption:  partial.tiktok?.caption  ?? '',
      hashtags: Array.isArray(partial.tiktok?.hashtags) ? partial.tiktok!.hashtags : [],
    },
    facebook: {
      caption:  partial.facebook?.caption  ?? '',
      cta:      partial.facebook?.cta      ?? '',
      hashtags: Array.isArray(partial.facebook?.hashtags) ? partial.facebook!.hashtags : [],
    },
    x: {
      tweet:    partial.x?.tweet    ?? '',
      hashtags: Array.isArray(partial.x?.hashtags) ? partial.x!.hashtags : [],
    },
    script_outline: partial.script_outline ?? '',
  }
}

export function parseAIOutput(raw: string): AIOutput {
  // Step 1: strip markdown code fences (```json ... ``` or ``` ... ```)
  let text = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()

  // Step 2: find outermost JSON object boundaries
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return emptyAIOutput()
  text = text.slice(start, end + 1)

  // Step 3: parse (T-5-02: JSON.parse ONLY — never eval)
  try {
    const parsed = JSON.parse(text) as Partial<AIOutput>
    return hydrateAIOutput(parsed)
  } catch {
    return emptyAIOutput()
  }
}

// ============================================================================
// buildAICallParams — enforces D-05: second pass strips frames
// ============================================================================
export interface AICallParamsInput {
  provider: AIProvider
  prompt: string
  frames?: string[]
  isSecondPass: boolean
}

export interface AICallParams {
  provider: AIProvider
  prompt: string
  frames?: string[]  // undefined on second pass
}

export function buildAICallParams(input: AICallParamsInput): AICallParams {
  return {
    provider: input.provider,
    prompt: input.prompt,
    // D-05: images NOT re-sent on second pass (~50% cheaper)
    frames: input.isSecondPass ? undefined : input.frames,
  }
}

// ============================================================================
// callAI — provider routing
// ============================================================================
export interface AICallOptions {
  provider: AIProvider
  apiKey: string             // User's decrypted API key from settings
  prompt: string
  selectedFile?: File | null // For Gemini Files API (AI-03)
  frames?: string[]          // base64 JPEGs for Claude/OpenAI (AI-04, AI-05)
}

export async function callAI(options: AICallOptions): Promise<AIOutput> {
  const { provider, apiKey, prompt, selectedFile, frames } = options

  let rawText: string

  switch (provider) {
    case 'gemini': {
      // Pattern 1 from RESEARCH.md — Files API always (CLAUDE.md: inline broken for all sizes)
      const ai = new GoogleGenAI({ apiKey })
      const geminiConfig = getGeminiConfig()

      let contents: Content[]

      if (selectedFile) {
        // Step 1: Upload file
        const uploaded = await ai.files.upload({
          file: selectedFile,
          config: { mimeType: selectedFile.type },
        })

        // Step 2: Poll until ACTIVE (2s interval, uses .name NOT .uri per research)
        let fileInfo = uploaded
        while (fileInfo.state !== 'ACTIVE') {
          if (fileInfo.state === 'FAILED') {
            throw new Error('gemini_file_processing_failed')
          }
          await new Promise<void>(r => setTimeout(r, 2000))
          fileInfo = await ai.files.get({ name: uploaded.name! })
        }

        // Step 3: Build contents with file URI
        contents = [{
          role: 'user',
          parts: [
            { text: prompt },
            { fileData: { mimeType: fileInfo.mimeType, fileUri: fileInfo.uri } },
          ],
        }]
      } else {
        // D-06 text-only path when no file selected
        contents = [{
          role: 'user',
          parts: [{ text: prompt }],
        }]
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: geminiConfig,
      })
      rawText = response.text ?? ''
      break
    }

    case 'claude': {
      // Pattern 3 from RESEARCH.md — dangerouslyAllowBrowser: true is MANDATORY
      // Pitfall 3: SDK throws at construction time without this flag
      const anthropic = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      })

      type ContentBlock =
        | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } }
        | { type: 'text'; text: string }

      const content: ContentBlock[] = []

      // Send frames only on first pass (D-05: no re-send on second pass)
      // Pitfall: data field is raw base64 — no "data:image/jpeg;base64," prefix
      if (frames?.length) {
        for (const b64 of frames) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: b64,  // raw base64 — NO data URI prefix
            },
          })
        }
      }
      content.push({ type: 'text', text: prompt })

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      })

      rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
      break
    }

    case 'openai': {
      // AI-05: OpenAI permanently CORS-blocked from browser — MUST go through backend proxy
      // Never call openai.com directly from frontend code
      const body: AIProxyBody = { prompt }
      if (frames?.length) {
        body.frames = frames
      }
      const result = await proxyAIGenerate(body)
      rawText = result.text
      break
    }

    default: {
      const exhaustive: never = provider
      throw new Error(`Unknown provider: ${exhaustive as string}`)
    }
  }

  // AI-09: defensive parse — T-5-02: JSON.parse only, never eval
  return parseAIOutput(rawText)
}
