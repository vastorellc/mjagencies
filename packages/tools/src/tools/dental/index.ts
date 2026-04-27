/**
 * packages/tools/src/tools/dental/index.ts
 * 3 ToolDefinition objects for web-dental agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const newPatientRevenueCalculator: ToolDefinition = {
  slug: 'new-patient-revenue-calculator',
  name: 'New Patient Revenue Calculator',
  agencySlug: 'dental',
  benchmarkKeys: ['dental-new-patient'],
  fields: [
    { name: 'newPatientsPerMonth', label: 'New Patients per Month', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '25' },
    { name: 'avgFirstYearValue', label: 'Average First-Year Patient Value ($)', type: 'number', required: true, min: 100, max: 100_000, step: 50, placeholder: '1200' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['dental-new-patient']!
    const newPatientsPerMonth = Number(inputs['newPatientsPerMonth'])
    const avgFirstYearValue = Number(inputs['avgFirstYearValue'])
    const annualRevenue = newPatientsPerMonth * 12 * avgFirstYearValue
    const monthlyRevenue = newPatientsPerMonth * avgFirstYearValue
    const industryAvgFirstYearValue = Number(bm.data['avgFirstYearPatientValue'] ?? 1200)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualRevenue', label: 'Annual New Patient Revenue', value: `$${annualRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'monthlyRevenue', label: 'Monthly New Patient Revenue', value: `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvg', label: 'Industry Avg First-Year Patient Value', value: `$${industryAvgFirstYearValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const treatmentAcceptanceEstimator: ToolDefinition = {
  slug: 'treatment-acceptance-rate-estimator',
  name: 'Treatment Acceptance Rate Estimator',
  agencySlug: 'dental',
  benchmarkKeys: ['dental-treatment-acceptance'],
  fields: [
    { name: 'treatmentsPresentedMonthly', label: 'Treatment Plans Presented per Month', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '80' },
    { name: 'currentAcceptance', label: 'Current Acceptance Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '52' },
    { name: 'targetAcceptance', label: 'Target Acceptance Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '70' },
    { name: 'avgTreatmentValue', label: 'Average Treatment Plan Value ($)', type: 'number', required: true, min: 100, max: 500_000, step: 50, placeholder: '2800' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['dental-treatment-acceptance']!
    const treatmentsPresentedMonthly = Number(inputs['treatmentsPresentedMonthly'])
    const currentAcceptance = Number(inputs['currentAcceptance']) / 100
    const targetAcceptance = Number(inputs['targetAcceptance']) / 100
    const avgTreatmentValue = Number(inputs['avgTreatmentValue'])
    const acceptanceGap = Math.max(0, targetAcceptance - currentAcceptance)
    const revenueOpportunity = acceptanceGap * treatmentsPresentedMonthly * avgTreatmentValue
    const currentMonthlyRevenue = currentAcceptance * treatmentsPresentedMonthly * avgTreatmentValue
    const industryAvgAcceptanceRate = Number(bm.data['avgAcceptanceRate'] ?? 0.65)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'revenueOpportunity', label: 'Monthly Revenue Opportunity', value: `$${revenueOpportunity.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'currentMonthlyRevenue', label: 'Current Monthly Treatment Revenue', value: `$${currentMonthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvg', label: 'Industry Avg Acceptance Rate', value: `${(industryAvgAcceptanceRate * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const hygieneRecallRevenueCalculator: ToolDefinition = {
  slug: 'hygiene-recall-revenue-calculator',
  name: 'Hygiene Recall Revenue Calculator',
  agencySlug: 'dental',
  benchmarkKeys: ['dental-hygiene-recall'],
  fields: [
    { name: 'activePatients', label: 'Active Patients in Practice', type: 'number', required: true, min: 50, max: 500_000, step: 50, placeholder: '1200' },
    { name: 'recallRate', label: 'Current Hygiene Recall Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '48' },
    { name: 'avgHygieneValue', label: 'Average Hygiene Visit Value ($)', type: 'number', required: true, min: 50, max: 5_000, step: 10, placeholder: '185' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['dental-hygiene-recall']!
    const activePatients = Number(inputs['activePatients'])
    const recallRate = Number(inputs['recallRate']) / 100
    const avgHygieneValue = Number(inputs['avgHygieneValue'])
    const recallRevenue = activePatients * recallRate * avgHygieneValue
    const industryAvgRecallRate = Number(bm.data['avgRecallRate'] ?? 0.65)
    const revenueAtIndustryAvg = activePatients * industryAvgRecallRate * avgHygieneValue
    const revenueGap = Math.max(0, revenueAtIndustryAvg - recallRevenue)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'recallRevenue', label: 'Annual Hygiene Recall Revenue', value: `$${recallRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'revenueGap', label: 'Revenue Gap to Industry Avg', value: `$${revenueGap.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvgRecall', label: 'Industry Avg Recall Rate', value: `${(industryAvgRecallRate * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
