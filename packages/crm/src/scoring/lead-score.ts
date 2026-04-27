/**
 * packages/crm/src/scoring/lead-score.ts
 *
 * Pure lead-score function. No DB calls, no side effects.
 * All sub-scores are clamped to [0,1] before being multiplied by their weights.
 *
 * Formula:
 *   score = ICP_WEIGHT(0.40) * icpScore
 *         + BEHAVIOR_WEIGHT(0.35) * behaviorScore
 *         + RECENCY_WEIGHT(0.15) * recencyScore
 *         + SOURCE_WEIGHT(0.10) * sourceScore
 *
 * REQ-104 (lead scoring), REQ-105 (routing), REQ-106 (tagging)
 */

export interface IcpInput {
  /** Degree of industry fit for this agency's niche */
  industryFit: 'high' | 'medium' | 'low' | 'none'
  /** Company headcount tier */
  companySizeFit: 'ideal' | 'acceptable' | 'poor'
  /** Seniority of the contact's role */
  roleSeniority: 'c_suite' | 'vp_director' | 'manager' | 'individual'
}

export interface BehaviorInput {
  pageViews: number       // raw count — capped at 10 internally
  formFills: number       // 0 or 1+ (each fill adds 0.5, uncapped)
  emailOpens: number      // raw count — capped at 5 internally
}

export interface LeadScoreInput {
  icp: IcpInput
  behavior: BehaviorInput
  /** ISO-8601 date string of the last touch point */
  lastTouchedAt: string
  /** Acquisition source */
  source:
    | 'inbound_content'
    | 'referral'
    | 'organic_search'
    | 'paid_ad'
    | 'cold_outreach'
    | string // unknown sources score 0
}

export interface LeadScoreWeights {
  icp: number
  behavior: number
  recency: number
  source: number
}

export const DEFAULT_WEIGHTS: LeadScoreWeights = {
  icp: 0.40,
  behavior: 0.35,
  recency: 0.15,
  source: 0.10,
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function computeIcpScore(icp: IcpInput): number {
  const industryMap: Record<IcpInput['industryFit'], number> = {
    high: 1.0,
    medium: 0.7,
    low: 0.3,
    none: 0.0,
  }
  const sizeMap: Record<IcpInput['companySizeFit'], number> = {
    ideal: 1.0,
    acceptable: 0.5,
    poor: 0.0,
  }
  const roleMap: Record<IcpInput['roleSeniority'], number> = {
    c_suite: 1.0,
    vp_director: 0.8,
    manager: 0.5,
    individual: 0.1,
  }
  const raw = (industryMap[icp.industryFit] + sizeMap[icp.companySizeFit] + roleMap[icp.roleSeniority]) / 3
  return clamp(raw)
}

function computeBehaviorScore(behavior: BehaviorInput): number {
  const pageViewScore = Math.min(behavior.pageViews, 10) * 0.1
  const formFillScore = behavior.formFills * 0.5
  const emailOpenScore = Math.min(behavior.emailOpens, 5) * 0.15
  return clamp(pageViewScore + formFillScore + emailOpenScore)
}

function computeRecencyScore(lastTouchedAt: string): number {
  const nowMs = Date.now()
  const lastMs = new Date(lastTouchedAt).getTime()
  const daysSince = (nowMs - lastMs) / (1000 * 60 * 60 * 24)
  if (daysSince <= 7) return 1.0
  if (daysSince <= 30) return 0.7
  if (daysSince <= 90) return 0.3
  return 0.0
}

function computeSourceScore(source: LeadScoreInput['source']): number {
  const map: Record<string, number> = {
    inbound_content: 1.0,
    referral: 0.9,
    organic_search: 0.8,
    paid_ad: 0.6,
    cold_outreach: 0.3,
  }
  return map[source] ?? 0.0
}

/**
 * Compute lead score for a contact.
 * Returns a value in [0, 1]. Higher = stronger lead.
 */
export function computeLeadScore(input: LeadScoreInput, weights: LeadScoreWeights = DEFAULT_WEIGHTS): number {
  const icpScore = computeIcpScore(input.icp)
  const behaviorScore = computeBehaviorScore(input.behavior)
  const recencyScore = computeRecencyScore(input.lastTouchedAt)
  const sourceScore = computeSourceScore(input.source)

  const raw =
    weights.icp * icpScore +
    weights.behavior * behaviorScore +
    weights.recency * recencyScore +
    weights.source * sourceScore

  return clamp(raw)
}
