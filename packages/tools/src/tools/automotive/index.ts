/**
 * packages/tools/src/tools/automotive/index.ts
 * 3 ToolDefinition objects for web-automotive agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const grossProfitPerVehicleCalculator: ToolDefinition = {
  slug: 'gross-profit-per-vehicle-calculator',
  name: 'Gross Profit Per Vehicle Calculator',
  agencySlug: 'automotive',
  benchmarkKeys: ['automotive-gross-profit'],
  fields: [
    { name: 'frontEndGross', label: 'Front-End Gross Profit ($)', type: 'number', required: true, min: 0, max: 500_000, step: 100, placeholder: '2200' },
    { name: 'backEndGross', label: 'Back-End Gross Profit (F&I) ($)', type: 'number', required: true, min: 0, max: 100_000, step: 50, placeholder: '1400' },
    { name: 'unitsPerMonth', label: 'Units Sold per Month', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '85' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['automotive-gross-profit']!
    const frontEndGross = Number(inputs['frontEndGross'])
    const backEndGross = Number(inputs['backEndGross'])
    const unitsPerMonth = Number(inputs['unitsPerMonth'])
    const grossProfit = frontEndGross + backEndGross
    const monthlyGross = grossProfit * unitsPerMonth
    const industryAvgTotalGross = Number(bm.data['avgTotalGrossPerVehicle'] ?? 3600)
    const vsIndustry = industryAvgTotalGross > 0 ? ((grossProfit - industryAvgTotalGross) / industryAvgTotalGross) * 100 : 0
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'grossProfit', label: 'Total Gross Profit per Vehicle', value: `$${grossProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true, description: `Industry average: $${industryAvgTotalGross.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'monthlyGross', label: 'Monthly Total Gross Profit', value: `$${monthlyGross.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'vsIndustry', label: 'vs. Industry Average', value: `${vsIndustry > 0 ? '+' : ''}${vsIndustry.toFixed(1)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const serviceRevenueEstimator: ToolDefinition = {
  slug: 'service-department-revenue-estimator',
  name: 'Service Department Revenue Estimator',
  agencySlug: 'automotive',
  benchmarkKeys: ['automotive-service'],
  fields: [
    { name: 'dailyROs', label: 'Daily Repair Orders (ROs)', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '45' },
    { name: 'workingDays', label: 'Working Days per Month', type: 'number', required: true, min: 1, max: 31, step: 1, placeholder: '26' },
    { name: 'avgROValue', label: 'Average RO Value ($)', type: 'number', required: true, min: 50, max: 100_000, step: 25, placeholder: '380' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['automotive-service']!
    const dailyROs = Number(inputs['dailyROs'])
    const workingDays = Number(inputs['workingDays'])
    const avgROValue = Number(inputs['avgROValue'])
    const monthlyServiceRevenue = dailyROs * workingDays * avgROValue
    const annualServiceRevenue = monthlyServiceRevenue * 12
    const industryAvgROValue = Number(bm.data['avgROValue'] ?? 380)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'monthlyServiceRevenue', label: 'Monthly Service Department Revenue', value: `$${monthlyServiceRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'annualServiceRevenue', label: 'Annual Service Revenue', value: `$${annualServiceRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvgROValue', label: 'Industry Avg RO Value', value: `$${industryAvgROValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const leadResponseRoiCalculator: ToolDefinition = {
  slug: 'lead-response-time-roi-calculator',
  name: 'Lead Response Time ROI Calculator',
  agencySlug: 'automotive',
  benchmarkKeys: ['automotive-lead-response'],
  fields: [
    { name: 'monthlyLeads', label: 'Monthly Internet Leads', type: 'number', required: true, min: 1, max: 100_000, step: 1, placeholder: '200' },
    { name: 'currentCloseRate', label: 'Current Lead-to-Sale Close Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.5, placeholder: '8' },
    { name: 'targetCloseRate', label: 'Target Close Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.5, placeholder: '12' },
    { name: 'avgVehicleProfit', label: 'Average Vehicle Gross Profit ($)', type: 'number', required: true, min: 100, max: 500_000, step: 100, placeholder: '3600' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['automotive-lead-response']!
    const monthlyLeads = Number(inputs['monthlyLeads'])
    const currentCloseRate = Number(inputs['currentCloseRate']) / 100
    const targetCloseRate = Number(inputs['targetCloseRate']) / 100
    const avgVehicleProfit = Number(inputs['avgVehicleProfit'])
    const closeRateGap = Math.max(0, targetCloseRate - currentCloseRate)
    const revenueGain = closeRateGap * monthlyLeads * avgVehicleProfit
    const currentMonthlyRevenue = currentCloseRate * monthlyLeads * avgVehicleProfit
    const industryAvgInternetLeadCloseRate = Number(bm.data['avgInternetLeadCloseRate'] ?? 0.10)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'revenueGain', label: 'Monthly Revenue Opportunity', value: `$${revenueGain.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'currentMonthlyRevenue', label: 'Current Lead Revenue', value: `$${currentMonthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvgClose', label: 'Industry Avg Internet Lead Close Rate', value: `${(industryAvgInternetLeadCloseRate * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
