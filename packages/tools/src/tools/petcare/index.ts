/**
 * packages/tools/src/tools/petcare/index.ts
 * 3 ToolDefinition objects for web-petcare agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const lifetimeClientValueCalculator: ToolDefinition = {
  slug: 'lifetime-client-value-calculator',
  name: 'Lifetime Client Value Calculator',
  agencySlug: 'petcare',
  benchmarkKeys: ['petcare-lifetime-value'],
  fields: [
    { name: 'avgAnnualSpend', label: 'Average Annual Client Spend ($)', type: 'number', required: true, min: 50, max: 500_000, step: 50, placeholder: '1800' },
    { name: 'avgClientLifespanYears', label: 'Average Client Lifespan (Years)', type: 'number', required: true, min: 0.5, max: 30, step: 0.5, placeholder: '6' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['petcare-lifetime-value']!
    const avgAnnualSpend = Number(inputs['avgAnnualSpend'])
    const avgClientLifespanYears = Number(inputs['avgClientLifespanYears'])
    const ltv = avgAnnualSpend * avgClientLifespanYears
    const industryAvgLtv = Number(bm.data['avgPetOwnerLtv'] ?? 10800)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'ltv', label: 'Client Lifetime Value', value: `$${ltv.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true, description: `Industry avg: $${industryAvgLtv.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'avgAnnualSpend', label: 'Annual Revenue per Client', value: `$${avgAnnualSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvg', label: 'Industry Avg Pet Owner LTV', value: `$${industryAvgLtv.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const boardingRevenuePlanner: ToolDefinition = {
  slug: 'boarding-revenue-planner',
  name: 'Boarding Revenue Planner',
  agencySlug: 'petcare',
  benchmarkKeys: ['petcare-boarding'],
  fields: [
    { name: 'boardingRuns', label: 'Number of Boarding Runs / Kennels', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '40' },
    { name: 'averageOccupancyRate', label: 'Average Occupancy Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '62' },
    { name: 'averageNightlyRate', label: 'Average Nightly Rate ($)', type: 'number', required: true, min: 1, max: 1_000, step: 1, placeholder: '42' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['petcare-boarding']!
    const boardingRuns = Number(inputs['boardingRuns'])
    const averageOccupancyRate = Number(inputs['averageOccupancyRate']) / 100
    const averageNightlyRate = Number(inputs['averageNightlyRate'])
    const annualRevenue = boardingRuns * averageOccupancyRate * averageNightlyRate * 365
    const monthlyRevenue = annualRevenue / 12
    const industryAvgOccupancy = Number(bm.data['avgOccupancyRate'] ?? 0.65)
    const revenueAtIndustryAvg = boardingRuns * industryAvgOccupancy * averageNightlyRate * 365
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualRevenue', label: 'Annual Boarding Revenue', value: `$${annualRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'monthlyRevenue', label: 'Monthly Boarding Revenue', value: `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'revenueAtIndustryAvg', label: 'Revenue at Industry Avg Occupancy', value: `$${revenueAtIndustryAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, description: `Industry avg occupancy: ${(industryAvgOccupancy * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const groomingFrequencyRevenueEstimator: ToolDefinition = {
  slug: 'grooming-frequency-revenue-estimator',
  name: 'Grooming Frequency Revenue Estimator',
  agencySlug: 'petcare',
  benchmarkKeys: ['petcare-grooming'],
  fields: [
    { name: 'groomingClients', label: 'Active Grooming Clients', type: 'number', required: true, min: 1, max: 500_000, step: 10, placeholder: '180' },
    { name: 'visitsPerYear', label: 'Average Grooming Visits per Client per Year', type: 'number', required: true, min: 1, max: 52, step: 0.5, placeholder: '6' },
    { name: 'avgGroomingPrice', label: 'Average Grooming Price ($)', type: 'number', required: true, min: 10, max: 1_000, step: 5, placeholder: '65' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['petcare-grooming']!
    const groomingClients = Number(inputs['groomingClients'])
    const visitsPerYear = Number(inputs['visitsPerYear'])
    const avgGroomingPrice = Number(inputs['avgGroomingPrice'])
    const annualRevenue = groomingClients * visitsPerYear * avgGroomingPrice
    const monthlyRevenue = annualRevenue / 12
    const revenuePerClient = visitsPerYear * avgGroomingPrice
    const industryAvgVisitsPerYear = Number(bm.data['avgGroomingVisitsPerYear'] ?? 5.5)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualRevenue', label: 'Annual Grooming Revenue', value: `$${annualRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'monthlyRevenue', label: 'Monthly Grooming Revenue', value: `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'revenuePerClient', label: 'Annual Revenue per Client', value: `$${revenuePerClient.toFixed(2)}`, description: `Industry avg visits/year: ${industryAvgVisitsPerYear}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
