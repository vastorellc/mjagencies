/**
 * packages/tools/src/tools/healthcare/index.ts
 * 3 ToolDefinition objects for web-healthcare agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const patientLtvCalculator: ToolDefinition = {
  slug: 'patient-lifetime-value-calculator',
  name: 'Patient Lifetime Value Calculator',
  agencySlug: 'healthcare',
  benchmarkKeys: ['healthcare-patient-ltv'],
  fields: [
    { name: 'annualVisits', label: 'Average Visits per Patient per Year', type: 'number', required: true, min: 1, max: 52, step: 0.5, placeholder: '4' },
    { name: 'avgRevenuePerVisit', label: 'Average Revenue per Visit ($)', type: 'number', required: true, min: 1, max: 10_000, step: 10, placeholder: '185' },
    { name: 'avgPatientLifespanYears', label: 'Average Patient Lifespan (Years)', type: 'number', required: true, min: 1, max: 50, step: 1, placeholder: '7' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['healthcare-patient-ltv']!
    const annualVisits = Number(inputs['annualVisits'])
    const avgRevenuePerVisit = Number(inputs['avgRevenuePerVisit'])
    const avgPatientLifespanYears = Number(inputs['avgPatientLifespanYears'])
    const ltv = annualVisits * avgRevenuePerVisit * avgPatientLifespanYears
    const annualRevenue = annualVisits * avgRevenuePerVisit
    const industryAvgLtv = Number(bm.data['avgPatientLtv'] ?? 1500)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'ltv', label: 'Patient Lifetime Value', value: `$${ltv.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true, description: `Industry average: $${industryAvgLtv.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'annualRevenue', label: 'Annual Revenue per Patient', value: `$${annualRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvg', label: 'Industry Avg Patient LTV', value: `$${industryAvgLtv.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const noShowCostCalculator: ToolDefinition = {
  slug: 'no-show-cost-calculator',
  name: 'No-Show Cost Calculator',
  agencySlug: 'healthcare',
  benchmarkKeys: ['healthcare-no-show'],
  fields: [
    { name: 'weeklyAppointments', label: 'Weekly Appointments Scheduled', type: 'number', required: true, min: 1, max: 5_000, step: 1, placeholder: '120' },
    { name: 'noShowRate', label: 'Current No-Show Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.5, placeholder: '18' },
    { name: 'avgAppointmentValue', label: 'Average Appointment Value ($)', type: 'number', required: true, min: 1, max: 10_000, step: 10, placeholder: '185' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['healthcare-no-show']!
    const weeklyAppointments = Number(inputs['weeklyAppointments'])
    const noShowRate = Number(inputs['noShowRate']) / 100
    const avgAppointmentValue = Number(inputs['avgAppointmentValue'])
    const weeklyNoShows = weeklyAppointments * noShowRate
    const annualCost = weeklyNoShows * 52 * avgAppointmentValue
    const industryAvgNoShowRate = Number(bm.data['avgNoShowRate'] ?? 0.18)
    const potentialSavings = weeklyNoShows * 0.5 * 52 * avgAppointmentValue
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualCost', label: 'Annual No-Show Revenue Loss', value: `$${annualCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'weeklyNoShows', label: 'Weekly No-Shows', value: weeklyNoShows.toFixed(0) },
        { name: 'potentialSavings', label: 'Potential Savings (50% reduction)', value: `$${potentialSavings.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, description: `Industry avg no-show rate: ${(industryAvgNoShowRate * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const practiceRevenueCalculator: ToolDefinition = {
  slug: 'practice-revenue-opportunity-calculator',
  name: 'Practice Revenue Opportunity Calculator',
  agencySlug: 'healthcare',
  benchmarkKeys: ['healthcare-practice-revenue'],
  fields: [
    { name: 'weeklySlots', label: 'Total Weekly Appointment Slots', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '150' },
    { name: 'currentOccupancy', label: 'Current Occupancy Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '72' },
    { name: 'targetOccupancy', label: 'Target Occupancy Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '90' },
    { name: 'avgRevenuePerSlot', label: 'Average Revenue per Appointment ($)', type: 'number', required: true, min: 1, max: 10_000, step: 10, placeholder: '185' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['healthcare-practice-revenue']!
    const weeklySlots = Number(inputs['weeklySlots'])
    const currentOccupancy = Number(inputs['currentOccupancy']) / 100
    const targetOccupancy = Number(inputs['targetOccupancy']) / 100
    const avgRevenuePerSlot = Number(inputs['avgRevenuePerSlot'])
    const occupancyGap = Math.max(0, targetOccupancy - currentOccupancy)
    const annualOpportunity = occupancyGap * weeklySlots * 52 * avgRevenuePerSlot
    const currentAnnualRevenue = currentOccupancy * weeklySlots * 52 * avgRevenuePerSlot
    const industryAvgOccupancy = Number(bm.data['avgPracticeOccupancy'] ?? 0.82)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualOpportunity', label: 'Annual Revenue Opportunity', value: `$${annualOpportunity.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'currentAnnualRevenue', label: 'Current Annual Revenue (est.)', value: `$${currentAnnualRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryOccupancy', label: 'Industry Avg Occupancy', value: `${(industryAvgOccupancy * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
