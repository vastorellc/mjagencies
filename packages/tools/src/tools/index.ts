/**
 * packages/tools/src/tools/index.ts
 * Aggregates all 36 ToolDefinition objects.
 * REQ-120: 36 tools (3 per agency × 12).
 */
import type { ToolDefinition } from '../engine/types.js'

import {
  roiCalculator,
  cartAbandonmentCalculator,
  emailRevenuePotentialCalculator,
} from './ecommerce/index.js'

import {
  homeValueEstimator,
  buyerAffordabilityCalculator,
  sellerNetProceedsCalculator,
} from './realestate/index.js'

import {
  patientLtvCalculator,
  noShowCostCalculator,
  practiceRevenueCalculator,
} from './healthcare/index.js'

import {
  caseRoiEstimator,
  billableHoursEfficiencyCalculator,
  clientAcquisitionCostCalculator,
} from './legal/index.js'

import {
  jobProfitMarginCalculator,
  seasonalRevenuePlanner,
  leadToBookingCalculator,
} from './homeservices/index.js'

import {
  membershipRevenueCalculator,
  churnCostCalculator,
  classFillRateOptimizer,
} from './fitness/index.js'

import {
  newPatientRevenueCalculator,
  treatmentAcceptanceEstimator,
  hygieneRecallRevenueCalculator,
} from './dental/index.js'

import {
  grossProfitPerVehicleCalculator,
  serviceRevenueEstimator,
  leadResponseRoiCalculator,
} from './automotive/index.js'

import {
  tableTurnRevenueCalculator,
  foodCostMarginCalculator,
  cateringRevenuePotentialCalculator,
} from './restaurant/index.js'

import {
  studentLtvCalculator,
  enrollmentConversionCalculator,
  tuitionRevenuePlanner,
} from './education/index.js'

import {
  aumGrowthProjectionCalculator,
  clientRetentionRevenueCalculator,
  referralValueEstimator,
} from './financial/index.js'

import {
  lifetimeClientValueCalculator,
  boardingRevenuePlanner,
  groomingFrequencyRevenueEstimator,
} from './petcare/index.js'

export const ALL_TOOLS: ToolDefinition[] = [
  // Ecommerce (3)
  roiCalculator,
  cartAbandonmentCalculator,
  emailRevenuePotentialCalculator,
  // Real Estate (3)
  homeValueEstimator,
  buyerAffordabilityCalculator,
  sellerNetProceedsCalculator,
  // Healthcare (3)
  patientLtvCalculator,
  noShowCostCalculator,
  practiceRevenueCalculator,
  // Legal (3)
  caseRoiEstimator,
  billableHoursEfficiencyCalculator,
  clientAcquisitionCostCalculator,
  // Home Services (3)
  jobProfitMarginCalculator,
  seasonalRevenuePlanner,
  leadToBookingCalculator,
  // Fitness (3)
  membershipRevenueCalculator,
  churnCostCalculator,
  classFillRateOptimizer,
  // Dental (3)
  newPatientRevenueCalculator,
  treatmentAcceptanceEstimator,
  hygieneRecallRevenueCalculator,
  // Automotive (3)
  grossProfitPerVehicleCalculator,
  serviceRevenueEstimator,
  leadResponseRoiCalculator,
  // Restaurant (3)
  tableTurnRevenueCalculator,
  foodCostMarginCalculator,
  cateringRevenuePotentialCalculator,
  // Education (3)
  studentLtvCalculator,
  enrollmentConversionCalculator,
  tuitionRevenuePlanner,
  // Financial (3)
  aumGrowthProjectionCalculator,
  clientRetentionRevenueCalculator,
  referralValueEstimator,
  // Pet Care (3)
  lifetimeClientValueCalculator,
  boardingRevenuePlanner,
  groomingFrequencyRevenueEstimator,
]

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return ALL_TOOLS.find((t) => t.slug === slug)
}

export function getToolsByAgency(agencySlug: string): ToolDefinition[] {
  return ALL_TOOLS.filter((t) => t.agencySlug === agencySlug)
}
