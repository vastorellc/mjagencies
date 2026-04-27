/**
 * packages/tools/src/tools/fitness/index.ts
 * 3 ToolDefinition objects for web-fitness agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const membershipRevenueCalculator: ToolDefinition = {
  slug: 'membership-revenue-calculator',
  name: 'Membership Revenue Calculator',
  agencySlug: 'fitness',
  benchmarkKeys: ['fitness-membership'],
  fields: [
    { name: 'activeMembers', label: 'Active Members', type: 'number', required: true, min: 1, max: 500_000, step: 10, placeholder: '350' },
    { name: 'avgMembershipPrice', label: 'Average Membership Price ($/mo)', type: 'number', required: true, min: 1, max: 5_000, step: 1, placeholder: '48' },
    { name: 'personalTrainingPercent', label: 'Members with Personal Training (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '12' },
    { name: 'avgPtRevenue', label: 'Avg PT Revenue per Member ($/mo)', type: 'number', required: true, min: 0, max: 5_000, step: 10, placeholder: '180' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['fitness-membership']!
    const activeMembers = Number(inputs['activeMembers'])
    const avgMembershipPrice = Number(inputs['avgMembershipPrice'])
    const personalTrainingPercent = Number(inputs['personalTrainingPercent']) / 100
    const avgPtRevenue = Number(inputs['avgPtRevenue'])
    const membershipRevenue = activeMembers * avgMembershipPrice
    const ptRevenue = activeMembers * personalTrainingPercent * avgPtRevenue
    const monthlyRevenue = membershipRevenue + ptRevenue
    const industryAvgRevenuePerMember = Number(bm.data['avgMonthlyRevenuePerMember'] ?? 65)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'monthlyRevenue', label: 'Total Monthly Revenue', value: `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'membershipRevenue', label: 'Membership Revenue', value: `$${membershipRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'revenuePerMember', label: 'Revenue per Member', value: `$${(activeMembers > 0 ? monthlyRevenue / activeMembers : 0).toFixed(2)}`, description: `Industry avg: $${industryAvgRevenuePerMember}/member/mo` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const churnCostCalculator: ToolDefinition = {
  slug: 'churn-cost-calculator',
  name: 'Churn Cost Calculator',
  agencySlug: 'fitness',
  benchmarkKeys: ['fitness-churn'],
  fields: [
    { name: 'activeMembers', label: 'Active Members', type: 'number', required: true, min: 1, max: 500_000, step: 10, placeholder: '350' },
    { name: 'churnRate', label: 'Monthly Churn Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.1, placeholder: '3.5' },
    { name: 'avgMembershipPrice', label: 'Average Membership Price ($/mo)', type: 'number', required: true, min: 1, max: 5_000, step: 1, placeholder: '48' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['fitness-churn']!
    const activeMembers = Number(inputs['activeMembers'])
    const churnRate = Number(inputs['churnRate']) / 100
    const avgMembershipPrice = Number(inputs['avgMembershipPrice'])
    const monthlyChurnRevenueLoss = activeMembers * churnRate * avgMembershipPrice
    const annualChurnRevenueLoss = monthlyChurnRevenueLoss * 12
    const industryAvgChurnRate = Number(bm.data['avgMonthlyChurnRate'] ?? 0.035)
    const membersLostMonthly = activeMembers * churnRate
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualChurnRevenueLoss', label: 'Annual Revenue Lost to Churn', value: `$${annualChurnRevenueLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'monthlyChurnRevenueLoss', label: 'Monthly Revenue Lost to Churn', value: `$${monthlyChurnRevenueLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'membersLostMonthly', label: 'Members Lost Monthly', value: membersLostMonthly.toFixed(0), description: `Industry avg churn: ${(industryAvgChurnRate * 100).toFixed(1)}%/mo` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const classFillRateOptimizer: ToolDefinition = {
  slug: 'class-fill-rate-optimizer',
  name: 'Class Fill Rate Optimizer',
  agencySlug: 'fitness',
  benchmarkKeys: ['fitness-class-fill'],
  fields: [
    { name: 'classesPerMonth', label: 'Classes per Month', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '120' },
    { name: 'classCapacity', label: 'Average Class Capacity (spots)', type: 'number', required: true, min: 1, max: 1_000, step: 1, placeholder: '20' },
    { name: 'currentFillRate', label: 'Current Fill Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '55' },
    { name: 'targetFillRate', label: 'Target Fill Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '80' },
    { name: 'dropInRate', label: 'Drop-in / Non-Member Revenue per Spot ($)', type: 'number', required: true, min: 0, max: 500, step: 1, placeholder: '22' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['fitness-class-fill']!
    const classesPerMonth = Number(inputs['classesPerMonth'])
    const classCapacity = Number(inputs['classCapacity'])
    const currentFillRate = Number(inputs['currentFillRate']) / 100
    const targetFillRate = Number(inputs['targetFillRate']) / 100
    const dropInRate = Number(inputs['dropInRate'])
    const fillRateGap = Math.max(0, targetFillRate - currentFillRate)
    const additionalSpotsPerMonth = fillRateGap * classCapacity * classesPerMonth
    const revenueIncrease = additionalSpotsPerMonth * dropInRate
    const industryAvgFillRate = Number(bm.data['avgClassFillRate'] ?? 0.68)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'revenueIncrease', label: 'Monthly Revenue Opportunity', value: `$${revenueIncrease.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'additionalSpots', label: 'Additional Spots to Fill Monthly', value: additionalSpotsPerMonth.toFixed(0) },
        { name: 'industryFillRate', label: 'Industry Avg Fill Rate', value: `${(industryAvgFillRate * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
