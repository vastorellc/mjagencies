/**
 * packages/ai/src/pii-redactor.ts
 * Phase 7 — strips PII from text before sending to LiteLLM (REQ-084).
 *
 * Patterns:
 *   - Email: simple RFC-5321 form
 *   - Phone (US): handles 10-digit with optional country code & separators
 *   - SSN: NNN-NN-NNNN
 *   - Credit card: 16-digit groups (4 groups of 4) with optional separators
 *   - IPv4: dotted-quad
 *
 * Same PII value within one call gets the SAME token (deterministic mapping).
 * LLM output is NOT auto-restored — call restoreFromTokens() explicitly if needed.
 */

export interface PiiRedactionResult {
  redacted: string
  replacements: Map<string, string> // token (e.g. 'EMAIL_1') → original
}

// Order matters: more-specific patterns FIRST (CARD before IP, SSN before phone)
export const PII_PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  CARD: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  PHONE: /(?:\+?1[\s\-.]?)?(?:\(\d{3}\)|\d{3})[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
  IP: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g,
} as const

export function redactPii(text: string): PiiRedactionResult {
  if (!text) return { redacted: text, replacements: new Map() }

  const replacements = new Map<string, string>()
  // Reverse map: original → token (so duplicates collapse)
  const seen = new Map<string, string>()

  // Process in order: EMAIL, CARD, SSN, PHONE, IP (specific → general)
  let working = text
  const counters: Record<keyof typeof PII_PATTERNS, number> = {
    EMAIL: 0,
    CARD: 0,
    SSN: 0,
    PHONE: 0,
    IP: 0,
  }
  const order: Array<keyof typeof PII_PATTERNS> = ['EMAIL', 'CARD', 'SSN', 'PHONE', 'IP']

  for (const kind of order) {
    const pattern = new RegExp(PII_PATTERNS[kind].source, 'g')
    working = working.replace(pattern, (match) => {
      const seenKey = `${kind}::${match}`
      const existing = seen.get(seenKey)
      if (existing !== undefined) return `[${existing}]`
      counters[kind] += 1
      const token = `${kind}_${counters[kind]}`
      seen.set(seenKey, token)
      replacements.set(token, match)
      return `[${token}]`
    })
  }

  return { redacted: working, replacements }
}

export function restoreFromTokens(text: string, replacements: Map<string, string>): string {
  let out = text
  for (const [token, original] of replacements.entries()) {
    // Replace [TOKEN] occurrences with original value
    out = out.split(`[${token}]`).join(original)
  }
  return out
}
