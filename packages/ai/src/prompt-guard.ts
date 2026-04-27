/**
 * packages/ai/src/prompt-guard.ts
 * Phase 7 — XML wrapping + jailbreak classifier (REQ-085).
 *
 * Pipeline order in generate-content.ts:
 *   1. guardPrompt(userPrompt)  ← THIS file
 *   2. redactPii(safe.sanitized)
 *   3. fetch LiteLLM
 *
 * Rule-based classifier — matches a curated set of jailbreak signatures.
 * Not exhaustive; layered defense alongside system-prompt instructions and provider safety filters.
 */

export interface GuardResult {
  safe: boolean
  sanitized: string
  reason?: string
}

export class PromptInjectionError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'PromptInjectionError'
  }
}

/**
 * Curated jailbreak signature patterns.
 * Each entry matches a distinct attack category.
 */
export const JAILBREAK_PATTERNS: RegExp[] = [
  // 1. Instruction override: "ignore previous/prior/all instructions/prompts/commands/rules"
  /ignore\s+(?:previous|prior|all|the)\s+(?:instructions?|prompts?|commands?|rules?)/i,

  // 2. Persona override — "you are now X" (requires a non-whitespace token after)
  /you\s+are\s+now\s+\S+/i,

  // 3. Persona override — "act as <something>" — requires "as" immediately after "act"
  /\bact\s+as\s+\S+/i,

  // 4. Persona override — "pretend you are" or "pretend to be"
  /\bpretend\s+(?:you\s+are|to\s+be)\s+\S+/i,

  // 5. DAN mode — standalone uppercase DAN or "DAN mode/persona"
  /\bDAN\s+(?:mode|persona)\b|\bDAN\b(?=\s|$)/,

  // 6. Developer mode bypass
  /\bdeveloper\s+mode\b/i,

  // 7. Inline system override marker: "system:" preceded by start/newline/period/semicolon
  /(?:^|\n|\.\s|;\s)system\s*:/i,

  // 8. System tag injection: [SYSTEM]
  /\[\s*SYSTEM\s*\]/i,

  // 9. System tag injection: ###SYSTEM
  /###\s*SYSTEM/i,

  // 10. Closing-tag spoofing: </user_content> in user input
  /<\/user_content>/i,
]

/**
 * Wraps untrusted user text in XML tags to isolate it from system instructions.
 * The surrounding tags make prompt injection structurally visible to the LLM.
 */
export function wrapUserInput(text: string): string {
  return `<user_content>\n${text}\n</user_content>`
}

/**
 * Rule-based jailbreak detector.
 * Returns true if any jailbreak signature matches or if excessive escape
 * sequences are found in a short string (obfuscation signal).
 */
export function detectJailbreakAttempt(text: string): boolean {
  if (!text) return false

  // Pattern matching
  for (const pattern of JAILBREAK_PATTERNS) {
    // Reset lastIndex for global patterns (defensive)
    pattern.lastIndex = 0
    if (pattern.test(text)) return true
  }

  // Excessive escape sequences: >5 in a string of <=200 chars
  // (Longer text naturally accumulates escapes; short strings with many are obfuscation)
  if (text.length <= 200) {
    const escapes = (text.match(/\\[ntrbf"'\\]/g) ?? []).length
    if (escapes > 5) return true
  }

  return false
}

/**
 * Guards a user prompt against injection attacks.
 *
 * - If jailbreak detected: returns { safe: false, sanitized: '', reason }
 * - If safe: returns { safe: true, sanitized: wrapUserInput(text) }
 *
 * The sanitized output should be passed to redactPii() before sending to LiteLLM.
 */
export function guardPrompt(text: string): GuardResult {
  if (detectJailbreakAttempt(text)) {
    return {
      safe: false,
      sanitized: '',
      reason: 'Prompt injection attempt detected',
    }
  }
  return {
    safe: true,
    sanitized: wrapUserInput(text),
  }
}
