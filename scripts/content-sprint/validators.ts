/**
 * scripts/content-sprint/validators.ts
 *
 * Runs the same content validation rules as Payload beforeOperation hooks,
 * but as standalone functions for the seed script to check before writing.
 *
 * Mirrors the logic in packages/cms/src/hooks/content-validators.ts exactly.
 * If validation fails, the seed script logs the error and skips that content item.
 * Failed saves do not block engineering progress (CLAUDE.md content sprint integration).
 */
import {
  FTC_DISCLAIMER_TEXT,
  FTC_TESTIMONIAL_DISCLAIMER,
} from '@mjagency/cms'

export interface ContentValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  wordCount: number
  internalLinkCount: number
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length >= 2).length
}

function countInternalLinks(text: string): number {
  return (text.match(/href=['"]\/[^'"]+['"]/g) ?? []).length
}

function hasExactFigures(text: string): boolean {
  return /\b\d{1,3}(?:\.\d+)?%(?!\s*[-–]\s*\d)/.test(text)
}

export function runContentValidators(
  content: string,
  options: {
    wordCountFloor?: number
    requiresFtcDisclaimer?: boolean
    hasTestimonials?: boolean
    isPublish?: boolean
    isCompositePlaybook?: boolean
  } = {}
): ContentValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const wordCount = countWords(content)
  const internalLinkCount = countInternalLinks(content)
  const floor = options.wordCountFloor ?? 1500

  if (wordCount < floor) {
    if (options.isPublish) {
      errors.push(`Word count ${wordCount} below floor ${floor} (REQ-201)`)
    } else {
      warnings.push(`Word count ${wordCount} below floor ${floor} — will block publish (REQ-201)`)
    }
  }

  if (internalLinkCount < 3) {
    if (options.isPublish) {
      errors.push(`Internal links ${internalLinkCount} below required 3 (REQ-203)`)
    } else {
      warnings.push(`Internal links ${internalLinkCount}/3 — will block publish (REQ-203)`)
    }
  }

  if (hasExactFigures(content) && options.isPublish) {
    errors.push('Content contains exact percentage figures — use ranges (REQ-205, REQ-411)')
  }

  if (options.requiresFtcDisclaimer && options.isCompositePlaybook) {
    if (!content.includes('Results not typical')) {
      errors.push(`Missing FTC disclaimer: "${FTC_DISCLAIMER_TEXT}" (REQ-207, REQ-410)`)
    }
  }

  if (options.hasTestimonials) {
    if (!content.includes('Individual results may vary')) {
      warnings.push(`Missing FTC testimonial disclaimer: "${FTC_TESTIMONIAL_DISCLAIMER}" (REQ-421)`)
    }
  }

  // Anti-placeholder check (CLAUDE.md §5)
  const FORBIDDEN_PATTERNS = ['Lorem ipsum', 'TODO', '[insert', 'Coming soon', 'placeholder']
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (content.toLowerCase().includes(pattern.toLowerCase())) {
      errors.push(`Placeholder text detected: "${pattern}" (CLAUDE.md §5 Content-Complete Rule)`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    wordCount,
    internalLinkCount,
  }
}
