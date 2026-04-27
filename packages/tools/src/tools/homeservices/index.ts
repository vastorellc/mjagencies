/**
 * packages/tools/src/tools/homeservices/index.ts
 * 3 ToolDefinition objects for web-homeservices agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const jobProfitMarginCalculator: ToolDefinition = {
  slug: 'job-profit-margin-calculator',
  name: 'Job Profit Margin Calculator',
  agencySlug: 'homeservices',
  benchmarkKeys: ['homeservices-job-margin'],
  fields: [
    { name: 'jobRevenue', label: 'Job Revenue ($)', type: 'number', required: true, min: 0, max: 1_000_000, step: 50, placeholder: '2500' },
    { name: 'laborCost', label: 'Labor Cost ($)', type: 'number', required: true, min: 0, max: 500_000, step: 25, placeholder: '800' },
    { name: 'materialCost', label: 'Material Cost ($)', type: 'number', required: true, min: 0, max: 500_000, step: 25, placeholder: '400' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['homeservices-job-margin']!
    const jobRevenue = Number(inputs['jobRevenue'])
    const laborCost = Number(inputs['laborCost'])
    const materialCost = Number(inputs['materialCost'])
    const totalCost = laborCost + materialCost
    const grossProfit = jobRevenue - totalCost
    const margin = jobRevenue > 0 ? (grossProfit / jobRevenue) * 100 : 0
    const industryAvgMargin = Number(bm.data['avgGrossMargin'] ?? 42)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'margin', label: 'Job Gross Margin', value: `${margin.toFixed(1)}%`, isPrimary: true, description: `Industry average: ${industryAvgMargin}%` },
        { name: 'grossProfit', label: 'Gross Profit', value: `$${grossProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvgMargin', label: 'Industry Avg Gross Margin', value: `${industryAvgMargin}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const seasonalRevenuePlanner: ToolDefinition = {
  slug: 'seasonal-revenue-planner',
  name: 'Seasonal Revenue Planner',
  agencySlug: 'homeservices',
  benchmarkKeys: ['homeservices-seasonal'],
  fields: [
    { name: 'q1Jobs', label: 'Q1 Jobs (Jan–Mar)', type: 'number', required: true, min: 0, max: 10_000, step: 1, placeholder: '30' },
    { name: 'q2Jobs', label: 'Q2 Jobs (Apr–Jun)', type: 'number', required: true, min: 0, max: 10_000, step: 1, placeholder: '75' },
    { name: 'q3Jobs', label: 'Q3 Jobs (Jul–Sep)', type: 'number', required: true, min: 0, max: 10_000, step: 1, placeholder: '90' },
    { name: 'q4Jobs', label: 'Q4 Jobs (Oct–Dec)', type: 'number', required: true, min: 0, max: 10_000, step: 1, placeholder: '55' },
    { name: 'avgJobValue', label: 'Average Job Value ($)', type: 'number', required: true, min: 50, max: 500_000, step: 50, placeholder: '1800' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['homeservices-seasonal']!
    const q1Jobs = Number(inputs['q1Jobs'])
    const q2Jobs = Number(inputs['q2Jobs'])
    const q3Jobs = Number(inputs['q3Jobs'])
    const q4Jobs = Number(inputs['q4Jobs'])
    const avgJobValue = Number(inputs['avgJobValue'])
    const totalJobs = q1Jobs + q2Jobs + q3Jobs + q4Jobs
    const annualRevenue = totalJobs * avgJobValue
    const peakQuarterJobs = Math.max(q1Jobs, q2Jobs, q3Jobs, q4Jobs)
    const peakRevenue = peakQuarterJobs * avgJobValue
    const industryAvgJobsPerYear = Number(bm.data['avgJobsPerTechnicianYear'] ?? 240)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualRevenue', label: 'Projected Annual Revenue', value: `$${annualRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'peakRevenue', label: 'Peak Quarter Revenue', value: `$${peakRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'totalJobs', label: 'Total Jobs Planned', value: totalJobs.toLocaleString('en-US'), description: `Industry avg: ${industryAvgJobsPerYear} jobs/year per tech` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const leadToBookingCalculator: ToolDefinition = {
  slug: 'lead-to-booking-conversion-value',
  name: 'Lead-to-Booking Conversion Value',
  agencySlug: 'homeservices',
  benchmarkKeys: ['homeservices-lead-conversion'],
  fields: [
    { name: 'monthlyLeads', label: 'Monthly Leads', type: 'number', required: true, min: 1, max: 100_000, step: 1, placeholder: '80' },
    { name: 'conversionRate', label: 'Lead-to-Booking Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.5, placeholder: '22' },
    { name: 'avgJobValue', label: 'Average Job Value ($)', type: 'number', required: true, min: 50, max: 500_000, step: 50, placeholder: '1800' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['homeservices-lead-conversion']!
    const monthlyLeads = Number(inputs['monthlyLeads'])
    const conversionRate = Number(inputs['conversionRate']) / 100
    const avgJobValue = Number(inputs['avgJobValue'])
    const monthlyBookings = monthlyLeads * conversionRate
    const monthlyRevenue = monthlyBookings * avgJobValue
    const industryAvgConversionRate = Number(bm.data['avgLeadToBookingRate'] ?? 0.20)
    const potentialRevenueAtIndustryAvg = monthlyLeads * industryAvgConversionRate * avgJobValue
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'monthlyRevenue', label: 'Monthly Revenue from Leads', value: `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'monthlyBookings', label: 'Monthly Bookings', value: monthlyBookings.toFixed(0) },
        { name: 'industryBenchmark', label: 'Industry Avg Conversion', value: `${(industryAvgConversionRate * 100).toFixed(0)}%`, description: `At industry avg: $${potentialRevenueAtIndustryAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
