/**
 * packages/tools/src/tools/financial/index.ts
 * 3 ToolDefinition objects for web-financial agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const aumGrowthProjectionCalculator: ToolDefinition = {
  slug: 'aum-growth-projection-calculator',
  name: 'AUM Growth Projection Calculator',
  agencySlug: 'financial',
  benchmarkKeys: ['financial-aum-growth'],
  fields: [
    { name: 'currentAUM', label: 'Current AUM ($)', type: 'number', required: true, min: 0, max: 100_000_000_000, step: 100_000, placeholder: '5000000' },
    { name: 'annualReturnRate', label: 'Expected Annual Return Rate (%)', type: 'number', required: true, min: -20, max: 50, step: 0.1, placeholder: '7' },
    { name: 'years', label: 'Projection Period (Years)', type: 'number', required: true, min: 1, max: 30, step: 1, placeholder: '5' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['financial-aum-growth']!
    const currentAUM = Number(inputs['currentAUM'])
    const annualReturnRate = Number(inputs['annualReturnRate'])
    const years = Number(inputs['years'])
    const projectedAUM = currentAUM * Math.pow(1 + annualReturnRate / 100, years)
    const totalGrowth = projectedAUM - currentAUM
    const industryAvgReturnRate = Number(bm.data['avgAnnualReturnRate'] ?? 7.0)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'projectedAUM', label: `Projected AUM in ${years} Year${years !== 1 ? 's' : ''}`, value: `$${projectedAUM.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'totalGrowth', label: 'Total Growth', value: `$${totalGrowth.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvgReturn', label: 'Historical S&P 500 Avg Annual Return', value: `${industryAvgReturnRate}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const clientRetentionRevenueCalculator: ToolDefinition = {
  slug: 'client-retention-revenue-calculator',
  name: 'Client Retention Revenue Calculator',
  agencySlug: 'financial',
  benchmarkKeys: ['financial-client-retention'],
  fields: [
    { name: 'clients', label: 'Number of Advisory Clients', type: 'number', required: true, min: 1, max: 100_000, step: 1, placeholder: '120' },
    { name: 'avgAUM', label: 'Average AUM per Client ($)', type: 'number', required: true, min: 1_000, max: 1_000_000_000, step: 10_000, placeholder: '450000' },
    { name: 'managementFeePercent', label: 'Management Fee (%)', type: 'number', required: true, min: 0.1, max: 5, step: 0.05, placeholder: '1' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['financial-client-retention']!
    const clients = Number(inputs['clients'])
    const avgAUM = Number(inputs['avgAUM'])
    const managementFeePercent = Number(inputs['managementFeePercent'])
    const retentionRevenue = clients * avgAUM * managementFeePercent / 100
    const totalAUM = clients * avgAUM
    const industryAvgRetentionRate = Number(bm.data['avgClientRetentionRate'] ?? 0.94)
    const revenueAtRisk = retentionRevenue * (1 - industryAvgRetentionRate)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'retentionRevenue', label: 'Annual Advisory Revenue', value: `$${retentionRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'totalAUM', label: 'Total Assets Under Management', value: `$${totalAUM.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'revenueAtRisk', label: 'Revenue at Risk (avg churn)', value: `$${revenueAtRisk.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, description: `Industry avg retention: ${(industryAvgRetentionRate * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const referralValueEstimator: ToolDefinition = {
  slug: 'referral-value-estimator',
  name: 'Referral Value Estimator',
  agencySlug: 'financial',
  benchmarkKeys: ['financial-referral'],
  fields: [
    { name: 'referralsPerClient', label: 'Average Referrals per Client per Year', type: 'number', required: true, min: 0, max: 100, step: 0.1, placeholder: '1.2' },
    { name: 'avgClientAUM', label: 'Average Referred Client AUM ($)', type: 'number', required: true, min: 1_000, max: 1_000_000_000, step: 10_000, placeholder: '350000' },
    { name: 'managementFeePercent', label: 'Management Fee (%)', type: 'number', required: true, min: 0.1, max: 5, step: 0.05, placeholder: '1' },
    { name: 'avgClientLifespanYears', label: 'Average Client Lifespan (Years)', type: 'number', required: true, min: 1, max: 50, step: 0.5, placeholder: '12' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['financial-referral']!
    const referralsPerClient = Number(inputs['referralsPerClient'])
    const avgClientAUM = Number(inputs['avgClientAUM'])
    const managementFeePercent = Number(inputs['managementFeePercent'])
    const avgClientLifespanYears = Number(inputs['avgClientLifespanYears'])
    const annualReferralValue = referralsPerClient * avgClientAUM * managementFeePercent / 100
    const lifetimeReferralValue = annualReferralValue * avgClientLifespanYears
    const industryAvgReferralRate = Number(bm.data['avgReferralsPerClientPerYear'] ?? 1.1)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'lifetimeReferralValue', label: 'Lifetime Value per Referring Client', value: `$${lifetimeReferralValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'annualReferralValue', label: 'Annual Referral Revenue', value: `$${annualReferralValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvgReferrals', label: 'Industry Avg Referrals / Client / Year', value: `${industryAvgReferralRate}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}
