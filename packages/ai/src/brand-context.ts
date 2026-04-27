/**
 * packages/ai/src/brand-context.ts
 * Phase 7 — loads per-agency brand voice + glossary into a system-prompt string.
 * REQ-083
 *
 * NOTE: Accepts a Payload instance as parameter (rather than importing payload here)
 * because @mjagency/ai is a leaf package. The server action layer obtains the payload
 * instance via getPayload() and passes it in.
 *
 * Security (T-07-04-03): agencyId is used in the where clause — function never
 * reads across agencies. overrideAccess:true is system-level; caller MUST validate
 * session before invoking (enforced in brandVoiceRewrite server action).
 */
import type { Payload } from 'payload'

export async function getBrandVoiceContext(agencyId: string, payload: Payload): Promise<string> {
  try {
    const [voiceRes, glossaryRes] = await Promise.all([
      payload.find({
        collection: 'brand_voice',
        where: { agency_id: { equals: agencyId } },
        limit: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'brand_glossary',
        where: { agency_id: { equals: agencyId } },
        limit: 100,
        overrideAccess: true,
      }),
    ])
    const voice = voiceRes.docs[0] as Record<string, unknown> | undefined
    const glossary = glossaryRes.docs as Array<Record<string, unknown>>

    const lines: string[] = []
    if (voice) {
      if (voice['tone_description']) lines.push(`TONE: ${voice['tone_description']}`)
      if (voice['writing_style_notes']) lines.push(`STYLE: ${voice['writing_style_notes']}`)
      if (voice['target_audience']) lines.push(`AUDIENCE: ${voice['target_audience']}`)
      if (voice['formality_level']) lines.push(`FORMALITY: ${voice['formality_level']}`)
      if (voice['example_good_paragraph'])
        lines.push(`GOOD EXAMPLE:\n${voice['example_good_paragraph']}`)
      if (voice['example_bad_paragraph'])
        lines.push(`AVOID PATTERN:\n${voice['example_bad_paragraph']}`)
    }
    if (glossary.length > 0) {
      lines.push('GLOSSARY (use preferred terms; never the avoid phrases):')
      for (const g of glossary) {
        const term = g['term'] as string | undefined
        const usage = g['preferred_usage'] as string | undefined
        const avoidArr = (g['avoid_phrases'] as Array<{ phrase: string }> | undefined) ?? []
        const avoidStr = avoidArr
          .map((a) => a.phrase)
          .filter(Boolean)
          .join(', ')
        if (term) {
          lines.push(
            `- ${term}: ${usage ?? ''}${avoidStr ? ` (NEVER use: ${avoidStr})` : ''}`,
          )
        }
      }
    }
    return lines.join('\n')
  } catch (err) {
    console.warn(
      `[brand-context] failed to load for agency ${agencyId}: ${(err as Error).message}`,
    )
    return ''
  }
}
