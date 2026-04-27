/**
 * packages/tools/src/tools/education/index.ts
 * 3 ToolDefinition objects for web-education agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const studentLtvCalculator: ToolDefinition = {
  slug: 'student-ltv-calculator',
  name: 'Student LTV Calculator',
  agencySlug: 'education',
  benchmarkKeys: ['education-student-ltv'],
  fields: [
    { name: 'avgEnrollmentYears', label: 'Average Enrollment Duration (Years)', type: 'number', required: true, min: 0.5, max: 20, step: 0.5, placeholder: '2' },
    { name: 'annualTuition', label: 'Annual Tuition / Program Fee ($)', type: 'number', required: true, min: 100, max: 500_000, step: 100, placeholder: '12000' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['education-student-ltv']!
    const avgEnrollmentYears = Number(inputs['avgEnrollmentYears'])
    const annualTuition = Number(inputs['annualTuition'])
    const ltv = avgEnrollmentYears * annualTuition
    const industryAvgLtv = Number(bm.data['avgStudentLtv'] ?? 24000)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'ltv', label: 'Student Lifetime Value', value: `$${ltv.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true, description: `Industry avg: $${industryAvgLtv.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'annualTuition', label: 'Annual Tuition Revenue per Student', value: `$${annualTuition.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvg', label: 'Industry Avg Student LTV', value: `$${industryAvgLtv.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const enrollmentConversionCalculator: ToolDefinition = {
  slug: 'enrollment-conversion-value-calculator',
  name: 'Enrollment Conversion Value Calculator',
  agencySlug: 'education',
  benchmarkKeys: ['education-enrollment'],
  fields: [
    { name: 'monthlyLeads', label: 'Monthly Prospective Student Inquiries', type: 'number', required: true, min: 1, max: 100_000, step: 1, placeholder: '150' },
    { name: 'conversionRate', label: 'Inquiry-to-Enrollment Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.5, placeholder: '18' },
    { name: 'annualTuition', label: 'Annual Tuition / Program Fee ($)', type: 'number', required: true, min: 100, max: 500_000, step: 100, placeholder: '12000' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['education-enrollment']!
    const monthlyLeads = Number(inputs['monthlyLeads'])
    const conversionRate = Number(inputs['conversionRate']) / 100
    const annualTuition = Number(inputs['annualTuition'])
    const monthlyEnrollments = monthlyLeads * conversionRate
    const monthlyValue = monthlyEnrollments * (annualTuition / 12)
    const industryAvgConversionRate = Number(bm.data['avgEnrollmentConversionRate'] ?? 0.20)
    const potentialAtIndustryAvg = monthlyLeads * industryAvgConversionRate * (annualTuition / 12)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'monthlyValue', label: 'Monthly Enrollment Revenue Value', value: `$${monthlyValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'monthlyEnrollments', label: 'Monthly New Enrollments', value: monthlyEnrollments.toFixed(0) },
        { name: 'industryAvgConversion', label: 'Industry Avg Conversion Rate', value: `${(industryAvgConversionRate * 100).toFixed(0)}%`, description: `At industry avg: $${potentialAtIndustryAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const tuitionRevenuePlanner: ToolDefinition = {
  slug: 'tuition-revenue-planner',
  name: 'Tuition Revenue Planner',
  agencySlug: 'education',
  benchmarkKeys: ['education-tuition'],
  fields: [
    { name: 'currentEnrollment', label: 'Current Enrollment (Students)', type: 'number', required: true, min: 1, max: 1_000_000, step: 10, placeholder: '500' },
    { name: 'growthRate', label: 'Target Annual Growth Rate (%)', type: 'number', required: true, min: -50, max: 200, step: 0.5, placeholder: '8' },
    { name: 'avgTuition', label: 'Average Annual Tuition per Student ($)', type: 'number', required: true, min: 100, max: 500_000, step: 100, placeholder: '12000' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['education-tuition']!
    const currentEnrollment = Number(inputs['currentEnrollment'])
    const growthRate = Number(inputs['growthRate'])
    const avgTuition = Number(inputs['avgTuition'])
    const currentRevenue = currentEnrollment * avgTuition
    const projectedEnrollment = currentEnrollment * (1 + growthRate / 100)
    const projectedRevenue = projectedEnrollment * avgTuition
    const revenueIncrease = projectedRevenue - currentRevenue
    const industryAvgGrowthRate = Number(bm.data['avgEnrollmentGrowthRate'] ?? 3.2)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'projectedRevenue', label: 'Projected Annual Revenue', value: `$${projectedRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'revenueIncrease', label: 'Revenue Increase', value: `$${revenueIncrease.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryGrowthRate', label: 'Industry Avg Enrollment Growth', value: `${industryAvgGrowthRate}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
