/**
 * packages/tools/src/tools/legal/index.ts
 * 3 ToolDefinition objects for web-legal agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const caseRoiEstimator: ToolDefinition = {
  slug: 'case-roi-estimator',
  name: 'Case ROI Estimator',
  agencySlug: 'legal',
  benchmarkKeys: ['legal-case-roi'],
  fields: [
    { name: 'caseValue', label: 'Estimated Case Value ($)', type: 'number', required: true, min: 0, max: 100_000_000, step: 1_000, placeholder: '50000' },
    { name: 'caseCost', label: 'Total Case Cost ($)', type: 'number', required: true, min: 0, max: 10_000_000, step: 500, placeholder: '15000' },
    { name: 'caseType', label: 'Case Type', type: 'select', required: true, options: [
      { label: 'Personal Injury', value: 'personal-injury' },
      { label: 'Business Litigation', value: 'business-litigation' },
      { label: 'Employment Law', value: 'employment' },
      { label: 'Real Estate', value: 'real-estate' },
    ]},
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['legal-case-roi']!
    const caseValue = Number(inputs['caseValue'])
    const caseCost = Number(inputs['caseCost'])
    const roi = caseCost > 0 ? ((caseValue - caseCost) / caseCost) * 100 : 0
    const netProfit = caseValue - caseCost
    const industryAvgRoi = Number(bm.data['avgCaseRoi'] ?? 230)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'roi', label: 'Case Return on Investment', value: `${roi.toFixed(1)}%`, isPrimary: true, description: `Industry average: ${industryAvgRoi}%` },
        { name: 'netProfit', label: 'Net Profit', value: `$${netProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvgRoi', label: 'Industry Avg Case ROI', value: `${industryAvgRoi}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const billableHoursEfficiencyCalculator: ToolDefinition = {
  slug: 'billable-hours-efficiency-calculator',
  name: 'Billable Hours Efficiency Calculator',
  agencySlug: 'legal',
  benchmarkKeys: ['legal-billable-hours'],
  fields: [
    { name: 'attorneys', label: 'Number of Attorneys', type: 'number', required: true, min: 1, max: 500, step: 1, placeholder: '5' },
    { name: 'targetBillableHours', label: 'Target Billable Hours / Attorney / Year', type: 'number', required: true, min: 100, max: 3_000, step: 10, placeholder: '1800' },
    { name: 'actualBillableHours', label: 'Actual Billable Hours / Attorney / Year', type: 'number', required: true, min: 0, max: 3_000, step: 10, placeholder: '1450' },
    { name: 'hourlyRate', label: 'Average Hourly Rate ($)', type: 'number', required: true, min: 50, max: 5_000, step: 25, placeholder: '350' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['legal-billable-hours']!
    const attorneys = Number(inputs['attorneys'])
    const targetBillableHours = Number(inputs['targetBillableHours'])
    const actualBillableHours = Number(inputs['actualBillableHours'])
    const hourlyRate = Number(inputs['hourlyRate'])
    const hourGap = Math.max(0, targetBillableHours - actualBillableHours)
    const annualRevenueLoss = hourGap * hourlyRate * attorneys
    const utilizationRate = targetBillableHours > 0 ? (actualBillableHours / targetBillableHours) * 100 : 0
    const industryAvgUtilization = Number(bm.data['avgUtilizationRate'] ?? 81)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualRevenueLoss', label: 'Annual Revenue Gap', value: `$${annualRevenueLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'utilizationRate', label: 'Current Utilization Rate', value: `${utilizationRate.toFixed(1)}%` },
        { name: 'industryAvgUtilization', label: 'Industry Avg Utilization', value: `${industryAvgUtilization}%`, description: 'Source: Clio Legal Trends Report' },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const clientAcquisitionCostCalculator: ToolDefinition = {
  slug: 'client-acquisition-cost-calculator',
  name: 'Client Acquisition Cost Calculator',
  agencySlug: 'legal',
  benchmarkKeys: ['legal-client-acquisition'],
  fields: [
    { name: 'marketingBudget', label: 'Monthly Marketing Budget ($)', type: 'number', required: true, min: 0, max: 10_000_000, step: 500, placeholder: '8000' },
    { name: 'newClientsPerMonth', label: 'New Clients per Month', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '12' },
    { name: 'avgCaseValue', label: 'Average Case Value ($)', type: 'number', required: true, min: 100, max: 10_000_000, step: 500, placeholder: '8500' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['legal-client-acquisition']!
    const marketingBudget = Number(inputs['marketingBudget'])
    const newClientsPerMonth = Number(inputs['newClientsPerMonth'])
    const avgCaseValue = Number(inputs['avgCaseValue'])
    const cac = newClientsPerMonth > 0 ? marketingBudget / newClientsPerMonth : 0
    const ltv = avgCaseValue
    const ltvToCac = cac > 0 ? ltv / cac : 0
    const industryAvgCac = Number(bm.data['avgCac'] ?? 900)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'cac', label: 'Client Acquisition Cost', value: `$${cac.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true, description: `Industry average: $${industryAvgCac.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'ltvToCac', label: 'LTV : CAC Ratio', value: `${ltvToCac.toFixed(1)}x` },
        { name: 'industryAvgCac', label: 'Industry Avg CAC', value: `$${industryAvgCac.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
